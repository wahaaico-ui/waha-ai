import { evaluateGate, type WorkflowOutput, type WorkflowStage } from '@/lib/research-workflow';

type Discipline = {
  id: string;
  label: string;
  phenomenon: string;
  outcome: string;
  population: string;
  context: string;
};

type DesignProfile = {
  id: string;
  label: string;
  approach: 'quantitative' | 'qualitative' | 'mixed';
};

const disciplines: Discipline[] = [
  { id: 'education', label: 'التربية', phenomenon: 'استخدام التعلم التكيفي', outcome: 'المشاركة الأكاديمية', population: 'طلبة المرحلة الثانوية', context: 'المدارس الحكومية الفلسطينية' },
  { id: 'nursing', label: 'التمريض', phenomenon: 'التدريب السريري بالمحاكاة', outcome: 'الكفاءة السريرية', population: 'طلبة التمريض', context: 'كليات التمريض الفلسطينية' },
  { id: 'public-health', label: 'الصحة العامة', phenomenon: 'التثقيف الصحي الرقمي', outcome: 'الالتزام بالسلوك الوقائي', population: 'البالغين المصابين بأمراض مزمنة', context: 'مراكز الرعاية الأولية' },
  { id: 'business', label: 'إدارة الأعمال', phenomenon: 'التحول الرقمي', outcome: 'مرونة الأداء المؤسسي', population: 'العاملين في المنشآت الصغيرة', context: 'المنشآت الفلسطينية الناشئة' },
  { id: 'computer-science', label: 'علوم الحاسوب', phenomenon: 'ممارسات التطوير الآمن', outcome: 'جودة البرمجيات', population: 'مطوري البرمجيات المبتدئين', context: 'شركات التقنية المحلية' },
  { id: 'psychology', label: 'علم النفس', phenomenon: 'استراتيجيات تنظيم الانفعال', outcome: 'المرونة النفسية', population: 'طلبة الجامعات', context: 'الجامعات الفلسطينية' },
  { id: 'media', label: 'الإعلام', phenomenon: 'التعرض للأخبار عبر المنصات الرقمية', outcome: 'الثقة بالمعلومات', population: 'الشباب الجامعي', context: 'البيئة الإعلامية الفلسطينية' },
  { id: 'law', label: 'القانون', phenomenon: 'استخدام الوساطة الرقمية', outcome: 'الوصول إلى العدالة', population: 'المستفيدين من خدمات المساعدة القانونية', context: 'المؤسسات الحقوقية المحلية' },
  { id: 'environment', label: 'العلوم البيئية', phenomenon: 'ممارسات فرز النفايات المنزلية', outcome: 'خفض النفايات المختلطة', population: 'الأسر الحضرية', context: 'البلديات الفلسطينية' },
  { id: 'agriculture', label: 'الزراعة', phenomenon: 'استخدام الري الذكي', outcome: 'كفاءة استهلاك المياه', population: 'المزارعين أصحاب الحيازات الصغيرة', context: 'المناطق الزراعية الفلسطينية' },
];

const designs: DesignProfile[] = [
  { id: 'cross-sectional', label: 'مسحي مقطعي', approach: 'quantitative' },
  { id: 'correlational', label: 'ارتباطي', approach: 'quantitative' },
  { id: 'quasi-experimental', label: 'شبه تجريبي', approach: 'quantitative' },
  { id: 'phenomenology', label: 'ظاهراتي نوعي', approach: 'qualitative' },
  { id: 'sequential-mixed', label: 'مختلط تتابعي', approach: 'mixed' },
];

export const academicBenchmarkCases = disciplines.flatMap((discipline) => designs.map((design, designIndex) => ({
  id: `${discipline.id}-${design.id}`,
  number: designs.length * disciplines.indexOf(discipline) + designIndex + 1,
  discipline,
  design,
})));

