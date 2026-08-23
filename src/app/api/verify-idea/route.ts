import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAuthenticatedUser } from '@/lib/supabase/authorization';

// ============================================================
// TYPES
// ============================================================
interface Paper {
  title: string;
  abstract: string;
  year: number;
  citations: number;
  url: string;
  source: 'semanticscholar' | 'openalex' | 'both';
  authors?: string[];
  venue?: string;
  countries?: string[];
}

interface VerifyReport {
  topic: string;
  translatedQuery?: string;
  totalPapers: number;
  yearDistribution: { year: number; count: number }[];
  geographicDistribution: { region: string; count: number }[];
  methodologyDistribution: { type: string; count: number }[];
  gaps: string[];
  acceptanceScore: number;
  scoreBreakdown: {
    gapExists: number;
    recency: number;
    methodDiversity: number;
    geoDiversity: number;
    sufficientRefs: number;
    consistency: number;
  };
  decision: 'reject' | 'improve' | 'proceed';
  decisionMessage: string;
  alternativeAngles?: string[];
  improvements?: string[];
  topPapers: Paper[];
}

// ============================================================
// TRANSLATE ARABIC TOPIC TO ENGLISH ACADEMIC QUERY
// ============================================================
function isArabic(text: string): boolean {
  return /[؀-ۿ]/.test(text);
}

interface QueryPlan {
  isValid: boolean;
  queries: string[];  // 1-3 English search queries at different scopes
}

async function planSearchQueries(userTopic: string): Promise<QueryPlan> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { isValid: true, queries: [userTopic] };

  const prompt = `You are an academic search strategist. Analyze this research topic and produce a JSON plan.

TOPIC: ${userTopic}

Rules:
1. First decide: is this a GENUINE research topic (has a subject, even if broad)?
   - Reject only: gibberish, repeated random letters (لللنن), promotional text, or empty input.
   - A single meaningful word like "التعليم" or "diabetes" IS valid — accept it.
   - An academic sentence in any language IS valid — accept it.

2. If valid, produce THREE English search queries at different scopes:
   - FULL: full academic translation (7-12 words)
   - FOCUSED: core variables only (3-5 words)  
   - BROAD: main concept only (1-3 words)

Return ONLY valid JSON, no markdown, no explanation:
{"valid": true, "full": "...", "focused": "...", "broad": "..."}

Or for invalid input:
{"valid": false}

JSON:`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 200, responseMimeType: 'application/json' },
        }),
        signal: AbortSignal.timeout(12000),
      }
    );
    if (!res.ok) return { isValid: true, queries: [userTopic] };
    const data = await res.json();
    const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
    // Strip any markdown fences just in case
    const clean = raw.replace(/^```json\s*|```\s*$/g, '').trim();
    const parsed = JSON.parse(clean);
    if (parsed.valid === false) return { isValid: false, queries: [] };
    const queries: string[] = [];
    if (parsed.full && typeof parsed.full === 'string') queries.push(parsed.full);
    if (parsed.focused && typeof parsed.focused === 'string' && parsed.focused !== parsed.full) queries.push(parsed.focused);
    if (parsed.broad && typeof parsed.broad === 'string' && parsed.broad !== parsed.focused && parsed.broad !== parsed.full) queries.push(parsed.broad);
    if (queries.length === 0) queries.push(userTopic);
    return { isValid: true, queries };
  } catch {
    // On any parse/network error, fail open: treat as valid, use original topic
    return { isValid: true, queries: [userTopic] };
  }
}

// Backward-compatible wrapper (in case anything still references old name)
// Backward-compatible wrapper — delegates to planSearchQueries
async function translateToAcademicEnglish(arabicTopic: string): Promise<string> {
  const plan = await planSearchQueries(arabicTopic);
  if (!plan.isValid) return 'INVALID';
  return plan.queries[0] || arabicTopic;
}

// ============================================================
// SOURCE FETCHERS (with API keys for higher limits)
// ============================================================
async function fetchSemanticScholar(query: string, limit = 20): Promise<Paper[]> {
  const url = `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(query)}&limit=${limit}&fields=title,abstract,year,citationCount,url,authors,venue`;
  const headers: Record<string, string> = {};
  const apiKey = process.env.SEMANTIC_SCHOLAR_API_KEY;
  if (apiKey) headers['x-api-key'] = apiKey;

  try {
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(15000) });
    if (!res.ok) return [];
    const data = await res.json();
    if (!data.data) return [];
    return data.data.map((p: any) => ({
      title: p.title || '',
      abstract: p.abstract || '',
      year: p.year || 0,
      citations: p.citationCount || 0,
      url: p.url || '',
      source: 'semanticscholar' as const,
      authors: (p.authors || []).map((a: any) => a.name).filter(Boolean),
      venue: p.venue || '',
    }));
  } catch {
    return [];
  }
}

