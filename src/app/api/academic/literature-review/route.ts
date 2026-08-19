import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { papers } = await req.json();
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ success: false, error: 'مفتاح Gemini API غير متوفر' }, { status: 500 });
    }

    if (!papers || !Array.isArray(papers) || papers.length === 0) {
      return NextResponse.json({ success: false, error: 'الرجاء توفير أبحاث لتوليد مراجعة الأدبيات' }, { status: 400 });
    }

    const papersText = papers.map((p: any, idx: number) => `
      البحث ${idx + 1}:
      العنوان: ${p.title}
      المؤلفون: ${p.authors}
      السنة: ${p.year}
      المستخلص: ${p.abstract}
    `).join('\n---\n');

    const prompt = `أنت أكاديمي وباحث رفيع المستوى في مناهج البحث العلمي. بناءً على الأبحاث التالية، قم بكتابة "فصل مراجعة أدبيات" (Literature Review) علمي، مترابط، ومتكامل باللغة العربية الفصحى.
    تجنب السرد المنفصل لكل بحث على حِدة، واعتمد أسلوب التخليق (Synthesis) القائم على دمج المحاور، المقارنة بين المنهجيات، وتسليط الضوء على الاتجاهات المشتركة والقصور.

    يجب أن يتضمن التقرير:
    1. مقدمة تحليلية للمجال البحثي العام.
    2. استعراض متكامل للمحاور الموضوعية المستخلصة من الأبحاث.
    3. تحديد الفجوات البحثية الكلية التي تشترك فيها هذه الدراسات.
    4. خاتمة تلخص الموقف المعرفي.

    الأبحاث المرفقة:
    ${papersText}

    صغ النص بصياغة أكاديمية رصينة ومهنية جاهزة للاستخدام البحثي.`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      }),
    });

    const data = await response.json();

    if (data.candidates && data.candidates[0]?.content?.parts[0]?.text) {
      return NextResponse.json({ success: true, review: data.candidates[0].content.parts[0].text });
    } else {
      return NextResponse.json({ success: false, error: 'فشل توليد مراجعة الأدبيات عبر نموذج Gemini' }, { status: 500 });
    }

  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || 'خطأ في الاتصال' }, { status: 500 });
  }
}