function buildOutputs(discipline: Discipline, design: DesignProfile): Partial<Record<WorkflowStage, WorkflowOutput>> {
  const qualitative = design.approach === 'qualitative';
  const title = qualitative
    ? `خبرات ${discipline.population} في ${discipline.phenomenon} وعلاقتها بـ${discipline.outcome} ضمن ${discipline.context}`
    : `أثر ${discipline.phenomenon} في ${discipline.outcome} لدى ${discipline.population} في ${discipline.context}`;
  const questions = qualitative
    ? [
        `كيف يصف ${discipline.population} خبراتهم مع ${discipline.phenomenon} في ${discipline.context}؟`,
        `كيف تنعكس هذه الخبرات على ${discipline.outcome} لدى المشاركين في الدراسة؟`,
      ]
    : [
        `ما أثر ${discipline.phenomenon} في ${discipline.outcome} لدى ${discipline.population} في ${discipline.context}؟`,
        `ما العلاقة بين مستوى ${discipline.phenomenon} ومستوى ${discipline.outcome} لدى مجتمع الدراسة؟`,
      ];
  const variables = qualitative
    ? [{ name: discipline.phenomenon, role: 'concept', operationalDefinition: `الخبرات والتصورات التي يعبّر عنها المشاركون حول ${discipline.phenomenon} ضمن سياق الدراسة المحدد.` }]
    : [
        { name: discipline.phenomenon, role: 'independent', operationalDefinition: `الدرجة الكلية لمؤشرات ${discipline.phenomenon} كما تقيسها الأداة المعتمدة في هذه الدراسة.` },
        { name: discipline.outcome, role: 'dependent', operationalDefinition: `الدرجة الكلية لمؤشرات ${discipline.outcome} لدى المشاركين وفق أداة القياس المعتمدة.` },
      ];
  const instrumentType = qualitative ? 'interview' : 'questionnaire';
  const sections = variables.map((variable) => ({
    title: `محور ${variable.name}`,
    variableName: variable.name,
    items: qualitative
      ? [
          { text: `صف تجربتك الأساسية مع ${variable.name} في هذا السياق.`, kind: 'open_text' },
          { text: `ما العوامل التي شكلت خبرتك مع ${variable.name}؟`, kind: 'open_text' },
        ]
      : [
          { text: `ألاحظ مستوى واضحاً من ${variable.name} في السياق محل الدراسة.`, kind: 'likert5' },
          { text: `تتوفر ممارسات منتظمة تدعم ${variable.name} لدى مجتمع الدراسة.`, kind: 'likert5' },
          { text: `يمكن قياس التغير في ${variable.name} خلال فترة الدراسة المحددة.`, kind: 'likert5' },
        ],
  }));

  return {
    verify: {
      decision: 'proceed',
      searchCoverage: { uniqueStudies: 8 },
      researchPaths: [{ id: 'context' }, { id: 'comparison' }, { id: 'recent' }],
      selectedResearchPath: { id: 'context' },
    },
    title: { title },
    problem: {
      problemStatement: `لا يزال أثر ${discipline.phenomenon} في ${discipline.outcome} لدى ${discipline.population} غير واضح بما يكفي داخل ${discipline.context}، مما يحد من اتخاذ قرارات تستند إلى أدلة محلية منظمة.`,
      researchGap: `تفتقر الأدلة المتاحة إلى فحص متكامل يربط الظاهرة بالنتيجة المستهدفة داخل المجتمع والسياق المحددين مع مراعاة خصائصهما المحلية.`,
      researcherNote: `اخترت هذا الموضوع لأنه يرتبط باحتياج عملي يمكن أن يحسن القرارات والخدمات المقدمة إلى مجتمع الدراسة.`,
    },
    objectives: {
      objectives: [
        `فحص ${discipline.phenomenon} لدى ${discipline.population} ضمن ${discipline.context} وفق تصميم ${design.label}.`,
        `تحليل ارتباط ${discipline.phenomenon} بـ${discipline.outcome} ضمن حدود المجتمع والسياق المعتمدين.`,
      ],
    },
    questions: { questions },
    hypotheses: qualitative
      ? { mode: 'not_applicable', hypotheses: [], rationale: 'الدراسة نوعية استكشافية تركز على فهم الخبرات والتفسيرات ولا تختبر علاقات كمية محددة مسبقاً.' }
      : {
          mode: 'required',
          hypotheses: [
            `يوجد أثر ذو دلالة لـ${discipline.phenomenon} في ${discipline.outcome} لدى مجتمع الدراسة المحدد.`,
            `توجد علاقة ذات دلالة بين مستوى ${discipline.phenomenon} ومستوى ${discipline.outcome} لدى المشاركين.`,
          ],
        },
    methodology: {
      approach: design.approach,
      population: `يتكون مجتمع الدراسة من ${discipline.population} المرتبطين مباشرة بموضوع البحث داخل ${discipline.context}.`,
      sample: qualitative
        ? 'عينة قصدية متنوعة تُختار وفق صلتها المباشرة بالخبرة المدروسة حتى تحقق كفاية المعلومات.'
        : 'عينة طبقية ممثلة تُختار من فئات المجتمع المحدد وفق إطار معاينة واضح ومتاح للباحث.',
      instrument: qualitative
        ? 'مقابلات شبه منظمة تستكشف الخبرات والتفسيرات المرتبطة بأسئلة الدراسة.'
        : design.approach === 'mixed'
          ? 'استبانة محكمة يتبعها عدد محدود من المقابلات لتفسير النتائج الكمية.'
          : 'استبانة محكمة تقيس المتغيرات المعتمدة بمؤشرات واضحة ومتسقة.',
    },
    design: {
      variables,
      population: { description: `جميع ${discipline.population} المتاحين ضمن ${discipline.context} خلال الفترة التي يحددها الباحث.` },
      sample: {
        strategy: qualitative ? 'عينة قصدية قصوى التنوع من المشاركين.' : 'عينة طبقية عشوائية من فئات المجتمع.',
        inclusionCriteria: `مشاركون ينتمون إلى ${discipline.population} ولديهم خبرة مباشرة بالظاهرة خلال فترة الدراسة.`,
        sizeRationale: qualitative
          ? 'يحدد العدد وفق كفاية المعلومات وتنوع الخبرات مع توثيق قرار التوقف عن جمع المقابلات.'
          : 'يحدد الحجم بتحليل القدرة الإحصائية وفق عدد المتغيرات وحجم المجتمع ومستوى الدقة المطلوب.',
      },
    },
    instrument: {
      instrumentType,
      consentStatement: 'المشاركة طوعية وتستخدم الإجابات لأغراض البحث فقط، ويمكن الانسحاب قبل الإرسال دون أي تبعات.',
      instructions: qualitative
        ? 'أجب بحرية عن كل سؤال، ويمكنك الامتناع عن أي سؤال أو طلب توضيحه قبل المتابعة.'
        : 'اقرأ كل عبارة بعناية ثم اختر الدرجة التي تعبّر بدقة عن تجربتك ضمن الفترة المحددة.',
      sections,
    },
  };
}

const preDataStages: WorkflowStage[] = ['verify', 'title', 'problem', 'objectives', 'questions', 'hypotheses', 'methodology', 'design', 'instrument'];

describe('DOC-45-01 academic benchmark — 50 diverse pre-data research cases', () => {
  test('contains exactly 50 unique cases across ten disciplines and five designs', () => {
    expect(academicBenchmarkCases).toHaveLength(50);
    expect(new Set(academicBenchmarkCases.map((item) => item.id)).size).toBe(50);
    expect(new Set(academicBenchmarkCases.map((item) => item.discipline.id)).size).toBe(10);
    expect(new Set(academicBenchmarkCases.map((item) => item.design.id)).size).toBe(5);
  });

  test.each(academicBenchmarkCases)('$number · $discipline.label · $design.label · $id', ({ discipline, design }) => {
    const outputs = buildOutputs(discipline, design);
    for (const stage of preDataStages) {
      const gate = evaluateGate(stage, outputs);
      expect({ stage, status: gate.status, reason: gate.reason }).toEqual(expect.objectContaining({ stage, status: 'open' }));
    }
  });
});
