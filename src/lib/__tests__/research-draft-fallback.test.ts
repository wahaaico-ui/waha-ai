import { assessProblemDraft } from '@/lib/academic-content-quality';
import { buildObjectivesDraftFallback, buildProblemDraftFallback } from '@/lib/research-draft-fallback';
import { stageComplete } from '@/lib/research-workflow';

test('builds a valid grounded problem draft from the saved title and gap', () => {
  const draft = buildProblemDraftFallback({
    title: { title: 'الحرب الساخنة وأثرها على فلسطين ضمن سياق اجتماعي معاصر' },
    verify: { gaps: ['محدودية الدراسات التي تفحص الآثار الاجتماعية ضمن السياق الفلسطيني الحديث'] },
  });

  expect(draft).not.toBeNull();
  expect(assessProblemDraft({
    title: 'الحرب الساخنة وأثرها على فلسطين ضمن سياق اجتماعي معاصر',
    problemStatement: draft?.problemStatement,
    researchGap: draft?.researchGap,
    researcherNote: '',
    requireResearcherNote: false,
  })).toEqual({ valid: true, reason: null });
});

test('does not fabricate a draft when the project has no adopted title', () => {
  expect(buildProblemDraftFallback({ verify: { gaps: ['فجوة'] } })).toBeNull();
});

test('builds valid objectives grounded in the saved title and problem', () => {
  const draft = buildObjectivesDraftFallback({
    title: { title: 'الحرب الساخنة وأثرها على فلسطين ضمن سياق اجتماعي معاصر' },
    problem: {
      problemStatement: 'تحتاج الآثار الاجتماعية للحرب الساخنة على فلسطين إلى فحص منظم يحدد المجتمع والسياق والمؤشرات القابلة للقياس.',
      researchGap: 'توجد محدودية في الأدلة الميدانية الحديثة التي تتناول المجتمع الفلسطيني ضمن هذا السياق المحدد.',
    },
  });

  expect(draft).not.toBeNull();
  expect(stageComplete('objectives', draft || undefined)).toBe(true);
});
