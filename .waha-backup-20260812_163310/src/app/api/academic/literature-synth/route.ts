import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { topic, papersNotes } = await req.json();
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ success: false, error: 'مفتاح Gemini API غير متوفر' }, { status: 500 });
    }

    if (!topic || !papersNotes) {
      return NextResponse.json({ success: false, error: 'الموضوع أو ملخصات الأبحاث مفقودة' }, { status: 400 });
    }

    const prompt = `أنت بروفيسور وخبير أكاديمي محترف في كتابة مراجعات الأدبيات (Literature Reviews). 
    بناءً على موضوع البحث الرئيسي (${topic})، وملخصات الدراسات والأبحاث التالية:
    
    "${papersNotes}"

    قم بكتابة فصل مراجعة أدبيات أكاديمي متكامل ومترابط يتبع الأصول العلمية، متضمنًا العناصر التالية:
    1. مقدمة مراجعة الأدبيات وتأطير الموضوع.
    2. التخليق الموضوعي (Thematic Synthesis) للدراسات ومقارنة المنهجيات والنتائج.
    3. تحديد الفجوات البحثية المشتركة التي لم تعالجها الدراسات السابقة.
    4. الخاتمة والتوجه البحثي المقترح.

    أرجع النتيجة ككائن JSON صالح حصراً (بدون أي نصوص خارج الـ JSON) بالشكل التالي:
    {
      "introduction": "...",
      "thematicSynthesis": "...",
      "researchGapsIdentified": ["..."],
      "conclusion": "..."
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
      return NextResponse.json({ success: true, literatureReview: parsedData });
    } else {
      return NextResponse.json({ success: false, error: 'فشل توليد مراجعة الأدبيات عبر نموذج Gemini' }, { status: 500 });
    }

  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || 'خطأ في الخادم' }, { status: 500 });
  }
}