async function fetchOpenAlex(query: string, limit = 20): Promise<Paper[]> {
  const email = process.env.OPENALEX_EMAIL;
  const mailtoParam = email ? `&mailto=${encodeURIComponent(email)}` : '';
  const url = `https://api.openalex.org/works?search=${encodeURIComponent(query)}&per-page=${limit}&select=title,abstract_inverted_index,publication_year,cited_by_count,doi,authorships,primary_location${mailtoParam}`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) return [];
    const data = await res.json();
    if (!data.results) return [];
    return data.results.map((p: any) => {
      let abstract = '';
      if (p.abstract_inverted_index) {
        const words: { [pos: number]: string } = {};
        for (const [word, positions] of Object.entries(p.abstract_inverted_index)) {
          for (const pos of positions as number[]) {
            words[pos] = word;
          }
        }
        abstract = Object.keys(words).sort((a, b) => Number(a) - Number(b)).map(k => words[Number(k)]).join(' ');
      }
      const countries: string[] = [];
      (p.authorships || []).forEach((a: any) => {
        (a.institutions || []).forEach((inst: any) => {
          if (inst.country_code) countries.push(inst.country_code);
        });
      });
      return {
        title: p.title || '',
        abstract: abstract,
        year: p.publication_year || 0,
        citations: p.cited_by_count || 0,
        url: p.doi ? `https://doi.org/${p.doi.replace('https://doi.org/', '')}` : '',
        source: 'openalex' as const,
        authors: (p.authorships || []).map((a: any) => a.author?.display_name).filter(Boolean),
        venue: p.primary_location?.source?.display_name || '',
        countries: [...new Set(countries)],
      };
    });
  } catch {
    return [];
  }
}

// ============================================================
// MERGE + DEDUPE
// ============================================================
function normalizeTitle(t: string): string {
  return t.toLowerCase().replace(/[^a-z؀-ۿ0-9\s]/g, '').replace(/\s+/g, ' ').trim();
}

function mergePapers(...lists: Paper[][]): Paper[] {
  const seen = new Map<string, Paper>();
  for (const list of lists) {
    for (const p of list) {
      if (!p.title) continue;
      const key = normalizeTitle(p.title);
      if (!key) continue;
      if (seen.has(key)) {
        const existing = seen.get(key)!;
        seen.set(key, { ...existing, source: 'both', countries: p.countries || existing.countries });
      } else {
        seen.set(key, p);
      }
    }
  }
  return Array.from(seen.values());
}

