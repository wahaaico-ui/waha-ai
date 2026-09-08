import { assessProblemDraft } from '@/lib/academic-content-quality';
import { buildProblemDraftFallback } from '@/lib/research-draft-fallback';

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
