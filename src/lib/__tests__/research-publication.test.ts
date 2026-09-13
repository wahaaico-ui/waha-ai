import {
  buildPublicationDraft,
  researchPublicationConsistencyIssue,
  researchPublicationStructureIssue,
  type ResearchPublicationOutput,
} from '@/lib/research-publication';

const sources = {
  title: { title: 'أثر استخدام الذكاء الاصطناعي في جودة تعلم طلبة الدراسات العليا' },
  problem: { problemStatement: 'لا يزال أثر استخدام الذكاء الاصطناعي في جودة تعلم طلبة الدراسات العليا غير واضح ضمن السياق الجامعي المحلي.' },
  objectives: { objectives: ['قياس أثر استخدام الذكاء الاصطناعي في جودة تعلم طلبة الدراسات العليا ضمن السياق الجامعي المحلي.'] },
  methodology: { approach: 'quantitative', population: 'طلبة الدراسات العليا في الجامعة', sample: 'عينة طبقية من طلبة الكليات', instrument: 'استبانة أكاديمية محكمة تقيس الاستخدام وجودة التعلم' },
  design: { population: { description: 'طلبة الدراسات العليا المسجلون في الجامعة خلال الفصل الحالي.' }, sample: { strategy: 'عينة طبقية من طلبة الكليات المختلفة.' } },
  results: {
    results: [{ resultStatement: 'أظهرت النتائج ارتباط استخدام الذكاء الاصطناعي بتحسن جودة التعلم لدى أفراد العينة الحالية.' }],
    overallSummary: 'أظهرت النتائج ارتباط استخدام الذكاء الاصطناعي بتحسن جودة التعلم لدى أفراد العينة الحالية ضمن السياق الجامعي المحدد.',
  },
  conclusions: {
    conclusions: [{ conclusionStatement: 'يرتبط استخدام الذكاء الاصطناعي بتحسن جودة التعلم ضمن حدود العينة والمنهج المستخدم.' }],
    overallConclusion: 'تخلص الدراسة إلى ارتباط استخدام الذكاء الاصطناعي بتحسن جودة التعلم ضمن حدود العينة والسياق والمنهج المستخدم.',
  },
};

function completePublication(): ResearchPublicationOutput {
  const draft = buildPublicationDraft(sources);
  if (!draft) throw new Error('Expected a publication draft');
  return {
    ...draft,
    targetName: 'مجلة الدراسات التربوية المعاصرة',
    ethicsStatus: 'approved' as const,
    ethicsStatement: 'حصلت الدراسة على موافقة لجنة الأخلاقيات المختصة قبل جمع بيانات المشاركين.',
    dataAvailabilityStatement: 'تتاح البيانات المجهولة الهوية وفق موافقة الجهة الأكاديمية والضوابط الأخلاقية للدراسة.',
    authorshipConfirmed: true,
    venueGuidelinesConfirmed: true,
  };
}

describe('research publication readiness stage', () => {
  test('builds the structured abstract from approved journey outputs', () => {
    const draft = buildPublicationDraft(sources);
    expect(draft?.approvedTitle).toBe(sources.title.title);
    expect(draft?.structuredAbstract.results).toBe(sources.results.overallSummary);
    expect(draft?.ethicsStatus).toBe('pending');
  });

  test('accepts a complete and grounded publication package', () => {
    const publication = completePublication();
    expect(researchPublicationStructureIssue(publication)).toBeNull();
    expect(researchPublicationConsistencyIssue(publication, sources)).toBeNull();
  });

  test('blocks readiness while ethics review is pending', () => {
    const publication = completePublication();
    publication.ethicsStatus = 'pending';
    expect(researchPublicationStructureIssue(publication)).toContain('معلّقة');
  });

  test('rejects a title that differs from the approved journey title', () => {
    const publication = completePublication();
    publication.approvedTitle = 'عنوان مختلف لا يمت إلى العنوان المعتمد بصلة واضحة';
    expect(researchPublicationConsistencyIssue(publication, sources)).toContain('العنوان المعتمد');
  });

  test('rejects unsupported numbers introduced into the abstract', () => {
    const publication = completePublication();
    publication.structuredAbstract.results += ' وبلغ التحسن 97% وفق المخرجات.';
    expect(researchPublicationConsistencyIssue(publication, sources)).toContain('97%');
  });

  test('rejects an abstract section unrelated to the approved source stage', () => {
    const publication = completePublication();
    publication.structuredAbstract.results = 'تتناول المدن الساحلية إدارة النفايات المنزلية خلال مواسم السياحة والتوسع العمراني.';
    expect(researchPublicationConsistencyIssue(publication, sources)).toContain('النتائج المعتمدة');
  });

  test('recognizes approved statistical values adjacent to symbols', () => {
    const withStatisticalSymbols = {
      ...sources,
      results: { results: [{ resultStatement: 'أظهرت النتائج قيمة p=0.01 ومعامل β=0.42 في التحليل المعتمد.' }] },
    };
    const publication = buildPublicationDraft(withStatisticalSymbols)!;
    publication.targetName = 'مجلة الدراسات التربوية';
    publication.ethicsStatus = 'not_required';
    publication.ethicsStatement = 'أكدت الجهة المختصة أن الدراسة لا تتطلب موافقة أخلاقية مستقلة.';
    publication.dataAvailabilityStatement = 'تتاح البيانات المجهولة وفق ضوابط الجهة البحثية وبعد تقديم طلب مبرر.';
    publication.authorshipConfirmed = true;
    publication.venueGuidelinesConfirmed = true;
    expect(researchPublicationConsistencyIssue(publication, withStatisticalSymbols)).toBeNull();
  });
});