// ============================================================
// SCORING (transparent formula from Waha document)
// ============================================================
function computeScore(papers: Paper[], currentYear: number): {
  score: number;
  breakdown: VerifyReport['scoreBreakdown'];
  gaps: string[];
  yearDist: { year: number; count: number }[];
  geoDist: { region: string; count: number }[];
} {
  const gaps: string[] = [];

  const yearMap = new Map<number, number>();
  papers.forEach(p => {
    if (p.year > 0) yearMap.set(p.year, (yearMap.get(p.year) || 0) + 1);
  });
  const yearDist = Array.from(yearMap.entries())
    .map(([year, count]) => ({ year, count }))
    .sort((a, b) => b.year - a.year);

  const recentCount = papers.filter(p => p.year >= currentYear - 3).length;
  const recentRatio = papers.length > 0 ? recentCount / papers.length : 0;

  const geoMap = new Map<string, number>();
  papers.forEach(p => {
    (p.countries || []).forEach(c => geoMap.set(c, (geoMap.get(c) || 0) + 1));
  });
  const geoDist = Array.from(geoMap.entries())
    .map(([region, count]) => ({ region, count }))
    .sort((a, b) => b.count - a.count);

  const arabCountries = ['SA', 'EG', 'JO', 'AE', 'KW', 'OM', 'QA', 'BH', 'LB', 'IQ', 'SY', 'YE', 'PS', 'MA', 'DZ', 'TN', 'LY', 'SD'];
  const arabPapers = papers.filter(p => (p.countries || []).some(c => arabCountries.includes(c))).length;
  const arabRatio = papers.length > 0 ? arabPapers / papers.length : 0;

  const breakdown = {
    gapExists: 0,
    recency: 0,
    methodDiversity: 0,
    geoDiversity: 0,
    sufficientRefs: 0,
    consistency: 0,
  };

  if (papers.length === 0) {
    breakdown.gapExists = 25;
    gaps.push('لا توجد دراسات مباشرة في هذا الموضوع — فرصة بحثية واسعة، لكن تحقق أن الفكرة قابلة للبحث فعلاً');
  } else if (papers.length < 10) {
    breakdown.gapExists = 22;
    gaps.push(`عدد محدود من الدراسات (${papers.length}) — فرصة جيدة لسدّ فجوة`);
  } else if (papers.length < 30) {
    breakdown.gapExists = 15;
  } else if (papers.length < 100) {
    breakdown.gapExists = 8;
  } else {
    breakdown.gapExists = 3;
    gaps.push(`عدد كبير من الدراسات (${papers.length}) — الموضوع مشبع، فكّر في زاوية أضيق أو سياق مختلف`);
  }

  if (recentRatio >= 0.5) breakdown.recency = 20;
  else if (recentRatio >= 0.3) breakdown.recency = 15;
  else if (recentRatio >= 0.15) breakdown.recency = 10;
  else if (recentRatio > 0) breakdown.recency = 5;
  else {
    breakdown.recency = 2;
    gaps.push('لا توجد دراسات حديثة (آخر 3 سنوات) — قد يكون الموضوع خامداً أو تحتاج مصادر أوسع');
  }

  const abstracts = papers.map(p => (p.abstract || '').toLowerCase()).join(' ');
  const methodKeywords = {
    quantitative: /quantitative|survey|statistic|regression|correlation|كمي|استبانة|إحصائ/,
    qualitative: /qualitative|interview|ethnograph|case study|نوعي|مقابلة|دراسة حالة/,
    mixed: /mixed method|mixed-method|مختلط/,
    experimental: /experiment|trial|randomized|تجريب|تجربة/,
  };
  let methodsFound = 0;
  Object.values(methodKeywords).forEach(regex => { if (regex.test(abstracts)) methodsFound++; });
  breakdown.methodDiversity = Math.min(20, methodsFound * 5);
  if (methodsFound <= 1 && papers.length > 5) {
    gaps.push('غالبية الدراسات تستخدم منهجية واحدة — فرصة لمنهجية مختلفة');
  }

  if (geoDist.length >= 10) breakdown.geoDiversity = 10;
  else if (geoDist.length >= 5) breakdown.geoDiversity = 7;
  else if (geoDist.length >= 2) breakdown.geoDiversity = 4;
  else breakdown.geoDiversity = 2;
  if (arabRatio < 0.1 && papers.length > 5) {
    breakdown.geoDiversity = Math.min(15, breakdown.geoDiversity + 5);
    gaps.push('تمثيل ضعيف للسياق العربي — فرصة قوية للباحث العربي');
  } else if (arabRatio < 0.2) {
    breakdown.geoDiversity = Math.min(15, breakdown.geoDiversity + 3);
    gaps.push('تمثيل محدود للسياق العربي');
  }

  if (papers.length >= 10) breakdown.sufficientRefs = 10;
  else if (papers.length >= 5) breakdown.sufficientRefs = 7;
  else if (papers.length >= 2) breakdown.sufficientRefs = 4;
  else breakdown.sufficientRefs = 1;

  const avgCitations = papers.length > 0 ? papers.reduce((sum, p) => sum + p.citations, 0) / papers.length : 0;
  if (avgCitations >= 20) breakdown.consistency = 10;
  else if (avgCitations >= 10) breakdown.consistency = 7;
  else if (avgCitations >= 3) breakdown.consistency = 5;
  else breakdown.consistency = 3;

  const score = Object.values(breakdown).reduce((a, b) => a + b, 0);

  return { score, breakdown, gaps, yearDist, geoDist };
}

