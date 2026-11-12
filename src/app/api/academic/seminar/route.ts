import { NextResponse } from 'next/server';
import { requireAuthenticatedUser } from '@/lib/supabase/authorization';

export async function POST(req: Request) {
  try {
    const access = await requireAuthenticatedUser();
    if (!access) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { title, discipline, problem, variables } = await req.json();
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ success: false, error: 'هذه الخدمة غير متاحة الآن.' }, { status: 503 });
    }

    if (!title) {
      return NextResponse.json({ success: false, error: 'الرجاء توفير العنوان الأكاديمي لبناء السيمينار' }, { status: 400 });
    }

    const prompt = `أنت محكم ومستشار أكاديمي خبير في إعداد السيمينارات ومقترحات الأبحاث (Seminar & Proposal Builder). بناءً على المعطيات التالية:
    - العنوان: "${title}"
    - التخصص: "${discipline || 'غير محدد'}"
    - المشكلة/المتغيرات: "${variables || problem || 'غير محددة'}"

    قم بتوليد حزمة السيمينار ومقترح البحث الكاملة والتي تتضمن:
    1. ملخص مقترح البحث (Executive Proposal Summary).
    2. أسئلة البحث والفرضيات (Research Questions & Hypotheses).
    3. هيكل شرائح العرض التقديمي للسيمينار (Seminar Slides Outline - 5 شرائح على الأقل مع محتوى كل شريحة).
    4. محاكاة لجنة المناقشة (Defense Simulation): 3 أسئلة صعبة متوقعة من المحكمين مع الإجابة النموذجية لكل سؤال.

    يجب إرجاع النتيجة ككائن JSON صالح حصراً (بدون أي نصوص خارج الـ JSON) بالشكل التالي:
    {
      "executiveSummary": "ملخص تنفيذي احترافي למقترح البحث",
      "researchQuestions": ["السؤال الأول", "السؤال الثاني"],
      "hypotheses": ["الفرضية الأولى", "الفرضية الثانية"],
      "seminarSlides": [
        {
          "slideNumber": 1,
          "title": "عنوان الشريحة",
          "bulletPoints": ["نقطة 1", "نقطة 2"]
        }
      ],
      "defenseQuestions": [
        {
          "question": "السؤال المتوقع من المحكم",
          "sampleAnswer": "الإجابة النموذجية المبررة أكاديمياً"
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
      return NextResponse.json({ success: false, error: 'فشل توليد السيمينار عبر نموذج Gemini' }, { status: 500 });
    }

  } catch (err: unknown) {
    console.error('/api/academic/seminar failed', err);
    return NextResponse.json({ success: false, error: 'خطأ في الاتصال' }, { status: 500 });
  }
}
