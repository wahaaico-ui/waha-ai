import { NextResponse } from 'next/server';
import { requireAuthenticatedUser } from '@/lib/supabase/authorization';

export async function POST(req: Request) {
  try {
    const access = await requireAuthenticatedUser();
    if (!access) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { domain } = await req.json();
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ success: false, error: 'مفتاح Gemini API غير متوفر' }, { status: 500 });
    }

    if (!domain || !domain.trim()) {
      return NextResponse.json({ success: false, error: 'الرجاء إدخال المجال أو التخصص البحثي' }, { status: 400 });
    }

    const prompt = `أنت خبير استراتيجي وباحث أكاديمي رفيع المستوى في مجال "${domain}".
    قم بتحليل وتحديد أبرز "الفجوات البحثية" (Research Gaps) والقصور المعرفي الحالي في هذا المجال على شكل تقرير أكاديمي منظم ومرتب يتضمن:
    1. أبرز التوجهات الحديثة في هذا المجال.
    2. الفجوات والقصور المنهجي أو الموضوعي غير المكتشفة حتى الآن.
    3. مقترحات لعناوين أبحاث مستقبلية سداسية الأبعاد تسد هذه الفجوات.
    قدم الإجابة باللغة العربية الفصحى وبصياغة أكاديمية صارمة ودقيقة.`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      }),
    });

    const data = await response.json();

    if (data.candidates && data.candidates[0]?.content?.parts[0]?.text) {
      const gapsReport = data.candidates[0].content.parts[0].text;
      return NextResponse.json({ success: true, report: gapsReport });
    } else {
      return NextResponse.json({ success: false, error: 'فشل توليد تقرير الفجوات من نموذج Gemini' }, { status: 500 });
    }

  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || 'خطأ في الاتصال' }, { status: 500 });
  }
}
