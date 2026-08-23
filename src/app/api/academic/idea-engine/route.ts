import { NextResponse } from 'next/server';
import { requireAuthenticatedUser } from '@/lib/supabase/authorization';

export async function POST(req: Request) {
  try {
    const access = await requireAuthenticatedUser();
    if (!access) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { discipline, originalIdea } = await req.json();
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ success: false, error: 'مفتاح Gemini API غير متوفر' }, { status: 500 });
    }

    if (!discipline && !originalIdea) {
      return NextResponse.json({ success: false, error: 'الرجاء توفير التخصص أو الفكرة الضعيفة لتوليد البدائل' }, { status: 400 });
    }

    const prompt = `أنت خبير ومستشار ابتكار أكاديمي (Idea Engine). نظراً لأن الفكرة أو التخصص التالي (${originalIdea || discipline}) بحاجة إلى تطوير أو استبدال بأفكار أكثر أصالة وجدوى، قم بتوليد 3 أفكار بحثية أكاديمية متقدمة، مبتكرة، وغير مكررة.

    لكل فكرة، يجب توفير العناصر التالية بدقة تامة:
    1. العنوان المقترح (Title) باللغة العربية.
    2. المشكلة البحثية (Research Problem).
    3. المتغير المستقل (Independent Variable).
    4. المتغير التابع (Dependent Variable).
    5. مجتمع الدراسة المستهدف (Target Population).
    6. الفجوة البحثية المستهدفة (Research Gap).

    يجب عليك إرجاع النتيجة ككائن JSON صالح حصراً (بدون أي نصوص خارج الـ JSON) بالشكل التالي:
    {
      "ideas": [
        {
          "id": 1,
          "title": "...",
          "problem": "...",
          "independentVariable": "...",
          "dependentVariable": "...",
          "population": "...",
          "gap": "..."
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
      return NextResponse.json({ success: false, error: 'فشل توليد الأفكار عبر نموذج Gemini' }, { status: 500 });
    }

  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || 'خطأ في الاتصال' }, { status: 500 });
  }
}
