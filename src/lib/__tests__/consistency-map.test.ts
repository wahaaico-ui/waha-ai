import { evaluateConsistencyMap, type ConsistencyMap } from '@/lib/research-objects/consistency-map';
import type { JourneyDocumentSnapshot } from '@/lib/research-objects/types';

const projectId = 'project-consistency-map';
const checkedAt = '2026-11-11T12:00:00.000Z';
const base = { project_id: projectId, version: 1, created_at: checkedAt };

const problem = 'يعاني طلبة التمريض في الجامعات المحلية من ضعف التحصيل الأكاديمي عند استخدام منصات التعلم الإلكتروني.';
const objectives = [
  'قياس أثر منصات التعلم الإلكتروني على التحصيل الأكاديمي لدى طلبة التمريض.',
  'تحليل أسعار الطاقة المتجددة وأثرها في الصادرات الزراعية الأوروبية.',
];
const questions = [
  'ما أثر منصات التعلم الإلكتروني على التحصيل الأكاديمي لدى طلبة التمريض؟',
  'ما أثر أسعار الطاقة المتجددة في الصادرات الزراعية الأوروبية؟',
];
const hypotheses = [
  'توجد علاقة ذات دلالة إحصائية بين استخدام منصات التعلم الإلكتروني والتحصيل الأكاديمي لدى طلبة التمريض.',
  'يوجد أثر دال إحصائيًا لأسعار الطاقة المتجددة في الصادرات الزراعية الأوروبية.',
];
const methodology = {
  approach: 'quantitative',
  population: 'طلبة التمريض في الجامعات المحلية المستخدمون لمنصات التعلم الإلكتروني.',
  sample: 'عينة طبقية عشوائية من طلبة التمريض، ويحدد حجمها بتحليل القدرة الإحصائية.',
  instrument: 'استبانة محكمة ومقياس للتحصيل الأكاديمي ودافعية التعلم.',
};

function journey(parts: { hypotheses?: unknown; methodology?: unknown } = {}): JourneyDocumentSnapshot[] {
  return [
    { ...base, id: 'problem-v1', type: 'journey:problem', content: { problemStatement: problem, researchGap: 'توجد حاجة إلى فحص ميداني محلي.' } },
    { ...base, id: 'objectives-v1', type: 'journey:objectives', content: { objectives } },
    { ...base, id: 'questions-v1', type: 'journey:questions', content: { questions } },
    ...(parts.hypotheses === undefined ? [] : [{ ...base, id: 'hypotheses-v1', type: 'journey:hypotheses', content: parts.hypotheses } as JourneyDocumentSnapshot]),
    ...(parts.methodology === undefined ? [] : [{ ...base, id: 'methodology-v1', type: 'journey:methodology', content: parts.methodology } as JourneyDocumentSnapshot]),
  ];
}

const full = () => evaluateConsistencyMap(projectId, journey({ hypotheses: { mode: 'required', hypotheses, rationale: '' }, methodology }), { checkedAt });
const linkIds = (map: ConsistencyMap, index: number) => {
  const chain = map.chains[index];
  return [chain.problemLink, ...chain.questions.flatMap(step => [step.objectiveLink, step.hypothesisLink, step.methodologyLink])]
    .flatMap(link => (link ? [link.id] : []));
};

describe('consistency map (DOC-26-01)', () => {
  test('lays out one chain per objective: problem, objective, question, hypothesis and methodology', () => {
    const map = full();
    expect(map.problem?.statement).toBe(problem);
    expect(map.methodology?.kind).toBe('methodology');
    expect(map.chains.map(chain => chain.objective?.number)).toEqual([1, 2]);
    expect(map.chains.map(chain => chain.questions.map(step => step.question.number))).toEqual([[1], [2]]);
    expect(map.chains[0].questions[0].hypothesis?.statement).toBe(hypotheses[0]);
    for (const chain of map.chains) {
      expect(chain.problemLink).not.toBeNull();
      for (const step of chain.questions) {
        expect(step.objectiveLink).not.toBeNull();
        expect(step.hypothesisLink).not.toBeNull();
        expect(step.methodologyLink).not.toBeNull();
      }
    }
  });

  test('an objective unrelated to the problem is flagged, with the engine\'s reasons and suggested action', () => {
    const map = full();
    const [aligned, unrelated] = map.chains;
    expect(aligned.problemLink?.signal).toBe('sound');
    expect(['review', 'conflict']).toContain(unrelated.problemLink?.signal);
    expect(unrelated.problemLink?.reasons).toContain('لا يظهر ارتباط مفاهيمي مباشر بين الهدف ومشكلة البحث.');
    expect(unrelated.problemLink?.action).toBeTruthy();
    expect(map.flagged).toContain(unrelated.objective!.id);
    expect(map.flagged).not.toContain(aligned.objective!.id);
  });

  test('an objective\'s affected relationships are its problem link and everything built on it', () => {
    const map = full();
    const unrelated = map.chains[1];
    expect(new Set(map.affected[unrelated.objective!.id])).toEqual(new Set(linkIds(map, 1)));
    expect(map.affected[unrelated.objective!.id]).not.toContain(map.chains[0].problemLink!.id);
    const question = unrelated.questions[0];
    expect(new Set(map.affected[question.question.id])).toEqual(new Set([question.objectiveLink!.id, question.hypothesisLink!.id, question.methodologyLink!.id]));
    expect(new Set(map.affected[map.problem!.id])).toEqual(new Set([...linkIds(map, 0), ...linkIds(map, 1)]));
    expect(new Set(map.affected[map.methodology!.id])).toEqual(new Set(map.chains.flatMap(chain => chain.questions.map(step => step.methodologyLink!.id))));
  });

  test('a methodological decision not to use hypotheses is shown once, with its own signal', () => {
    const qualitative = ['كيف يصف طلبة التمريض خبراتهم مع منصات التعلم الإلكتروني؟'];
    const documents = journey({ hypotheses: { mode: 'not_applicable', rationale: 'الدراسة نوعية استكشافية تصف الخبرات ولا تختبر علاقات سببية بين متغيرات.' } })
      .map(document => (document.type === 'journey:questions' ? { ...document, content: { questions: qualitative } } : document));
    const map = evaluateConsistencyMap(projectId, documents, { checkedAt });
    expect(map.hypothesesDecision).toMatchObject({ signal: 'sound' });
    expect(map.chains.flatMap(chain => chain.questions).every(step => step.hypothesis === null && step.hypothesisLink === null)).toBe(true);
  });

  test('stages not saved yet are marked not checked and say why, instead of failing', () => {
    const map = evaluateConsistencyMap(projectId, journey(), { checkedAt });
    expect(map.hypothesesDecision).toBeNull();
    expect(map.methodology).toBeNull();
    const steps = map.chains.flatMap(chain => chain.questions);
    expect(steps.every(step => step.hypothesisLink === null && step.methodologyLink === null)).toBe(true);
    expect(map.notices).toContain('لم تُحفظ مرحلة الفرضيات بعد.');
    expect(map.notices.some(notice => /منهج/.test(notice))).toBe(true);
  });

  test('an empty project gives an empty map with the reason', () => {
    const map = evaluateConsistencyMap(projectId, [], { checkedAt });
    expect(map.problem).toBeNull();
    expect(map.chains).toEqual([]);
    expect(map.notices.length).toBeGreaterThan(0);
  });
});
