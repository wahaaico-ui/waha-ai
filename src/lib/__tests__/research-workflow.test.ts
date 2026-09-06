import { evaluateGate, nextAllowedStage, stageComplete } from '../research-workflow';

const verified = {
  decision: 'proceed',
  topic: 'أثر الذكاء الاصطناعي على التعلم',
  searchCoverage: { uniqueStudies: 12 },
  researchPaths: [{ id: 'local' }, { id: 'recent' }, { id: 'comparison' }],
  selectedResearchPath: { id: 'local' },
};
const title = { title: 'أثر الذكاء الاصطناعي التوليدي على تعلم طلبة الدراسات العليا' };
const problem = { problemStatement: 'لا يزال أثر استخدام الذكاء الاصطناعي التوليدي على تعلم طلبة الدراسات العليا غير واضح في السياق المحلي.', researchGap: 'توجد ندرة في الدراسات التي تربط الاستخدام الفعلي للذكاء الاصطناعي بتحسن مهارات التعلم لدى طلبة الدراسات العليا.', researcherNote: 'اخترت المشكلة لأنها تمس تجربة الباحثين اليومية وتحتاج فهماً مرتبطاً ببيئتهم.' };
const design = {
  variables: [
    { name: 'استخدام الذكاء الاصطناعي', role: 'independent', operationalDefinition: 'درجة الاستخدام الفعلي لأدوات الذكاء الاصطناعي خلال الفصل الدراسي.' },
    { name: 'جودة التعلم', role: 'dependent', operationalDefinition: 'الدرجة الكلية لمؤشرات التحصيل والمشاركة الأكاديمية لدى الطلبة.' },
  ],
  population: { description: 'جميع طلبة الدراسات العليا المسجلين في الجامعة خلال الفصل الحالي.' },
  sample: { strategy: 'عينة طبقية عشوائية من الكليات المختلفة.', inclusionCriteria: 'طلبة دراسات عليا مسجلون واستخدموا أدوات الذكاء الاصطناعي أكاديمياً.', sizeRationale: 'يحدد الحجم لاحقاً بتحليل القدرة الإحصائية وفق المتغيرات والنموذج المختار.' },
};
const instrument = {
  title: 'استبانة استخدام الذكاء الاصطناعي وجودة التعلم لدى طلبة الدراسات العليا',
  description: 'أداة أولية تقيس متغيرات الدراسة المعتمدة وتحتاج إلى تحكيم وتجربة استطلاعية.',
  consentStatement: 'المشاركة طوعية، وتستخدم الإجابات لأغراض البحث فقط، ويمكن للمشارك الانسحاب قبل الإرسال.',
  instructions: 'اقرأ كل عبارة بعناية، ثم اختر الإجابة التي تعبّر بدقة عن تجربتك الأكاديمية.',
  respondentFields: [],
  sections: [
    {
      title: 'محور استخدام الذكاء الاصطناعي',
      variableName: 'استخدام الذكاء الاصطناعي',
      description: 'يقيس أنماط الاستخدام الأكاديمي الفعلي لأدوات الذكاء الاصطناعي.',
      items: [
        { text: 'أستخدم أدوات الذكاء الاصطناعي لفهم المفاهيم الأكاديمية المعقدة.', kind: 'likert5', required: true, options: [] },
        { text: 'أراجع دقة مخرجات الذكاء الاصطناعي قبل استخدامها في تعلمي.', kind: 'likert5', required: true, options: [] },
        { text: 'أستخدم أدوات الذكاء الاصطناعي بانتظام في المهام الأكاديمية.', kind: 'likert5', required: true, options: [] },
      ],
    },
    {
      title: 'محور جودة التعلم',
      variableName: 'جودة التعلم',
      description: 'يقيس مؤشرات التحصيل والمشاركة والفهم الأكاديمي لدى الطلبة.',
      items: [
        { text: 'أستطيع ربط المفاهيم الجديدة بالمعرفة التي تعلمتها سابقاً.', kind: 'likert5', required: true, options: [] },
        { text: 'أشارك بفاعلية في الأنشطة والنقاشات المرتبطة بمقرراتي.', kind: 'likert5', required: true, options: [] },
        { text: 'أحقق فهماً أعمق للموضوعات الأكاديمية التي أدرسها.', kind: 'likert5', required: true, options: [] },
      ],
    },
  ],
};
const preDesignOutputs = {
  verify: verified,
  title,
  problem,
  objectives: { objectives: ['قياس أثر الاستخدام الفعلي للذكاء الاصطناعي على تعلم الباحثين', 'تحديد العوامل التي تؤثر في تبني الذكاء الاصطناعي'] },
  questions: { questions: ['ما أثر الاستخدام الفعلي للذكاء الاصطناعي على تعلم الباحثين؟', 'ما العوامل التي تؤثر في تبني الذكاء الاصطناعي؟'] },
  hypotheses: { mode: 'required', hypotheses: ['يوجد أثر للاستخدام الفعلي للذكاء الاصطناعي على تعلم الباحثين', 'توجد علاقة بين العوامل المؤثرة وتبني الذكاء الاصطناعي لدى الباحثين'] },
  methodology: { approach: 'quantitative', population: 'جميع طلبة الدراسات العليا المسجلين في الجامعة', sample: 'عينة طبقية ممثلة من طلبة الكليات المختلفة', instrument: 'استبانة أكاديمية محكمة تقيس المتغيرات المحددة' },
};

