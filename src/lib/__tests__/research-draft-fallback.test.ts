import { assessProblemDraft } from '@/lib/academic-content-quality';
import { buildInstrumentDraftFallback, buildObjectivesDraftFallback, buildProblemDraftFallback } from '@/lib/research-draft-fallback';
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

describe('buildInstrumentDraftFallback', () => {
  const context = {
    title: { title: 'أثر التعلم المدمج في دافعية طلبة الدراسات العليا' },
    questions: { questions: ['ما مستوى دافعية طلبة الدراسات العليا؟', 'كيف يصف الطلبة خبرة التعلم المدمج؟'] },
    design: { variables: [{ name: 'دافعية الطلبة' }, { name: 'التعلم المدمج' }] },
  };

  it.each([
    ['questionnaire', 3, 'likert5'],
    ['interview', 2, 'long_text'],
    ['observation', 2, 'single_choice'],
    ['document_analysis', 2, 'single_choice'],
    ['test_scale', 2, 'long_text'],
  ] as const)('builds a complete %s draft without an AI provider', (type, itemCount, firstKind) => {
    const draft = buildInstrumentDraftFallback(context, type);
    expect(draft?.instrumentType).toBe(type);
    expect(draft?.sections).toHaveLength(2);
    expect(draft?.sections[0].variableName).toBe('دافعية الطلبة');
    expect(draft?.sections[0].items).toHaveLength(itemCount);
    expect(draft?.sections[0].items[0].kind).toBe(firstKind);
    expect(draft?.consentStatement.length).toBeGreaterThan(30);
    expect(stageComplete('instrument', draft || undefined)).toBe(true);
  });

  it('refuses to invent an instrument before design variables exist', () => {
    expect(buildInstrumentDraftFallback({ title: context.title }, 'questionnaire')).toBeNull();
  });

  it('supports a valid single-concept qualitative design', () => {
    const draft = buildInstrumentDraftFallback({
      ...context,
      design: { variables: [{ name: 'خبرة النزوح' }] },
    }, 'interview');
    expect(draft?.sections).toHaveLength(1);
    expect(stageComplete('instrument', draft || undefined)).toBe(true);
  });
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
