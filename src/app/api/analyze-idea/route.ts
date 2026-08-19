import { NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { createClient as createSessionClient } from '@/lib/supabase/server';

const GEMINI_TIMEOUT_MS = 30000;
const GEMINI_MAX_ATTEMPTS = 2;

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

interface UnifiedPaper {
  title: string;
  year: number | null;
  citationCount: number;
  url: string | null;
  source: 'semanticscholar' | 'openalex' | 'both';
  authors?: string[];
  pdfUrl?: string | null;
}

async function fetchFromSemanticScholar(idea: string, limit: number): Promise<UnifiedPaper[]> {
  try {
    const apiKey = process.env.SEMANTIC_SCHOLAR_API_KEY;
    const url = `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(idea)}&limit=${limit}&fields=title,year,citationCount,url`;
    const response = await fetch(url, {
      headers: apiKey ? { 'x-api-key': apiKey } : {},
    });
    if (!response.ok) return [];
    const data = await response.json();
    return (data.data || []).map((p: Record<string, unknown>) => ({
      title: ((p.title as string) || 'عنوان غير متوفر').trim(),
      year: (p.year as number) || null,
      citationCount: (p.citationCount as number) || 0,
      url: (p.url as string) || null,
      source: 'semanticscholar' as const,
    }));
  } catch (err) {
    console.error('Semantic Scholar fetch failed:', err);
    return [];
  }
}

async function fetchFromOpenAlex(idea: string, limit: number): Promise<UnifiedPaper[]> {
  try {
    const email = process.env.OPENALEX_EMAIL || 'researcher@waha.ai';
    const url = `https://api.openalex.org/works?search=${encodeURIComponent(idea)}&per-page=${limit}`;
    const response = await fetch(url, {
      headers: { 'User-Agent': `WahaAcademicEngine/1.0 (mailto:${email})` },
    });
    if (!response.ok) return [];
    const data = await response.json();
    return (data.results || []).map((w: Record<string, unknown>) => {
      const openAccess = w.open_access as Record<string, unknown> | undefined;
      const authorships = (w.authorships as Array<Record<string, unknown>>) || [];
      return {
        title: ((w.title as string) || 'عنوان غير متوفر').trim(),
        year: (w.publication_year as number) || null,
        citationCount: (w.cited_by_count as number) || 0,
        url: (w.id as string) || null,
        source: 'openalex' as const,
        authors: authorships
          .map((a) => {
            const author = a.author as Record<string, unknown> | undefined;
            return (author?.display_name as string) || '';
          })
          .filter(Boolean),
        pdfUrl: (openAccess?.oa_url as string) || null,
      };
    });
  } catch (err) {
    console.error('OpenAlex fetch failed:', err);
    return [];
  }
}

function mergeAndRankPapers(
  semantic: UnifiedPaper[],
  openalex: UnifiedPaper[],
  finalCount: number
): UnifiedPaper[] {
  const normalize = (t: string) =>
    t.toLowerCase().replace(/[^\w\u0600-\u06FF]+/g, ' ').trim();

  const merged = new Map<string, UnifiedPaper>();

  for (const paper of [...semantic, ...openalex]) {
    const key = normalize(paper.title).substring(0, 80);
    if (!key) continue;
    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, paper);
    } else {
      const richer = (paper.pdfUrl || paper.authors?.length) ? paper : existing;
      merged.set(key, {
        ...richer,
        citationCount: Math.max(existing.citationCount, paper.citationCount),
        source: 'both',
      });
    }
  }

  const currentYear = new Date().getFullYear();

  const scored = Array.from(merged.values())
    .filter((p) => p.title && p.title !== 'عنوان غير متوفر')
    .map((p) => {
      const age = p.year ? Math.max(0, currentYear - p.year) : 20;
      const citationScore = Math.log1p(p.citationCount) * 10;
      const recencyScore = Math.max(0, 10 - age * 0.5);
      const crossSourceBonus = p.source === 'both' ? 5 : 0;
      return { paper: p, score: citationScore + recencyScore + crossSourceBonus };
    })
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, finalCount).map((x) => x.paper);
}

const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_SECONDS = 60;
const PAPERS_PER_SOURCE = 10;
const FINAL_PAPERS_COUNT = 5;

