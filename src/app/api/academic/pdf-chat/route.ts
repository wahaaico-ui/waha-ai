import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { fileBase64, question } = await req.json();
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ success: false, error: 'مفتاح Gemini API غير متوفر' }, { status: 500 });
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

  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || 'خطأ في الاتصال' }, { status: 500 });
  }
}
