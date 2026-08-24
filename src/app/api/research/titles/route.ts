import { NextResponse } from 'next/server';
import { ownsProject, requireAuthenticatedUser } from '@/lib/supabase/authorization';
import { filterRelevantPapers, type EvidencePaper, type ResearchPath, type ResearcherContext } from '@/lib/research-exploration';
import { evaluateTitleCandidate, recommendedTitle } from '@/lib/title-comparison';

type VerificationOutput = {
  topic?: unknown;
  researchPaths?: unknown;
  selectedResearchPath?: unknown;
  researcherContext?: unknown;
};

type OpenAlexWork = {
  title?: string;
  abstract_inverted_index?: Record<string, number[]>;
  publication_year?: number;
  cited_by_count?: number;
  doi?: string;
  authorships?: Array<{ institutions?: Array<{ country_code?: string }> }>;
  primary_location?: { source?: { display_name?: string } };
};

function parseVerification(content: string | null): VerificationOutput | null {
  if (!content) return null;
  try {
    const parsed: unknown = JSON.parse(content);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as VerificationOutput : null;
  } catch {
    return null;
  }
}

function asResearcherContext(value: unknown): ResearcherContext {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { countryCode: null, countryName: null, specialty: null, university: null, level: null };
  }
  const context = value as Record<string, unknown>;
  const text = (field: string) => typeof context[field] === 'string' && context[field].trim() ? context[field].trim() : null;
  return {
    countryCode: text('countryCode'),
    countryName: text('countryName'),
    specialty: text('specialty'),
    university: text('university'),
    level: text('level'),
  };
}

function titleCandidates(bodyTitles: unknown, verification: VerificationOutput) {
  if (Array.isArray(bodyTitles)) {
    const cleaned = bodyTitles
      .filter((title): title is string => typeof title === 'string')
      .map((title) => title.trim())
      .filter((title) => title.length >= 10 && title.length <= 300);
    if (cleaned.length >= 2 && cleaned.length <= 4) return [...new Set(cleaned)];
  }

  if (!Array.isArray(verification.researchPaths)) return [];
  const paths = verification.researchPaths as ResearchPath[];
  const selectedId = verification.selectedResearchPath && typeof verification.selectedResearchPath === 'object'
    ? (verification.selectedResearchPath as { id?: unknown }).id
    : null;
  return [...paths].sort((first, second) => Number(second.id === selectedId) - Number(first.id === selectedId))
    .map((path) => typeof path?.title === 'string' ? path.title.trim() : '')
    .filter((title) => title.length >= 10 && title.length <= 300)
    .slice(0, 3);
}

function restoreAbstract(index: Record<string, number[]> | undefined) {
  if (!index) return '';
  const words: Record<number, string> = {};
  Object.entries(index).forEach(([word, positions]) => positions.forEach((position) => { words[position] = word; }));
  return Object.keys(words).sort((a, b) => Number(a) - Number(b)).map((position) => words[Number(position)]).join(' ');
}

async function searchOpenAlex(title: string): Promise<{ available: boolean; papers: EvidencePaper[] }> {
  const email = process.env.OPENALEX_EMAIL;
  const mailto = email ? `&mailto=${encodeURIComponent(email)}` : '';
  const response = await fetch(
    `https://api.openalex.org/works?search=${encodeURIComponent(title)}&per-page=20&select=title,abstract_inverted_index,publication_year,cited_by_count,doi,authorships,primary_location${mailto}`,
    { signal: AbortSignal.timeout(15_000) },
  );
  if (!response.ok) return { available: false, papers: [] };
  const payload = await response.json() as { results?: OpenAlexWork[] };
  const candidates: EvidencePaper[] = (payload.results || []).map((work) => ({
    title: work.title || '',
    abstract: restoreAbstract(work.abstract_inverted_index),
    year: work.publication_year || 0,
    citations: work.cited_by_count || 0,
    url: work.doi ? `https://doi.org/${work.doi.replace('https://doi.org/', '')}` : '',
    source: 'openalex',
    venue: work.primary_location?.source?.display_name || '',
    countries: [...new Set((work.authorships || []).flatMap((authorship) => (authorship.institutions || []).map((institution) => institution.country_code).filter((code): code is string => Boolean(code))))],
  }));
  return { available: true, papers: filterRelevantPapers(candidates, [title]) };
}

export async function POST(request: Request) {
  try {
    const access = await requireAuthenticatedUser();
    if (!access) return NextResponse.json({ error: 'يجب تسجيل الدخول لمقارنة العناوين داخل مشروعك.' }, { status: 401 });

    const body: unknown = await request.json();
    if (!body || typeof body !== 'object' || Array.isArray(body)) return NextResponse.json({ error: 'طلب غير صالح.' }, { status: 400 });
    const { projectId, candidateTitles } = body as { projectId?: unknown; candidateTitles?: unknown };
    if (typeof projectId !== 'string' || !projectId.trim()) return NextResponse.json({ error: 'معرّف المشروع مطلوب.' }, { status: 400 });
    if (!(await ownsProject(projectId, access.user.id, access.supabase))) return NextResponse.json({ error: 'المشروع غير موجود.' }, { status: 404 });

    const { data: documents, error: documentsError } = await access.supabase
      .from('documents')
      .select('type, content, version, created_at')
      .eq('project_id', projectId)
      .in('type', ['journey:verify', 'idea_verification'])
      .order('created_at', { ascending: false });
    if (documentsError) throw documentsError;

    const verificationDocument = (documents || []).find((document) => document.type === 'journey:verify')
      || (documents || []).find((document) => document.type === 'idea_verification');
    const verification = parseVerification(verificationDocument?.content || null);
    if (!verification) return NextResponse.json({ error: 'أكمل استكشاف الفكرة واحفظه قبل مقارنة العناوين.' }, { status: 409 });
    if (!verification.selectedResearchPath || typeof verification.selectedResearchPath !== 'object') {
      return NextResponse.json({ error: 'اختر مساراً بحثياً واعتمده قبل مقارنة العناوين.' }, { status: 409 });
    }

    const titles = titleCandidates(candidateTitles, verification);
    if (titles.length < 2) return NextResponse.json({ error: 'يلزم عنوانان صالحان على الأقل للمقارنة.' }, { status: 400 });

    const searches = await Promise.all(titles.map((title) => searchOpenAlex(title).catch(() => ({ available: false, papers: [] }))));
    const context = asResearcherContext(verification.researcherContext);
    const currentYear = new Date().getFullYear();
    const comparisons = titles.map((title, index) => evaluateTitleCandidate(`title-${index + 1}`, title, searches[index].papers, context.countryName, currentYear));
    const recommendation = recommendedTitle(comparisons);

    return NextResponse.json({
      success: true,
      topic: typeof verification.topic === 'string' ? verification.topic : null,
      comparisons,
      recommendedId: recommendation?.id || null,
      sourceStatus: {
        source: 'OpenAlex',
        availableForAllTitles: searches.every((search) => search.available),
        checkedAt: new Date().toISOString(),
        note: 'عدد الدراسات هو عدد النتائج ذات الصلة داخل أول 20 نتيجة مسترجعة لكل عنوان، وليس إجمالي كل ما نُشر عالمياً.',
      },
    });
  } catch {
    return NextResponse.json({ error: 'تعذر إكمال مقارنة العناوين حالياً.' }, { status: 500 });
  }
}