// ============================================================
// DECISION LOGIC
// ============================================================
function makeDecision(score: number, gaps: string[]): {
  decision: VerifyReport['decision'];
  message: string;
  alternatives?: string[];
  improvements?: string[];
} {
  if (score < 30) {
    return {
      decision: 'reject',
      message: 'الفكرة بصيغتها الحالية ضعيفة أكاديمياً. لا نوصي بالاستثمار فيها كما هي. راجع الزوايا البديلة أدناه.',
      alternatives: [
        'ركّز على سياق عربي أو خليجي محدد بدل السياق العام',
        'ادمج متغيراً حديثاً (تقنية، ذكاء اصطناعي، جائحة، تحول رقمي) مع الفكرة الأساسية',
        'انتقل من دراسة كمّية إلى دراسة نوعية معمّقة لعدد أصغر من الحالات',
      ],
    };
  }
  if (score < 60) {
    return {
      decision: 'improve',
      message: 'الفكرة تحمل إمكانية، لكنها تحتاج تحسينات قبل الاعتماد. طبّق المقترحات ثم أعد الفحص.',
      improvements: [
        gaps[0] || 'راجع الفجوات المكتشفة أعلاه وحاول تضييق النطاق',
        'حدّد سياقاً جغرافياً أو منهجياً واضحاً يميّز فكرتك',
        'ابحث عن متغير وسيط أو معدّل يعطي الفكرة عمقاً إضافياً',
      ],
    };
  }
  return {
    decision: 'proceed',
    message: 'الفكرة قوية وتستحق الاستثمار. يمكنك الانتقال إلى صياغة العنوان.',
  };
}

// ============================================================
// RATE LIMITING
// ============================================================
async function checkRateLimit(ip: string): Promise<boolean> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) return true;
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { data, error } = await supabase.rpc('check_rate_limit', {
      p_ip: ip,
      p_max_requests: 5,
      p_window_seconds: 60,
    });
    if (error) return true;
    return data === true;
  } catch {
    return true;
  }
}


// ============================================================
// SAVE VERIFICATION TO DATABASE (non-blocking)
// ============================================================
async function countUserVerifications(ip: string): Promise<number> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) return 0;
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { count, error } = await supabase
      .from('idea_verifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_ip', ip);
    if (error) return 0;
    return count || 0;
  } catch {
    return 0;
  }
}

async function saveVerification(
  ip: string,
  topic: string,
  translatedQuery: string | undefined,
  score: number,
  decision: string,
  totalPapers: number,
  gapsCount: number,
  userId: string | null
): Promise<void> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) return;
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    await supabase.from('idea_verifications').insert({
      user_ip: ip,
      topic,
      translated_query: translatedQuery || null,
      acceptance_score: score,
      decision,
      total_papers: totalPapers,
      gaps_count: gapsCount,
      user_id: userId,
    });
  } catch {
    // Silent fail — saving is not critical for the response
  }
}

// ============================================================
// AUTHENTICATED PROJECT PERSISTENCE
// ============================================================
// A visitor may explore anonymously. When an authenticated researcher gets a
// successful response, however, their work must have a server-side project
// before they continue into the research journey. This uses the cookie-bound
// Supabase client, so RLS enforces that every row belongs to that user.
async function persistAuthenticatedVerification(
  report: VerifyReport,
  access: Awaited<ReturnType<typeof requireAuthenticatedUser>>
): Promise<string | null> {
  if (!access) return null;

  const { supabase, user } = access;
  const { data: existingProject, error: existingProjectError } = await supabase
    .from('projects')
    .select('id')
    .eq('user_id', user.id)
    .eq('title', report.topic)
    .eq('status', 'draft')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingProjectError) return null;

  const { data: project, error: projectError } = existingProject
    ? { data: existingProject, error: null }
    : await supabase
      .from('projects')
      .insert({ user_id: user.id, title: report.topic, status: 'draft' })
      .select('id')
      .single();

  if (projectError || !project) return null;

  const { data: latestDocument, error: latestDocumentError } = await supabase
    .from('documents')
    .select('version')
    .eq('project_id', project.id)
    .eq('type', 'idea_verification')
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestDocumentError) return null;

  const { error: documentError } = await supabase.from('documents').insert({
    project_id: project.id,
    type: 'idea_verification',
    content: JSON.stringify(report),
    version: (latestDocument?.version || 0) + 1,
  });

  return documentError ? null : project.id;
}

