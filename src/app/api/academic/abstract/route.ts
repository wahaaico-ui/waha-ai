import { NextResponse } from 'next/server';
import { requireAuthenticatedUser } from '@/lib/supabase/authorization';

export async function POST(req: Request) {
  try {
    const access = await requireAuthenticatedUser();
    if (!access) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { rawNotes, keywords } = await req.json();
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ success: false, error: 'مفتاح Gemini API غير متوفر في البيئة' }, { status: 500 });
    }

    if (!rawNotes || !rawNotes.trim()) {
      return NextResponse.json({ success: false, error: 'مسودة البحث أو الملاحظات مفقودة' }, { status: 400 });
    }

    const prompt = `أنت خبير صياغة أكاديمية ومحرر أبحاث محكم في المجلات العالمية. بناءً على مسودة البحث أو الملاحظات التالية:
    - المسودة: "${rawNotes}"
    - الكلمات المفتاحية المقترحة: "${keywords || 'غير محددة'}"

    قم بتوليد وتحسين الآتي بدقة أكاديمية عالية:
    1. عناوين بحثية مقترحة ذات تأثير قوي (3 عناوين جذابة ورصينة).
    2. مستخلص أكاديمي مهيكل (Structured Abstract) يتضمن:
       - الخلفية والأهمية (Background)
       - الهدف الرئيسي (Objective)
       - المنهجية (Methodology)
       - النتائج الرئيسية (Key Findings)
       - الاستنتاج والتوصيات (Conclusion)
    3. قائمة الكلمات المفتاحية المعتمدة (Keywords).

    أرجع النتيجة ككائن JSON صالح حصراً (بدون أي نصوص خارج الـ JSON) بالشكل التالي:
    {
      "suggestedTitles": ["عنوان 1", "عنوان 2", "عنوان 3"],
      "abstract": {
        "background": "...",
        "objective": "...",
        "methodology": "...",
        "findings": "...",
        "conclusion": "..."
      },
      "keywordsList": ["كلمة 1", "كلمة 2", "كلمة 3"]
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
      return NextResponse.json({ success: true, abstractData: parsedData });
    } else {
      return NextResponse.json({ success: false, error: 'فشل التوليد عبر نموذج Gemini' }, { status: 500 });
    }

  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || 'خطأ في الخادم' }, { status: 500 });
  }
}
