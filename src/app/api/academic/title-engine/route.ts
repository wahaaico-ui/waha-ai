import { NextResponse } from 'next/server';
import { requireAuthenticatedUser } from '@/lib/supabase/authorization';

export async function POST(req: Request) {
  try {
    const access = await requireAuthenticatedUser();
    if (!access) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { idea, discipline, variables } = await req.json();
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ success: false, error: 'مفتاح Gemini API غير متوفر' }, { status: 500 });
    }

    if (!idea && !discipline) {
      return NextResponse.json({ success: false, error: 'الرجاء توفير الفكرة أو التخصص لتوليد العناوين' }, { status: 400 });
    }

    const prompt = `أنت خبير صياغة عناوين أبحاث أكاديمية محترف ومحكم (Title Engine). بناءً على الفكرة أو المجال التالي: "${idea || discipline}" والمتغيرات المتاحة (${variables || 'غير محددة'}), قم بتوليد 4 عناوين بحثية أكاديمية دقيقة، رصينة، ومحترفة باللغة العربية الفصحى وبأنماط بحثية مختلفة (مثل: وصفية، ارتباطية، تجريبية، تحليلية).

    لكل عنوان، وفر البيانات التالية بدقة:
    1. العنوان المقترح (Title)
    2. النمط أو المنهج المعكوس في الصياغة (Style)
    3. المبرر العلمي أو الأكاديمي لملاءمة العنوان (Rationale)

    يجب عليك إرجاع النتيجة ككائن JSON صالح حصراً (بدون أي نصوص خارج الـ JSON) بالشكل التالي:
    {
      "titles": [
        {
          "id": 1,
          "title": "...",
          "style": "...",
          "rationale": "..."
        }
      ]
    }`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          response_mime_type: "application/json"
        }
      }),
    });

    const data = await response.json();

    if (data.candidates && data.candidates[0]?.content?.parts[0]?.text) {
      const parsedData = JSON.parse(data.candidates[0].content.parts[0].text);
      return NextResponse.json({ success: true, data: parsedData });
    } else {
      return NextResponse.json({ success: false, error: 'فشل توليد العناوين عبر نموذج Gemini' }, { status: 500 });
    }

  } catch (err: unknown) {
    return NextResponse.json({ success: false, error: err instanceof Error && err.message ? err.message : 'خطأ في الاتصال' }, { status: 500 });
  }
}
