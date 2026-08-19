import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { analysis, readiness, intelligence } = await req.json();
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ success: false, error: 'مفتاح Gemini API غير متوفر' }, { status: 500 });
    }

    const prompt = `أنت محرك اتخاذ القرار الأكاديمي الاستراتيجي (Decision Engine). بناءً على مخرجات التحليل، الجاهزية، وذكاء الأبحاث، قم بإعطاء القرار النهائي الحاسم للباحث.

    بيانات التحليل والجاهزية وذكاء الأبحاث:
    - تحليل المدخل: ${JSON.stringify(analysis || {})}
    - الجاهزية: ${JSON.stringify(readiness || {})}
    - ذكاء الأبحاث: ${JSON.stringify(intelligence || {})}

    قواعد اتخاذ القرار الصارمة:
    حدد بدقة واحداً من القرارات التالية حصراً:
    1. "Start" (ابدأ - إذا كانت الفكرة أصيلة ومكتملة وجاهزة تماماً)
    2. "Do Not Start" (لا تبدأ - إذا كان الموضوع مستهلكاً جداً ومكرراً بشكل عديم الفائدة)
    3. "Modify" (عدل - إذا كانت الفكرة بحاجة لتعديل طفيف في المتغيرات أو المجتمع)
    4. "Change" (غير - إذا كانت الفكرة غير مجدية ويتوجب تغييرها كلياً)
    5. "Broaden" (وسع - إذا كانت الفكرة ضيقة جداً ولا يوجد لها أدبيات كافية)
    6. "Narrow" (ضيق - إذا كانت الفكرة واسعة جداً وعامة وتحتاج تخصيصاً أدق)

    أرجع النتيجة ككائن JSON صالح حصراً (بدون أي نصوص خارجية) بالشكل التالي:
    {
      "decision": "Start / Do Not Start / Modify / Change / Broaden / Narrow",
      "decisionArabic": "القرار بالعربية بدقة (مثل: ابدأ، عدل، وسع، إلخ)",
      "rationale": "التبرير الأكاديمي المفصل والمبرهن للقرار باللغة العربية",
      "actionableSteps": ["قائمة الخطوات العملية الواضحة للباحث بناءً على القرار"]
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
      return NextResponse.json({ success: true, decisionResult: parsedData });
    } else {
      return NextResponse.json({ success: false, error: 'فشل توليد القرار عبر نموذج Gemini' }, { status: 500 });
    }

  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || 'خطأ في الاتصال' }, { status: 500 });
  }
}
