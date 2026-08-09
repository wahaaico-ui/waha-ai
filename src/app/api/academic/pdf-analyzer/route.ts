import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { textContent, fileName } = await req.json();
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ success: false, error: 'مفتاح Gemini API غير متوفر' }, { status: 500 });
    }

    if (!textContent || !textContent.trim()) {
      return NextResponse.json({ success: false, error: 'النص المستخرج من المستند مفقود' }, { status: 400 });
    }

    const prompt = `أنت خبير تحليل أبحاث علمية وقارئ أوراق بحثية محترف. قم بتحليل نص البحث أو المستند المستخرج من الملف المرفق (${fileName || 'مستند بحثي'}) وتقديم تحليل عميق يتضمن:
    1. ملخص الورقة البحثية (Executive Summary).
    2. الإشكالية والأهداف (Problem Statement & Objectives).
    3. المنهجية والأدوات المستخدمة (Methodology & Tools).
    4. النتائج الرئيسية (Key Findings).
    5. النقاط القوية والثغرات (Strengths & Limitations).

    أرجع النتيجة ككائن JSON صالح حصراً (بدون أي نصوص خارج الـ JSON) بالشكل التالي:
    {
      "summary": "...",
      "problemAndObjectives": "...",
      "methodology": "...",
      "keyFindings": ["..."],
      "strengthsAndLimitations": "..."
    }`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt + "\n\nالنص المستخرج:\n" + textContent }] }],
        generationConfig: {
          response_mime_type: "application/json"
        }
      }),
    });

    const data = await response.json();

    if (data.candidates && data.candidates[0]?.content?.parts[0]?.text) {
      const parsedData = JSON.parse(data.candidates[0].content.parts[0].text);
      return NextResponse.json({ success: true, analysis: parsedData });
    } else {
      return NextResponse.json({ success: false, error: 'فشل تحليل المستند عبر نموذج Gemini' }, { status: 500 });
    }

  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || 'خطأ في الخادم' }, { status: 500 });
  }
}
