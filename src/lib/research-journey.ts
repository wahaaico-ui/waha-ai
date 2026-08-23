export const RESEARCH_JOURNEY_KEY = 'waha_active_journey';

export type ResearchMethodology = {
  approach: string;
  population: string;
  sample: string;
  instrument: string;
};

export type JourneyPaper = {
  id: string;
  title: string;
  authors: string;
  year: number | string;
  citationCount: number;
  abstract: string;
  source: string;
  pdfUrl?: string | null;
};

export type ResearchJourney = {
  topic?: string;
  decision?: 'reject' | 'improve' | 'proceed';
  acceptanceScore?: number;
  selectedTitle?: string;
  problemStatement?: string;
  researchGap?: string;
  objectives?: string[];
  questions?: string[];
  methodology?: ResearchMethodology;
  selectedPapers?: JourneyPaper[];
  updatedAt?: string;
};

export type JourneyStage = 'verify' | 'title' | 'problem' | 'objectives' | 'questions' | 'methodology' | 'literature' | 'analysis';

export type ServerJourneyGate = {
  status: 'open' | 'needs_improvement' | 'locked';
  stage: JourneyStage;
  reason: string;
  nextStage: JourneyStage | null;
};

export async function saveJourneyStage(projectId: string, stage: JourneyStage, content: Record<string, unknown>) {
  const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/journey`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ stage, content }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.gate?.reason || data.error || 'تعذر حفظ مرحلة البحث');
  return data as { success: true; gate: ServerJourneyGate; nextStage: JourneyStage | null };
}

export async function loadJourney(projectId: string) {
  const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/journey`, { cache: 'no-store' });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'تعذر تحميل المشروع');
  return data as { outputs: Partial<Record<JourneyStage, Record<string, unknown>>>; nextStage: JourneyStage | null; gate: ServerJourneyGate | null };
}

export const JOURNEY_STAGES: Array<{ id: JourneyStage; title: string; href: string }> = [
  { id: 'verify', title: 'استكشاف المسار', href: '/verify-idea' },
  { id: 'title', title: 'صياغة العنوان', href: '/research' },
  { id: 'problem', title: 'مشكلة البحث', href: '/research/problem' },
  { id: 'objectives', title: 'الأهداف', href: '/research/objectives' },
  { id: 'questions', title: 'أسئلة البحث', href: '/research/questions' },
  { id: 'methodology', title: 'المنهجية', href: '/research/methodology' },
  { id: 'literature', title: 'الأدبيات', href: '/research/literature' },
  { id: 'analysis', title: 'التحليل', href: '/research/analysis' },
];

export function readJourney(): ResearchJourney | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(RESEARCH_JOURNEY_KEY);
    return raw ? JSON.parse(raw) as ResearchJourney : null;
  } catch {
    return null;
  }
}

export function stageIsComplete(journey: ResearchJourney | null, stage: JourneyStage): boolean {
  if (!journey) return false;
  switch (stage) {
    case 'verify': return journey.decision === 'proceed';
    case 'title': return Boolean(journey.selectedTitle);
    case 'problem': return Boolean(journey.problemStatement && journey.researchGap);
    case 'objectives': return (journey.objectives?.length || 0) >= 2;
    case 'questions': return (journey.questions?.length || 0) >= 2;
    case 'methodology': return Boolean(journey.methodology?.approach && journey.methodology.population && journey.methodology.sample && journey.methodology.instrument);
    case 'literature': return (journey.selectedPapers?.length || 0) >= 3;
    case 'analysis': return false;
  }
}

export function nextJourneyStage(journey: ResearchJourney | null): JourneyStage {
  return JOURNEY_STAGES.find((stage) => !stageIsComplete(journey, stage.id))?.id || 'analysis';
}
