import { NextResponse } from 'next/server';
import { requireAuthenticatedUser } from '@/lib/supabase/authorization';

export async function POST(req: Request) {
  try {
    const access = await requireAuthenticatedUser();
    if (!access) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { text } = await req.json();
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ success: false, error: 'مفتاح Gemini API غير متوفر' }, { status: 500 });
    }

    if (!text || !text.trim()) {
      return NextResponse.json({ success: false, error: 'النص المدخل فارغ' }, { status: 400 });
    }

    const prompt = `أنت محلل مدخلات بحثية أكاديمية متقدم (Academic Input Analyzer). مهمتك هي تحليل النص المدخل بعناية فائقة واستخراج العناصر الهيكلية للبحث العلمي بدقة تامة دون تخمين عشوائي.
    النص المدخل: "${text}"

    يجب عليك إرجاع النتيجة ككائن JSON صالح حصراً (بدون أي نصوص إضافية أو Markdown خارج الـ JSON) بالشكل التالي:
    {
      "language": "لغة النص (مثل: Arabic, English)",
      "inputType": "نوع المدخل (Research Idea, Title, Proposal, Non-academic, etc.)",
      "discipline": "التخصص الأكاديمي الرئيسي (مثل: Education, Computer Science, Medical, Social Sciences, etc.)",
      "field": "المجال الدقيق",
      "country": "الدولة إذا ذكرت أو استنتجت بوضوح، وإلا null",
      "population": "مجتمع الدراسة المستهدف، وإلا null",
      "academicStage": "المرحلة الأكاديمية (مثل: Undergraduate, Postgraduate, General, etc.)، وإلا null",
      "independentVariable": "المتغير المستقل إن وجد، وإلا null",
      "dependentVariable": "المتغير التابع إن وجد، وإلا null",
      "researchProblem": "المشكلة البحثية أو الفكرة الجوهرية المستخلصة، وإلا null",
      "missing": ["قائمة العناصر المفقودة أو غير الواضحة مثل Methodology, Population, Country, Variables, etc."]
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
      const rawJson = data.candidates[0].content.parts[0].text;
      const parsedData = JSON.parse(rawJson);
      return NextResponse.json({ success: true, analysis: parsedData });
    } else {
      return NextResponse.json({ success: false, error: 'فشل تحليل المدخلات عبر نموذج Gemini' }, { status: 500 });
    }

  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || 'خطأ في الاتصال' }, { status: 500 });
  }
}