export async function POST(request: Request) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';

  const serviceClient = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: allowed, error: rateLimitError } = await serviceClient.rpc('check_rate_limit', {
    p_ip: ip,
    p_max_requests: RATE_LIMIT_MAX,
    p_window_seconds: RATE_LIMIT_WINDOW_SECONDS,
  });

  if (rateLimitError) {
    console.error('Rate limit check failed:', rateLimitError);
  } else if (allowed === false) {
    return NextResponse.json(
      { error: 'عدد كبير من الطلبات، حاول بعد دقيقة' },
      { status: 429 }
    );
  }

  try {
    const { idea } = await request.json();
    if (!idea) return NextResponse.json({ error: 'الفكرة مطلوبة' }, { status: 400 });

    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey) return NextResponse.json({ error: 'مفتاح API غير موجود' }, { status: 500 });

    const [semanticResults, openalexResults] = await Promise.all([
      fetchFromSemanticScholar(idea, PAPERS_PER_SOURCE),
      fetchFromOpenAlex(idea, PAPERS_PER_SOURCE),
    ]);

    const papers = mergeAndRankPapers(semanticResults, openalexResults, FINAL_PAPERS_COUNT);

    const papersEvidenceBlock = papers.length > 0
      ? `\n\nبيانات مرجعية حقيقية موثقة من قاعدتين أكاديميتين (Semantic Scholar + OpenAlex)، تم دمجها وترتيبها حسب جودة الاستشهاد والحداثة (${papers.length} أوراق):\n${papers
          .map((p, i) => {
            const sourceLabel =
              p.source === 'both'
                ? 'مؤكدة من المصدرين'
                : p.source === 'openalex'
                ? 'OpenAlex'
                : 'Semantic Scholar';
            const authorsPart =
              p.authors && p.authors.length > 0
                ? `، المؤلفون: ${p.authors.slice(0, 3).join(', ')}${p.authors.length > 3 ? ' وآخرون' : ''}`
                : '';
            return `${i + 1}. "${p.title}" (${p.year || 'سنة غير محددة'}, ${p.citationCount} استشهاد، ${sourceLabel}${authorsPart})`;
          })
          .join('\n')}\n\nإلزامي: يجب أن تشير في تحليلك إلى هذه الأوراق صراحة (بأرقامها من 1 إلى ${papers.length}) كأدلة داعمة. ممنوع تجاهلها أو الادعاء بعدم وجود أوراق. ممنوع اختلاق تفاصيل عن منهجية أو نتائج هذه الأوراق (لديك فقط: العنوان، السنة، الاستشهادات، المؤلفون). لا تضف أوراقاً أخرى من خارج هذه القائمة.`
      : `\n\nملاحظة مهمة: بحثنا في قاعدتي Semantic Scholar و OpenAlex ولم نجد أوراقاً ذات صلة كافية بهذه الفكرة تحديداً. اذكر ذلك في التحليل بشفافية، ولا تختلق أوراقاً أو دراسات وهمية.`;

    const response = await fetchGeminiWithRetry(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${geminiKey}`,
      JSON.stringify({
        contents: [{
          parts: [{
            text: `أنت "المشرف الأكاديمي الرقمي" في WAHA — خبير منهجية بحث علمي بخبرة تحكيم أكاديمي حقيقي، وليس مساعداً عاماً. المستخدم يكتب بحرية أياً مما يلي: فكرة بحثية جديدة، أو عنواناً رفضه مشرفه ويريد بديلاً، أو سؤالاً عن مدى ملاءمة عنوان لمرحلة دراسية معينة. افهم نوع الطلب من النص نفسه وتعامل معه بما يناسب.

معايير التقييم الإلزامية (طبّقها بدقة، وليس بشكل انطباعي، على الدرجات الثلاث):
- أقل من 30: خلل جوهري — لا يوجد أي متغير مسمّى إطلاقاً (لا مستقل ولا تابع)، أو النص ليس جملة بحثية أصلاً.
- 30–50: ضعيف لكن قابل للإصلاح — المتغيرات مسمّاة لكنها غير مُعرَّفة إجرائياً (مثل "الذكاء الاصطناعي" أو "التحصيل" بلا تحديد)، أو موضوع مشبع بحثياً بلا زاوية جديدة. إذا كان للفكرة متغير مستقل ومتغير تابع مسمّيان (حتى لو عامّين)، فلا تُنزلها إلى ما دون 30.
- 50–70: متوسط — المتغيرات واضحة لكن يحتاج تضييق نطاق أو توجيه منهجي.
- 70–85: جيد — متغيرات محددة، قابل للتنفيذ، يحتاج تحسينات طفيفة فقط.
- 85–100: ممتاز — محدد بدقة تامة (متغيرات + مجتمع + مكان واضحون)، أصيل، فجوة بحثية واضحة.
لا تعطِ فكرة غامضة درجة عالية في أي محور، ولا تعطِ فكرة محددة بدقة تامة درجة منخفضة.
لا تخفّض الدرجة بسبب وجود أدبيات عامة في مجال الفكرة إذا كانت الفكرة نفسها محددة بدقة تامة (متغيرات + مجتمع + مكان واضحونوقابلة للتنفيذ فعلياً) — التشبع البحثي في هذه الحالة يُذكر فقط كملاحظة إثرائية للتوجيه النظري، ولا يمنع الدرجة الإجمالية من الوصول إلى نطاق 85-100.

قواعد صارمة لكتابة diagnosis (يُمنع استخدام عبارات عامة فضفاضة مثل "الفكرة واسعة" بدون تفصيل):

يجب أن يذكر diagnosis دائماً وبشكل صريح، بغض النظر عن جودة الفكرة، كل العناصر التالية:
1. المتغير المستقل: ما هو تحديداً، أو سبب غيابه إن لم يكن محدداً.
2. المتغير التابع: ما هو تحديداً، أو سبب غيابه إن لم يكن محدداً.
3. مجتمع الدراسة: من بالتحديد (الفئة العمرية/التخصص/الشريحة).
4. المكان/السياق: أين تحديداً (الدولة/المؤسسة/النوع).
5. توجيه منهجي: نوع الدراسة الأنسب (تجريبية/شبه تجريبية/ارتباطية/تحليلية/نوعية...).

إذا كان الموضوع من المواضيع المشبعة بحثياً بشكل مفرط (مثل: الذكاء الاصطناعي في التعليم، وسائل التواصل الاجتماعي، التعلم الإلكتروني والتحصيل الدراسي بشكل عام): صرّح بذلك بعبارة وصفية عامة مثل "هذا الموضوع مشبع بالدراسات بشكل كبير في الأدبيات المتاحة"، دون ذكر أي رقم أو عدد دراسات محدد، لأنه لا تتوفر لديك بيانات فعلية للتحقق من أي رقم. ثم اقترح زاوية بحثية محددة لم تُستهلك بعد.

قاعدة صارمة وإلزامية: يُمنع منعاً باتاً ذكر أي رقم إحصائي (عدد دراسات، نسبة مئوية، عدد سنوات) أو اسم دراسة محددة أو اسم باحث أو عنوان دراسة فعلي ما لم تُزوَّد بها صراحة ضمن هذا الطلب كبيانات مرجعية حقيقية. عند عدم توفر بيانات، اكتفِ بوصف نوعي عام بدون أرقام أو أسماء مختلقة.

إذا كان النص عنواناً مرفوضاً: خمّن السبب الدقيق لرفض المشرف، ثم اقترح 3 بدائل مختلفة فعلياً عن بعضها — كل بديل بالصيغة الحرفية التالية بلا استثناء:
"أثر [IV محدد] على [DV محدد] لدى [مجتمع محدد] في [مكان محدد]: [نوع الدراسة]"

إذا كان سؤال ملاءمة لمرحلة دراسية: أجب صراحة نعم/لا مع السبب المنهجي الدقيق.

حالات خاصة:
- نص غير مفهوم/عشوائي: اجعل الدرجات الثلاث أقل من 15 واذكر بوضوح أنه غير قابل للتقييم أكاديمياً ولماذا تحديداً.
- خلل أكاديمي جوهري (تناقض منطقي، خلط متغيرات، استحالة قياس): اذكره صراحة كسبب رئيسي يمنع المتابعة قبل أي شيء آخر.

اكتب diagnosis كفقرة واحدة متماسكة بالعربية الفصحى الأكاديمية، بأسلوب مشرف خبير مباشر وحاسم، تغطي جميع العناصر الخمسة أعلاه دائماً. إذا توفرت أوراق مرجعية أدناه، ادمج الإشارة إليها ضمن التحليل بشكل طبيعي كأدلة داعمة (أشِر إلى أرقامها).

أجب بـ JSON فقط بدون أي نص إضافي أو markdown، بالشكل التالي (استبدل كل placeholder بتقييمك الفعلي):
{"clarityScore": <رقم من 0 إلى 100>, "feasibilityScore": <رقم من 0 إلى 100>, "applicabilityScore": <رقم من 0 إلى 100>, "diagnosis": "<فقرة تحليل أكاديمي خبير مفصلة>"}

النص المُدخل: "${idea}"${papersEvidenceBlock}`
          }]
        }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 2000
        }
      })
    );

    if (!response.ok) {
      const err = await response.text();
      console.error('Gemini error:', response.status, err);
      return NextResponse.json({ error: 'فشل التحليل الأكاديمي' }, { status: 500 });
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const clean = text.replace(/```json|```/g, '').trim();
    const analysisData = JSON.parse(clean);

    const reportScore = Math.round(
      ((analysisData.clarityScore || 0) +
       (analysisData.feasibilityScore || 0) +
       (analysisData.applicabilityScore || 0)) / 3
    );

    const sessionClient = await createSessionClient();
    const { data: { user } } = await sessionClient.auth.getUser();

    let saved = false;
    if (user) {
      await serviceClient.from('users_usage').insert({
        user_id: user.id,
        idea_text: idea,
        report_score: reportScore,
      });
      saved = true;
    }

    return NextResponse.json({
      success: true,
      data: { ...analysisData, reportScore },
      papers,
      saved,
    });

  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ error: 'فشل التحليل الأكاديمي' }, { status: 500 });
  }
}