// ============================================================
// MAIN HANDLER
// ============================================================
export async function POST(request: Request) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown';

  const allowed = await checkRateLimit(ip);
  if (!allowed) {
    return NextResponse.json({ error: 'تجاوزت الحد المسموح. حاول بعد دقيقة.' }, { status: 429 });
  }

  try {
    const body = await request.json();
    const topic = (body.topic || '').trim();
    if (!topic || topic.length < 5) {
      return NextResponse.json({ error: 'الرجاء إدخال موضوع بحثي واضح (5 أحرف على الأقل)' }, { status: 400 });
    }
    if (topic.length > 500) {
      return NextResponse.json({ error: 'الموضوع طويل جداً. اختصره إلى فكرة عامة، ليس عنواناً طويلاً.' }, { status: 400 });
    }

    // Smart query planning via Gemini: validity gate + multi-scope queries
    const plan = await planSearchQueries(topic);
    if (!plan.isValid) {
      const isAr = isArabic(topic);
      return NextResponse.json({
        error: isAr
          ? 'الموضوع الذي أدخلته لا يبدو موضوعاً بحثياً حقيقياً. الرجاء إدخال فكرة بحثية واضحة (مثل: أثر التعلم الإلكتروني على التحصيل الدراسي).'
          : 'The input does not appear to be a genuine research topic. Please enter a clear research idea.',
      }, { status: 400 });
    }

    // Build query set: original topic + all English variants from the plan
    const englishQuery: string | undefined = plan.queries[0];
    const queries: string[] = [topic];
    for (const q of plan.queries) {
      if (q && q !== topic && !queries.includes(q)) queries.push(q);
    }

    // Fetch from both sources for each query in parallel
    const fetchPromises: Promise<Paper[]>[] = [];
    for (const q of queries) {
      fetchPromises.push(fetchSemanticScholar(q, 20));
      fetchPromises.push(fetchOpenAlex(q, 20));
    }
    const results = await Promise.all(fetchPromises);
    const merged = mergePapers(...results);

    const currentYear = new Date().getFullYear();
    const { score, breakdown, gaps, yearDist, geoDist } = computeScore(merged, currentYear);
    const decision = makeDecision(score, gaps);

    const topPapers = [...merged]
      .sort((a, b) => {
        const scoreA = Math.log1p(a.citations) * 10 + Math.max(0, 10 - (currentYear - a.year) * 0.5) + (a.source === 'both' ? 5 : 0);
        const scoreB = Math.log1p(b.citations) * 10 + Math.max(0, 10 - (currentYear - b.year) * 0.5) + (b.source === 'both' ? 5 : 0);
        return scoreB - scoreA;
      })
      .slice(0, 5);

    const report: VerifyReport = {
      topic,
      translatedQuery: englishQuery,
      totalPapers: merged.length,
      yearDistribution: yearDist.slice(0, 10),
      geographicDistribution: geoDist.slice(0, 10),
      methodologyDistribution: [],
      gaps,
      acceptanceScore: score,
      scoreBreakdown: breakdown,
      decision: decision.decision,
      decisionMessage: decision.message,
      alternativeAngles: decision.alternatives,
      improvements: decision.improvements,
      topPapers,
    };

    // Resolve the session once. The same server-verified identity is used for
    // project persistence and for the verification-history ownership field.
    const access = await requireAuthenticatedUser();

    // Save verification asynchronously (do not await — non-blocking). Guests
    // retain the anonymous freemium flow, while authenticated records receive
    // an owner for RLS-protected history.
    saveVerification(
      ip,
      topic,
      englishQuery,
      score,
      decision.decision,
      merged.length,
      gaps.length,
      access?.user.id || null
    ).catch(() => {});

    // Persist an authenticated researcher's output before returning the next
    // journey link. Anonymous visitors deliberately keep the existing local
    // exploration flow and never receive a project id.
    const projectId = await persistAuthenticatedVerification(report, access);

    // Freemium: compute usage info based on IP history
    const usageCount = await countUserVerifications(ip);
    const FREE_LIMIT = 3;
    const reportWithUsage = {
      ...report,
      usageInfo: {
        count: usageCount + 1,
        limit: FREE_LIMIT,
        isFirstCheck: usageCount === 0,
        isBlurred: usageCount >= 1 && usageCount < FREE_LIMIT,
        isBlocked: usageCount >= FREE_LIMIT,
        projectId,
      },
    };

    return NextResponse.json(reportWithUsage);
  } catch (err: any) {
    return NextResponse.json(
      { error: 'حدث خطأ أثناء الفحص. حاول مرة أخرى.', details: err?.message || String(err) },
      { status: 500 }
    );
  }
}
