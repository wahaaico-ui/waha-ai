import type { ResearchConsistencyReport, ResearchObjectViewWarning } from '@/lib/research-objects/types';

export type JourneyStage = 'verify' | 'title' | 'problem' | 'objectives' | 'questions' | 'hypotheses' | 'methodology' | 'design' | 'instrument' | 'literature' | 'analysis' | 'analysis_input' | 'results' | 'discussion' | 'conclusions' | 'recommendations' | 'publication';

export type ServerJourneyGate = {
  status: 'open' | 'needs_improvement' | 'locked';
  stage: JourneyStage;
  reason: string;
  nextStage: JourneyStage | null;
};

export class JourneyStageSaveError extends Error {
  consistency: ResearchConsistencyReport | null;
  consistencyWarnings: ResearchObjectViewWarning[];

  constructor(
    message: string,
    consistency: ResearchConsistencyReport | null = null,
    consistencyWarnings: ResearchObjectViewWarning[] = [],
  ) {
    super(message);
    this.name = 'JourneyStageSaveError';
    this.consistency = consistency;
    this.consistencyWarnings = consistencyWarnings;
  }
}

export async function saveJourneyStage(projectId: string, stage: JourneyStage, content: Record<string, unknown>) {
  const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/journey`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ stage, content }),
  });
  const data = await response.json();
  if (response.status === 401) throw new JourneyStageSaveError('انتهت جلسة الدخول. سجّل الدخول مجدداً لحفظ مشروعك.');
  if (response.status === 404) throw new JourneyStageSaveError('المشروع غير موجود أو لا تملك صلاحية الوصول إليه.');
  if (!response.ok) throw new JourneyStageSaveError(
    data.gate?.reason || data.error || 'تعذر حفظ مرحلة البحث',
    data.consistency || null,
    Array.isArray(data.consistencyWarnings) ? data.consistencyWarnings : [],
  );
  if (data.gate?.status !== 'open') throw new JourneyStageSaveError(data.gate?.reason || 'لم تجتز هذه المرحلة بوابة الجودة بعد.');
  return data as {
    success: true;
    gate: ServerJourneyGate;
    nextStage: JourneyStage | null;
    consistency: ResearchConsistencyReport | null;
    consistencyWarnings: ResearchObjectViewWarning[];
  };
}

export type JourneyDraft = {
  content: Record<string, unknown>;
  clientUpdatedAt: string;
  savedAt: string;
};

export async function saveJourneyDraft(
  projectId: string,
  stage: JourneyStage,
  content: Record<string, unknown>,
  clientUpdatedAt = new Date().toISOString(),
  keepalive = false,
) {
  const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/journey`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ stage, content, clientUpdatedAt }),
    cache: 'no-store',
    keepalive,
  });
  const data = await response.json().catch(() => ({}));
  if (response.status === 401) throw new Error('انتهت جلسة الدخول. سجّل الدخول مجدداً لحفظ المسودة.');
  if (response.status === 404) throw new Error('المشروع غير موجود أو لا تملك صلاحية الوصول إليه.');
  if (response.status === 409) return { success: false as const, draft: (data.draft ?? null) as JourneyDraft | null };
  if (!response.ok) throw new Error(data.error || 'تعذر حفظ المسودة تلقائياً.');
  return data as { success: true; stage: JourneyStage; draft: JourneyDraft };
}

export async function loadJourney(projectId: string) {
  const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/journey`, { cache: 'no-store' });
  const data = await response.json();
  if (response.status === 401) throw new Error('انتهت جلسة الدخول. سجّل الدخول مجدداً لعرض مشروعك.');
  if (response.status === 404) throw new Error('المشروع غير موجود أو لا تملك صلاحية الوصول إليه.');
  if (!response.ok) throw new Error(data.error || 'تعذر تحميل المشروع');
  return data as {
    outputs: Partial<Record<JourneyStage, Record<string, unknown>>>;
    drafts: Partial<Record<JourneyStage, JourneyDraft>>;
    nextStage: JourneyStage | null;
    gate: ServerJourneyGate | null;
    lastActivity: { stage: JourneyStage; at: string | null } | null;
    researcher: { displayName: string; specialty: string | null };
  };
}

export const JOURNEY_STAGES: Array<{ id: JourneyStage; title: string; href: string }> = [
  { id: 'verify', title: 'استكشاف المسار', href: '/verify-idea' },
  { id: 'title', title: 'صياغة العنوان', href: '/research' },
  { id: 'problem', title: 'مشكلة البحث', href: '/research/problem' },
  { id: 'objectives', title: 'الأهداف', href: '/research/objectives' },
  { id: 'questions', title: 'أسئلة البحث', href: '/research/questions' },
  { id: 'hypotheses', title: 'الفرضيات', href: '/research/hypotheses' },
  { id: 'methodology', title: 'المنهجية', href: '/research/methodology' },
  { id: 'design', title: 'تصميم الدراسة', href: '/research/design' },
  { id: 'instrument', title: 'أداة الدراسة', href: '/research/instrument' },
  { id: 'literature', title: 'الأدبيات', href: '/research/literature' },
  { id: 'analysis', title: 'تحليل الأدبيات', href: '/research/analysis' },
  { id: 'analysis_input', title: 'مخرجات التحليل الخارجي', href: '/research/analysis-input' },
  { id: 'results', title: 'صياغة النتائج', href: '/research/results' },
  { id: 'discussion', title: 'مناقشة النتائج', href: '/research/discussion' },
  { id: 'conclusions', title: 'الاستنتاجات', href: '/research/conclusions' },
  { id: 'recommendations', title: 'التوصيات', href: '/research/recommendations' },
  { id: 'publication', title: 'جاهزية النشر', href: '/research/publication' },
];
