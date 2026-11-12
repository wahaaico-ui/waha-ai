import { NextResponse } from 'next/server';
import { requireAuthenticatedUser } from '@/lib/supabase/authorization';

interface LiteraturePaperInput {
  title?: unknown;
  authors?: unknown;
  year?: unknown;
  abstract?: unknown;
}

function printable(value: unknown): string {
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string').join('، ');
  return 'غير متوفر';
}

export async function POST(req: Request) {
  try {
    const access = await requireAuthenticatedUser();
    if (!access) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { papers } = await req.json();
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ success: false, error: 'هذه الخدمة غير متاحة الآن.' }, { status: 503 });
    }

    if (!papers || !Array.isArray(papers) || papers.length === 0) {
      return NextResponse.json({ success: false, error: 'الرجاء توفير أبحاث لتوليد مراجعة الأدبيات' }, { status: 400 });
    }

    const papersText = papers.map((paper: unknown, idx: number) => {
      const p = paper && typeof paper === 'object' ? paper as LiteraturePaperInput : {};
      return `
      البحث ${idx + 1}:
      العنوان: ${printable(p.title)}
      المؤلفون: ${printable(p.authors)}
      السنة: ${printable(p.year)}
      المستخلص: ${printable(p.abstract)}
    `;
    }).join('\n---\n');

    const prompt = `أنت أكاديمي وباحث رفيع المستوى في مناهج البحث العلمي. بناءً على الأبحاث التالية، قم بكتابة "فصل مراجعة أدبيات" (Literature Review) علمي، مترابط، ومتكامل باللغة العربية الفصحى.
    تجنب السرد المنفصل لكل بحث على حِدة، واعتمد أسلوب التخليق (Synthesis) القائم على دمج المحاور، المقارنة بين المنهجيات، وتسليط الضوء على الاتجاهات المشتركة والقصور.

    يجب أن يتضمن التقرير:
    1. مقدمة تحليلية للمجال البحثي العام.
    2. استعراض متكامل للمحاور الموضوعية المستخلصة من الأبحاث.
    3. تحديد الفجوات البحثية الكلية التي تشترك فيها هذه الدراسات.
    4. خاتمة تلخص الموقف المعرفي.

    الأبحاث المرفقة:
    ${papersText}

    صغ النص بصياغة أكاديمية رصينة ومهنية جاهزة للاستخدام البحثي.`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      }),
    });

    const data = await response.json();

    if (data.candidates && data.candidates[0]?.content?.parts[0]?.text) {
      return NextResponse.json({ success: true, review: data.candidates[0].content.parts[0].text });
    } else {
      return NextResponse.json({ success: false, error: 'فشل توليد مراجعة الأدبيات عبر نموذج Gemini' }, { status: 500 });
    }

  } catch (err: unknown) {
    console.error('/api/academic/literature-review failed', err);
    return NextResponse.json({ success: false, error: 'خطأ في الاتصال' }, { status: 500 });
  }
}
