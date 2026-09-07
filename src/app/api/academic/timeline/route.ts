import { NextResponse } from 'next/server';
import { requireAuthenticatedUser } from '@/lib/supabase/authorization';

export async function POST(req: Request) {
  try {
    const access = await requireAuthenticatedUser();
    if (!access) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { researchType, durationMonths } = await req.json();
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ success: false, error: 'مفتاح Gemini API غير متوفر في البيئة' }, { status: 500 });
    }

    const prompt = `أنت خبير إدارة مشاريع أكاديمية ومنهجية بحث. بناءً على نوع البحث (${researchType || 'بحث أكاديمي عام'}) والمدة الزمنية المتاحة (${durationMonths || '6'} أشهر):
    قم بتصميم جدول زمني ومراحل تنفيذية متكاملة (Milestones) تشمل:
    1. اسم المرحلة (Phase Name).
    2. المدة الزمنية المخصصة للمرحلة.
    3. المهام الرئيسية المطلوبة.
    4. المخرجات أو التسليمات (Deliverables).

    أرجع النتيجة ككائن JSON صالح حصراً (بدون أي نصوص خارج الـ JSON) بالشكل التالي:
    {
      "milestones": [
        {
          "id": 1,
          "phaseName": "...",
          "duration": "...",
          "tasks": ["..."],
          "deliverables": "..."
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
      return NextResponse.json({ success: true, timeline: parsedData });
    } else {
      return NextResponse.json({ success: false, error: 'فشل توليد التخطيط الزمني عبر نموذج Gemini' }, { status: 500 });
    }

  } catch (err: unknown) {
    return NextResponse.json({ success: false, error: err instanceof Error && err.message ? err.message : 'خطأ في الخادم' }, { status: 500 });
  }
}
