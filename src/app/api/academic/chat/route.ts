import { NextResponse } from 'next/server';
import { requireAuthenticatedUser } from '@/lib/supabase/authorization';

interface IncomingChatMessage {
  role?: unknown;
  content?: unknown;
}

export async function POST(req: Request) {
  try {
    const access = await requireAuthenticatedUser();
    if (!access) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { messages, projectContext } = await req.json();
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ success: false, error: 'مفتاح Gemini API غير متوفر في البيئة' }, { status: 500 });
    }

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ success: false, error: 'رسائل المحادثة مفقودة' }, { status: 400 });
    }

    const systemInstruction = `أنت مساعد أكاديمي ذكي ومحكم بحثي خبير مدعوم بنظام WAHA.
    سياق المشروع الحالي للباحث هو: "${projectContext || 'مشروع بحثي أكاديمي عام'}".
    قم بإجابة الباحث بدقة علمية، واحترافية، وباللغة العربية الفصحى، مع تقديم استشارات دقيقة تدعم مساره البحثي.`;

    // تحويل رسائل المحادثة لتوافق هيكل Gemini API
    const contents = messages
      .map((message: unknown) => {
        const candidate = message && typeof message === 'object' ? message as IncomingChatMessage : {};
        return {
          role: candidate.role === 'user' ? 'user' : 'model',
          parts: [{ text: typeof candidate.content === 'string' ? candidate.content.trim() : '' }]
        };
      })
      .filter((message) => message.parts[0].text.length > 0);

    if (contents.length === 0) {
      return NextResponse.json({ success: false, error: 'محتوى رسائل المحادثة غير صالح' }, { status: 400 });
    }

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: {
          parts: [{ text: systemInstruction }]
        },
        contents: contents
      }),
    });

    const data = await response.json();

    if (data.candidates && data.candidates[0]?.content?.parts[0]?.text) {
      const reply = data.candidates[0].content.parts[0].text;
      return NextResponse.json({ success: true, reply });
    } else {
      return NextResponse.json({ success: false, error: 'فشل الرد عبر نموذج Gemini' }, { status: 500 });
    }

  } catch (err: unknown) {
    return NextResponse.json({ success: false, error: err instanceof Error && err.message ? err.message : 'خطأ في الخادم' }, { status: 500 });
  }
}
