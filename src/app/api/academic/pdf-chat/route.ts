import { NextResponse } from 'next/server';
import { requireAuthenticatedUser } from '@/lib/supabase/authorization';

export async function POST(req: Request) {
  try {
    const access = await requireAuthenticatedUser();
    if (!access) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { fileBase64, question } = await req.json();
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ success: false, error: 'هذه الخدمة غير متاحة الآن.' }, { status: 503 });
    }

    if (!fileBase64) {
      return NextResponse.json({ success: false, error: 'الرجاء إرفاق ملف PDF' }, { status: 400 });
    }

    const prompt = question || 'قم بتلخيص هذه الورقة العلمية بأسلوب أكاديمي دقيق، موضحاً الهدف، المنهجية، النتائج، والفجوة البحثية.';

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            {
              inline_data: {
                mime_type: 'application/pdf',
                data: fileBase64
              }
            },
            { text: prompt }
          ]
        }]
      }),
    });

    const data = await response.json();

    if (data.candidates && data.candidates[0]?.content?.parts[0]?.text) {
      return NextResponse.json({ success: true, answer: data.candidates[0].content.parts[0].text });
    } else {
      return NextResponse.json({ success: false, error: 'فشل معالجة ملف الـ PDF عبر نموذج Gemini' }, { status: 500 });
    }

  } catch (err: unknown) {
    console.error('/api/academic/pdf-chat failed', err);
    return NextResponse.json({ success: false, error: 'خطأ في الاتصال' }, { status: 500 });
  }
}