describe('research workflow quality gates', () => {
  test('does not open a stage before all preceding stages are complete', () => {
    const gate = evaluateGate('problem', { verify: verified });
    expect(gate.status).toBe('locked');
    expect(gate.nextStage).toBe('title');
  });

  test('does not accept a numeric decision without enough evidence and grounded paths', () => {
    expect(stageComplete('verify', { decision: 'proceed', acceptanceScore: 85 })).toBe(false);
    expect(stageComplete('verify', { decision: 'proceed', searchCoverage: { uniqueStudies: 8 }, researchPaths: [{ id: 'one' }] })).toBe(false);
    expect(stageComplete('verify', { decision: 'proceed', searchCoverage: { uniqueStudies: 8 }, researchPaths: [{ id: 'one' }, { id: 'two' }, { id: 'three' }] })).toBe(false);
    expect(stageComplete('verify', verified)).toBe(true);
  });

  test('rejects an incomplete research problem without opening the next stage', () => {
    const gate = evaluateGate('problem', { verify: verified, title, problem: { problemStatement: 'قصيرة', researchGap: '', researcherNote: '' } });
    expect(gate.status).toBe('needs_improvement');
    expect(gate.nextStage).toBe('problem');
  });

  test('rejects a meaningful-looking problem that is unrelated to the approved title', () => {
    const gate = evaluateGate('problem', {
      verify: verified,
      title,
      problem: {
        problemStatement: 'تعاني المدن الساحلية من ارتفاع مستمر في كميات النفايات المنزلية وصعوبة إدارتها خلال مواسم السياحة السنوية.',
        researchGap: 'ما زالت الأدلة المتاحة محدودة بشأن كفاءة أساليب الفرز المنزلي في الأحياء الساحلية المكتظة بالسكان.',
        researcherNote: 'اخترت هذه المشكلة لأهميتها العملية في المجتمع الذي أعيش وأعمل فيه.',
      },
    });
    expect(gate.status).toBe('needs_improvement');
    expect(gate.reason).toContain('العنوان');
  });

  test('keeps the objectives locked until the researcher records their own rationale', () => {
    expect(stageComplete('problem', { problemStatement: problem.problemStatement, researchGap: problem.researchGap })).toBe(false);
    expect(stageComplete('problem', problem)).toBe(true);
  });

  test('opens the next stage only after a valid output', () => {
    const gate = evaluateGate('problem', { verify: verified, title, problem });
    expect(gate.status).toBe('open');
    expect(gate.nextStage).toBe('objectives');
  });

  test('requires evidence before literature is considered complete', () => {
    expect(stageComplete('literature', { papers: [{ id: '1' }, { id: '2' }] })).toBe(false);
    expect(nextAllowedStage({ verify: verified, title, problem, objectives: { objectives: ['قياس أثر التقنية على تحصيل طلبة الدراسات العليا', 'تحديد العوامل المؤثرة في تبني التقنية لدى الباحثين'] }, questions: { questions: ['ما أثر التقنية على تحصيل طلبة الدراسات العليا؟', 'ما العوامل المؤثرة في تبني التقنية لدى الباحثين؟'] }, hypotheses: { mode: 'required', hypotheses: ['يوجد أثر للتقنية على تحصيل طلبة الدراسات العليا', 'توجد علاقة بين التقنية والعوامل المؤثرة في تبنيها لدى الباحثين'] }, methodology: { approach: 'quantitative', population: 'جميع طلبة الدراسات العليا المسجلين في الجامعة', sample: 'عينة طبقية ممثلة من طلبة الكليات المختلفة', instrument: 'استبانة أكاديمية محكمة تقيس المتغيرات المحددة' }, design, instrument, literature: { papers: [{ id: '1' }, { id: '2' }, { id: '3' }] } })).toBe('analysis');
  });

  test('separates literature synthesis from researcher-provided external analysis outputs', () => {
    const literatureAnalysis = {
      introduction: 'توضح الدراسات المختارة سياق المشكلة البحثية وعلاقاتها الأساسية ضمن البيئة الأكاديمية المستهدفة.',
      conclusion: 'تشير الأدلة المختارة إلى حاجة واضحة لاختبار العلاقات المقترحة ميدانياً ضمن مجتمع الدراسة المحدد.',
    };
    expect(stageComplete('analysis', literatureAnalysis)).toBe(true);
    expect(stageComplete('analysis_input', { ...literatureAnalysis })).toBe(false);
  });

  test('opens results only after valid external analysis outputs are approved', () => {
    const results = {
      results: [{
        questionIndex: 0,
        questionText: 'ما أثر التقنية على تعلم الباحثين؟',
        hypothesisIndex: null,
        hypothesisText: null,
        sourceFindingSummary: 'ظهر تحسن واضح في جودة التعلم لدى أفراد العينة بعد استخدام التقنية.',
        sourceEvidenceSummary: 'بلغ المتوسط العام 4.10 من خمس درجات وفق المخرج التحليلي المعتمد.',
        resultStatement: 'ظهر تحسن واضح في جودة التعلم لدى أفراد العينة، وبلغ المتوسط العام 4.10 من خمس درجات وفق المخرج التحليلي المعتمد.',
      }],
      overallSummary: 'أظهرت مخرجات التحليل المعتمدة تحسناً واضحاً في جودة التعلم لدى أفراد العينة ضمن السياق المحدد للدراسة.',
      limitations: 'تقتصر هذه النتائج على العينة والسياق اللذين شمِلَهما التحليل الخارجي.',
      reportingOnlyConfirmed: true,
    };
    expect(stageComplete('results', results)).toBe(true);
    expect(nextAllowedStage({ ...preDesignOutputs, design, instrument, literature: { papers: [{ id: '1' }, { id: '2' }, { id: '3' }] }, analysis: { introduction: 'مقدمة تحليل أدبي موثقة تشرح السياق النظري للدراسة الحالية.', conclusion: 'خلاصة تحليل أدبي موثقة تربط بين الأدلة السابقة وسياق البحث الحالي.' }, analysis_input: {
      analysisKind: 'quantitative', analyzedBy: 'researcher', softwareOrMethod: 'برنامج إحصائي مناسب للدراسة الحالية', sampleAnalyzed: 'عينة الدراسة المعتمدة وفق التصميم والمنهج', procedureSummary: 'تم تنفيذ التحليل المناسب وربط كل مخرج بسؤال البحث المقابل.', findings: [{ questionIndex: 0, questionText: 'ما أثر التقنية على تعلم الباحثين؟', hypothesisIndex: null, hypothesisText: null, findingSummary: 'ظهر تحسن واضح في جودة التعلم لدى أفراد العينة بعد استخدام التقنية.', evidenceSummary: 'بلغ المتوسط العام 4.10 من خمس درجات وفق المخرج التحليلي المعتمد.' }], limitations: 'تقتصر النتائج على العينة والسياق اللذين شمِلَهما التحليل الخارجي.', noRawDataConfirmed: true, noPersonalDataConfirmed: true,
    }, results })).toBe('discussion');
  });

  test('keeps literature locked until a quantitative design defines predictor and outcome variables', () => {
    expect(evaluateGate('design', { ...preDesignOutputs, design: { ...design, variables: [design.variables[0]] } }).status).toBe('needs_improvement');
    expect(evaluateGate('design', { ...preDesignOutputs, design }).status).toBe('open');
    expect(stageComplete('design', design)).toBe(true);
  });

  test('requires the instrument to cover every approved variable before opening literature', () => {
    expect(stageComplete('instrument', instrument)).toBe(true);
    const incompleteInstrument = {
      ...instrument,
      sections: [instrument.sections[0], { ...instrument.sections[1], variableName: 'استخدام الذكاء الاصطناعي' }],
    };
    const gate = evaluateGate('instrument', { ...preDesignOutputs, design, instrument: incompleteInstrument });
    expect(gate.status).toBe('needs_improvement');
    expect(gate.reason).toContain('جودة التعلم');
    expect(evaluateGate('instrument', { ...preDesignOutputs, design, instrument }).status).toBe('open');
  });

  test('accepts a structured interview guide without questionnaire-only requirements', () => {
    const interview = {
      instrumentType: 'interview',
      title: 'دليل مقابلة شبه منظمة مع طلبة الدراسات العليا',
      consentStatement: 'أوافق طوعياً على المشاركة بعد توضيح هدف المقابلة وسرية البيانات وحق الانسحاب.',
      instructions: 'اطرح الأسئلة بالترتيب واستخدم المتابعات المحايدة دون توجيه المشارك إلى إجابة.',
      sections: design.variables.map((variable) => ({
        title: `محور ${variable.name}`,
        variableName: variable.name,
        items: [
          { text: `كيف تصف خبرتك المرتبطة بمحور ${variable.name}؟` },
          { text: `ما العوامل التي أثرت في تجربتك مع ${variable.name}؟` },
        ],
      })),
    };
    expect(stageComplete('instrument', interview)).toBe(true);
    expect(evaluateGate('instrument', { ...preDesignOutputs, design, instrument: interview }).status).toBe('open');
  });

  test('locks methodology until the hypotheses decision is documented', () => {
    const outputs = {
      verify: verified, title, problem,
      objectives: { objectives: ['قياس أثر الاستخدام الفعلي للذكاء الاصطناعي على تعلم الباحثين', 'تحديد العوامل التي تؤثر في تبني الذكاء الاصطناعي'] },
      questions: { questions: ['ما أثر الاستخدام الفعلي للذكاء الاصطناعي على تعلم الباحثين؟', 'ما العوامل التي تؤثر في تبني الذكاء الاصطناعي؟'] },
    };
    const gate = evaluateGate('methodology', outputs);
    expect(gate.status).toBe('locked');
    expect(gate.nextStage).toBe('hypotheses');
  });

  test('flags an incompatible qualitative method and questionnaire', () => {
    const gate = evaluateGate('methodology', {
      verify: verified, title, problem,
      objectives: { objectives: ['قياس أثر الاستخدام الفعلي للذكاء الاصطناعي على تعلم الباحثين', 'تحديد العوامل التي تؤثر في تبني الذكاء الاصطناعي'] },
      questions: { questions: ['ما أثر الاستخدام الفعلي للذكاء الاصطناعي على تعلم الباحثين؟', 'ما العوامل التي تؤثر في تبني الذكاء الاصطناعي؟'] },
      hypotheses: { mode: 'required', hypotheses: ['يوجد أثر للاستخدام الفعلي للذكاء الاصطناعي على تعلم الباحثين', 'توجد علاقة بين العوامل المؤثرة وتبني الذكاء الاصطناعي لدى الباحثين'] },
      methodology: { approach: 'qualitative', population: 'طلبة الدراسات العليا المسجلون في الجامعة', sample: 'عينة قصدية متنوعة من طلبة الكليات المختلفة', instrument: 'استبانة محكمة من ثلاثين فقرة أكاديمية' },
    });
    expect(gate.status).toBe('needs_improvement');
    expect(gate.reason).toContain('تعارض');
  });
});
