import { NextResponse } from 'next/server';
import { requireAuthenticatedUser } from '@/lib/supabase/authorization';

export async function POST(req: Request) {
  try {
    const access = await requireAuthenticatedUser();
    if (!access) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { title, discipline, variables } = await req.json();
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ success: false, error: 'مفتاح Gemini API غير متوفر' }, { status: 500 });
    }

    if (!title) {
      return NextResponse.json({ success: false, error: 'العنوان أو الفكرة البحثية مفقودة' }, { status: 400 });
    }

    const prompt = `أنت خبير منهجية بحث علمي وإحصاء أكاديمي محترف. بناءً على العنوان أو الفكرة البحثية التالية:
    - العنوان: "${title}"
    - التخصص: "${discipline || 'غير محدد'}"
    - المتغيرات: "${variables || 'غير محددة'}"

    قم بتصميم الخطة المنهجية البحثية الكاملة والأكثر ملاءمة، متضمنة العناصر التالية بدقة:
    1. المنهج البحثي المناسب (Research Design) مع التبرير العلمي.
    2. مجتمع وعينة الدراسة (Target Population & Sampling Technique).
    3. أدوات جمع البيانات المقترحة (Research Instruments).
    4. الأساليب الإحصائية والتحليلية المناسبة (Statistical Analysis Methods).

    أرجع النتيجة ككائن JSON صالح حصراً (بدون أي نصوص خارج الـ JSON) بالشكل التالي:
    {
      "researchDesign": {
        "type": "المنهج (مثل: المنهج الوصفي التحليلي / التجريبي)",
        "rationale": "المبرر العلمي لاختيار هذا المنهج"
      },
      "populationAndSampling": {
        "targetPopulation": "وصف مجتمع الدراسة المستهدف",
        "samplingMethod": "طريقة اختيار العينة وحجمها المقترح"
      },
      "instruments": ["أداة 1", "أداة 2"],
      "statisticalMethods": ["أسلوب إحصائي 1", "أسلوب إحصائي 2"]
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
      return NextResponse.json({ success: true, methodology: parsedData });
    } else {
      return NextResponse.json({ success: false, error: 'فشل توليد خطة المنهجية عبر نموذج Gemini' }, { status: 500 });
    }

  } catch (err: unknown) {
    return NextResponse.json({ success: false, error: err instanceof Error && err.message ? err.message : 'خطأ في الخادم' }, { status: 500 });
  }
}
