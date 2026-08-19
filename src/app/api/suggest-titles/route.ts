import { NextResponse } from 'next/server';

const GEMINI_TIMEOUT_MS = 30000;
const GEMINI_MAX_ATTEMPTS = 2;

// Gemini occasionally times out or 429/5xxs under load; retry once with a fresh
// 30s budget before giving up, since a second attempt usually succeeds.
async function fetchGeminiWithRetry(url: string, body: string): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= GEMINI_MAX_ATTEMPTS; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        signal: controller.signal,
      });
      if (response.ok || (response.status !== 429 && response.status < 500)) {
        return response;
      }
      lastError = new Error(`Gemini responded ${response.status}`);
    } catch (err) {
      lastError = err;
    } finally {
      clearTimeout(timeout);
    }
  }
  throw lastError;
}

export async function POST(request: Request) {
  try {
    const { idea } = await request.json();
    if (!idea) return NextResponse.json({ error: 'الفكرة مطلوبة' }, { status: 400 });

    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey) return NextResponse.json({ error: 'مفتاح API غير موجود' }, { status: 500 });

    // gemini-3.6-flash hits its free-tier daily quota (20 requests/day/project) almost
    // immediately in practice; gemini-3.1-flash-lite has a separate, much larger quota.
    const response = await fetchGeminiWithRetry(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${geminiKey}`,
      JSON.stringify({
        contents: [{
          parts: [{
            text: `أنت خبير منهجية بحث أكاديمي. اقترح 3 عناوين بحثية أكاديمية احترافية لهذه الفكرة، بحيث:
- كل عنوان يتضمن بوضوح: المتغير المستقل + المتغير التابع + المجتمع/الفئة المستهدفة + المكان (دولة/مؤسسة/سياق محدد).
- الصيغة المرجعية: "أثر [المتغير المستقل] على [المتغير التابع] لدى [المجتمع] في [المكان]: دراسة [نوع المنهج، مثل: تحليلية/ميدانية/مقارنة]".
- الثلاثة عناوين يجب أن تمثل 3 زوايا بحثية مختلفة فعلياً (متغيرات أو مجتمعات أو مناهج مختلفة)، وليست صياغات متشابهة لنفس الفكرة.
- ممنوع العناوين العامة أو الفضفاضة بدون تحديد واضح للعناصر الأربعة أعلاه.

أجب بـ JSON فقط بدون أي نص إضافي أو markdown بالشكل التالي:
{"titles": ["عنوان 1", "عنوان 2", "عنوان 3"]}

الفكرة: "${idea}"`
          }]
        }],
        generationConfig: {
          temperature: 0.5,
          maxOutputTokens: 2000
        }
      })
    );

    if (!response.ok) {
      const err = await response.text();
      console.error('Gemini titles error:', response.status, err);
      return NextResponse.json({ error: 'فشل اقتراح العناوين' }, { status: 500 });
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const clean = text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);

    return NextResponse.json({ success: true, titles: parsed.titles || [] });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ error: 'فشل اقتراح العناوين' }, { status: 500 });
  }
}
