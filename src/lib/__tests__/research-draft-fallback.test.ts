import { assessProblemDraft } from '@/lib/academic-content-quality';
import {
  buildDesignDraftFallback,
  buildHypothesesDraftFallback,
  buildInstrumentDraftFallback,
  buildMethodologyDraftFallback,
  buildObjectivesDraftFallback,
  buildProblemDraftFallback,
  buildQuestionsDraftFallback,
} from '@/lib/research-draft-fallback';
import { stageComplete } from '@/lib/research-workflow';

test('builds a structurally valid provisional draft, not a verified gap', () => {
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

describe('problem fallback evidence boundaries (DOC-11-05 / DOC-25-03)', () => {
  const title = 'أثر التعلم المدمج في دافعية طلبة الدراسات العليا';

  it('does not infer a shortage of published evidence from a title alone', () => {
    const draft = buildProblemDraftFallback({ title: { title } });
    expect(draft).not.toBeNull();
    expect(draft?.problemStatement).not.toContain('المعرفة المتاحة لا تكفي');
    expect(draft?.researchGap).not.toContain('محدودية الأدلة');
    expect(draft?.researchGap).toContain('لا يمكن تحديد فجوة علمية من العنوان وحده');
    expect(draft?.researchGap).toContain('لا يعني غياب الدراسات');
    expect(draft?.problemStatement).toContain(title);
  });

  it('attributes an exploration hint without promoting it to evidence of a gap', () => {
    const hint = 'تمثيل ضعيف للسياق العربي في بيانات الانتماء المؤسسي';
    const draft = buildProblemDraftFallback({ title: { title }, verify: { gaps: [hint] } });
    expect(draft?.researchGap).toContain(hint);
    expect(draft?.researchGap).toContain('ملاحظة محفوظة غير متحققة');
    expect(draft?.researchGap).toContain('ليست دليلاً على فجوة علمية');
    expect(draft?.researchGap).not.toContain('تشير مراجعة الاستكشاف الأولية إلى فجوة');
  });

  it.each([undefined, null, [], ['  ', 12, {}], 'not-an-array'])('handles absent or malformed hints without inventing evidence: %j', (gaps) => {
    const draft = buildProblemDraftFallback({ title: { title }, verify: { gaps } });
    expect(draft?.researchGap).toContain('لا يمكن تحديد فجوة علمية من العنوان وحده');
    expect(assessProblemDraft({ title, problemStatement: draft?.problemStatement, researchGap: draft?.researchGap, researcherNote: '', requireResearcherNote: false }).valid).toBe(true);
  });

  it('uses the first non-empty textual hint and preserves the source context', () => {
    const context = { title: { title }, verify: { gaps: [' ', 'ملاحظة تحتاج قراءة الدراسات الأصلية'] } };
    const before = JSON.stringify(context);
    const draft = buildProblemDraftFallback(context);
    expect(draft?.researchGap).toContain('ملاحظة تحتاج قراءة الدراسات الأصلية');
    expect(JSON.stringify(context)).toBe(before);
  });

  it.each([undefined, ['تمثيل ضعيف للسياق العربي في بيانات الانتماء المؤسسي']])('allows guidance preview but never approves it unchanged: %j', (gaps) => {
    const draft = buildProblemDraftFallback({ title: { title }, verify: { gaps } });
    const content = { ...draft, researcherNote: 'اخترت هذا الموضوع لتحسين تجربة التعلم لدى طلبة الدراسات العليا.' };
    expect(stageComplete('problem', content)).toBe(false);
    expect(assessProblemDraft({ title, problemStatement: draft?.problemStatement, researchGap: draft?.researchGap, researcherNote: content.researcherNote }).reason).toContain('إرشادي');
  });

  it('rejects known guidance even with diacritics, formatting characters or whitespace changes', () => {
    const draft = buildProblemDraftFallback({ title: { title } });
    expect(stageComplete('problem', {
      ...draft,
      problemStatement: draft?.problemStatement.replace('صياغة', 'صِيـاغة').replaceAll(' ', '  \n'),
      researchGap: draft?.researchGap.replaceAll(' ', '  \n'),
      researcherNote: 'اخترت هذا الموضوع لتحسين تجربة التعلم لدى طلبة الدراسات العليا.',
    })).toBe(false);
  });
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

describe('provider-independent journey drafts', () => {
  const title = 'أثر التعلم المدمج على دافعية طلبة الدراسات العليا';
  const objectives = {
    objectives: [
      'تحديد الأبعاد الأساسية للتعلم المدمج لدى طلبة الدراسات العليا في الجامعة.',
      'تقييم أثر التعلم المدمج على دافعية طلبة الدراسات العليا في الجامعة.',
    ],
  };

  it('builds one valid question for every approved objective', () => {
    const draft = buildQuestionsDraftFallback({ objectives });
    expect(draft?.questions).toHaveLength(objectives.objectives.length);
    expect(stageComplete('questions', draft || undefined)).toBe(true);
  });

  it('does not invent statistical hypotheses for non-quantitative questions', () => {
    const draft = buildHypothesesDraftFallback({ questions: { questions: ['كيف يصف الطلبة خبرتهم مع التعلم المدمج؟'] } });
    expect(draft?.mode).toBe('not_applicable');
    expect(stageComplete('hypotheses', draft || undefined)).toBe(true);
  });

  it('builds a valid methodology and design from approved quantitative context', () => {
    const questions = { questions: ['ما مدى أثر التعلم المدمج على دافعية طلبة الدراسات العليا؟'] };
    const hypotheses = buildHypothesesDraftFallback({ questions });
    const methodology = buildMethodologyDraftFallback({ title: { title }, questions, hypotheses });
    const design = buildDesignDraftFallback({ title: { title }, methodology });

    expect(hypotheses?.mode).toBe('required');
    expect(stageComplete('hypotheses', hypotheses || undefined)).toBe(true);
    expect(stageComplete('methodology', methodology || undefined)).toBe(true);
    expect(stageComplete('design', design || undefined)).toBe(true);
  });

  it.each([
    ['questions', buildQuestionsDraftFallback({})],
    ['hypotheses', buildHypothesesDraftFallback({})],
    ['methodology', buildMethodologyDraftFallback({})],
    ['design', buildDesignDraftFallback({})],
  ])('refuses to fabricate a %s draft without its prerequisite', (_stage, draft) => {
    expect(draft).toBeNull();
  });
});
