import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { title, objectives, methodology, significance } = await req.json();
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ success: false, error: 'مفتاح Gemini API غير متوفر في البيئة' }, { status: 500 });
    }

    if (!title) {
      return NextResponse.json({ success: false, error: 'عنوان البحث الرئيسي مطلوب' }, { status: 400 });
    }

    const prompt = `أنت بروفيسور ومحكم أكاديمي دولي. بناءً على المدخلات التالية لمشروع بحثي:
    - العنوان: "${title}"
    - الأهداف الرئيسية: "${objectives || 'غير محددة'}"
    - المنهجية المقترحة: "${methodology || 'غير محددة'}"
    - الأهمية ومبررات البحث: "${significance || 'غير محددة'}"

    قم بصياغة مقترح بحثي / وثيقة سيمينار أكاديمية متكاملة ورسمية تتضمن الأقسام التالية:
    1. المقدمة والخلفية النظرية (Introduction & Background).
    2. مشكلة البحث وأسئلته (Research Problem & Questions).
    3. أهداف وأهمية البحث (Objectives & Significance).
    4. الإطار المنهجي (Methodology Framework).
    5. النتائج المتوقعة والإسهام العلمي (Expected Outcomes & Contributions).
    6. الجدول الزمنى المقترح لمراحل التنفيذ (Proposed Timeline).

    أرجع النتيجة ككائن JSON صالح حصراً (بدون أي نصوص خارج الـ JSON) بالشكل التالي:
    {
      "introduction": "...",
      "problemAndQuestions": "...",
      "objectivesAndSignificance": "...",
      "methodologyFramework": "...",
      "expectedOutcomes": "...",
      "timeline": "..."
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
      return NextResponse.json({ success: true, proposal: parsedData });
    } else {
      return NextResponse.json({ success: false, error: 'فشل توليد المقترح عبر نموذج Gemini' }, { status: 500 });
    }

  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || 'خطأ في الخادم' }, { status: 500 });
  }
}
