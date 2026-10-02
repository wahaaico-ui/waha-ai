import { expect, test, type Page } from '@playwright/test';

test.use({ trace: 'off', screenshot: 'off', video: 'off' });

const titleText = 'خبرات طلبة الدراسات العليا في استخدام الذكاء الاصطناعي التوليدي للتعلم الأكاديمي';
const questionOne = 'كيف يصف طلبة الدراسات العليا استخدام الذكاء الاصطناعي التوليدي لدعم فهم المفاهيم الأكاديمية المعقدة؟';
const questionTwo = 'كيف يصف طلبة الدراسات العليا التحديات التي تواجههم عند مراجعة دقة مخرجات الذكاء الاصطناعي التوليدي؟';
const resultOne = 'أظهرت الإفادات أن الطلبة يستخدمون الذكاء الاصطناعي التوليدي لتبسيط المفاهيم الأكاديمية المعقدة ودعم الفهم الأولي للمحتوى.';
const resultTwo = 'أظهرت الإفادات أن مراجعة دقة المخرجات وصحة المصادر تمثل تحدياً متكرراً لدى طلبة الدراسات العليا.';
const interpretationOne = 'تشير النتيجة إلى أن استخدام الذكاء الاصطناعي يعمل بوصفه دعماً للفهم الأولي لدى الطلبة، مع بقاء المراجعة العلمية مسؤولية أساسية على الباحث.';
const interpretationTwo = 'تشير النتيجة إلى أن الثقة في المخرجات تظل محدودة عندما لا يستطيع الطلبة التحقق من المصدر أو مقارنة الإجابة بالأدلة الأكاديمية الأصلية.';
const conclusionOne = 'يمكن الاستنتاج أن الذكاء الاصطناعي التوليدي يدعم الفهم الأولي للمفاهيم المعقدة لدى الطلبة ضمن حدود الخبرات والسياق المدروس.';
const conclusionTwo = 'يمكن الاستنتاج أن صعوبة التحقق من دقة المخرجات والمصادر تحد من الاستخدام الأكاديمي الموثوق لدى طلبة الدراسات العليا.';

const stages = [
  // Only the researcher's choice is sent. Decision, coverage and paths come from
  // the server's exploration report, seeded by scripts/run-production-core-e2e.mjs.
  ['verify', {
    selectedResearchPath: { id: 'experiences' },
  }],
  ['title', { title: titleText }],
  ['problem', {
    problemStatement: 'لا تزال خبرات طلبة الدراسات العليا في استخدام الذكاء الاصطناعي التوليدي لفهم المفاهيم الأكاديمية ومراجعة دقة المخرجات غير موصوفة بوضوح في السياق الجامعي المحلي.',
    researchGap: 'لم تحسم الأدلة المتاحة كيف يوازن الطلبة بين دعم الفهم الأولي والتحقق من دقة المصادر والمخرجات في ممارسات التعلم اليومية.',
    researcherNote: 'اخترت هذه المشكلة لارتباطها المباشر بجودة تعلم الباحثين وممارساتهم الأكاديمية اليومية.',
  }],
  ['objectives', { objectives: [
    'تحليل خبرات طلبة الدراسات العليا في استخدام الذكاء الاصطناعي التوليدي لدعم فهم المفاهيم الأكاديمية المعقدة.',
    'تحديد التحديات التي تواجه طلبة الدراسات العليا عند مراجعة دقة مخرجات الذكاء الاصطناعي التوليدي ومصادرها.',
  ] }],
  ['questions', { questions: [questionOne, questionTwo] }],
  ['hypotheses', {
    mode: 'not_applicable',
    rationale: 'تعتمد الدراسة منهجاً نوعياً استكشافياً لفهم الخبرات والتحديات، لذلك لا تتطلب فرضيات إحصائية مسبقة.',
  }],
  ['methodology', {
    approach: 'qualitative',
    population: 'طلبة الدراسات العليا الذين يستخدمون أدوات الذكاء الاصطناعي في تعلمهم الأكاديمي.',
    sample: 'عينة قصدية متنوعة من طلبة الدراسات العليا ذوي الخبرات الأكاديمية المختلفة.',
    instrument: 'مقابلات شبه منظمة تستكشف خبرات الاستخدام والتحقق من دقة المخرجات والمصادر.',
  }],
  ['design', {
    variables: [
      { name: 'خبرات الاستخدام الأكاديمي', role: 'construct', operationalDefinition: 'الأوصاف التي يقدمها الطلبة لطرق استخدام الذكاء الاصطناعي في فهم المحتوى الأكاديمي.' },
      { name: 'تحديات التحقق من المخرجات', role: 'construct', operationalDefinition: 'الصعوبات التي يصفها الطلبة عند فحص دقة الإجابات والمصادر الأكاديمية المرتبطة بها.' },
    ],
    population: { description: 'طلبة الدراسات العليا الذين لديهم خبرة فعلية باستخدام الذكاء الاصطناعي في التعلم الأكاديمي.' },
    sample: {
      strategy: 'عينة قصدية متنوعة الخبرات والتخصصات الأكاديمية.',
      inclusionCriteria: 'طالب دراسات عليا استخدم أداة ذكاء اصطناعي في مهمة تعلم أكاديمية واحدة على الأقل.',
      sizeRationale: 'يتحدد حجم العينة وفق تشبع المعاني وتنوع الخبرات المرتبطة بسؤالي الدراسة.',
    },
  }],
  ['instrument', {
    instrumentType: 'interview',
    title: 'دليل مقابلة خبرات استخدام الذكاء الاصطناعي التوليدي',
    consentStatement: 'المشاركة طوعية وتستخدم الإجابات لأغراض البحث فقط، ويمكن للمشارك الانسحاب قبل إنهاء المقابلة.',
    instructions: 'اطرح الأسئلة بترتيب مرن، واستخدم أسئلة متابعة محايدة من دون توجيه إجابة المشارك.',
    sections: [
      { title: 'خبرات الاستخدام الأكاديمي', variableName: 'خبرات الاستخدام الأكاديمي', items: [
        { text: 'كيف تستخدم الذكاء الاصطناعي لفهم المحتوى الأكاديمي المعقد؟' },
        { text: 'ما الفائدة التي تلاحظها أثناء التعلم باستخدام هذه الأدوات؟' },
      ] },
      { title: 'تحديات التحقق من المخرجات', variableName: 'تحديات التحقق من المخرجات', items: [
        { text: 'كيف تتحقق من دقة الإجابات والمصادر التي تقدمها الأداة؟' },
        { text: 'ما الصعوبات التي تواجهك عند مراجعة المخرجات أكاديمياً؟' },
      ] },
    ],
  }],
  // Studies are selected by server-held search-result ids (Slice 1). The runner
  // seeds results whose paper ids are paper-ai-learning, paper-ai-literacy and
  // paper-ai-trust, which the analysis and discussion stages cite below.
  ['literature', { resultIds: (process.env.E2E_JOURNEY_LITERATURE_RESULT_IDS || '').split(',').filter(Boolean) }],
  ['analysis', {
    introduction: 'تتناول الأدبيات خبرات استخدام الذكاء الاصطناعي في التعلم الأكاديمي والحاجة إلى التحقق النقدي من المخرجات.',
    thematicSynthesis: 'تتقاطع الدراسات في إبراز فائدة الدعم الأولي للفهم، لكنها تؤكد أن الثقة الأكاديمية تتطلب مراجعة المصادر والأدلة الأصلية.',
    themes: [
      { title: 'دعم الفهم الأكاديمي', synthesis: 'تشير الدراسة المختارة إلى أن الذكاء الاصطناعي يساعد الطلبة في تبسيط المفاهيم وتكوين فهم أولي للمحتوى المعقد.', supportingPaperIds: ['paper-ai-learning'] },
      { title: 'التحقق والثقة', synthesis: 'توضح الأدلة المختارة أن محو الأمية بالذكاء الاصطناعي والتحقق من المصادر عنصران أساسيان للاستخدام الأكاديمي الموثوق.', supportingPaperIds: ['paper-ai-literacy', 'paper-ai-trust'] },
    ],
    researchGapsIdentified: ['الحاجة إلى وصف خبرات طلبة الدراسات العليا في السياق الجامعي المحلي.'],
    conclusion: 'تدعم الأدبيات دراسة خبرات الاستخدام والتحقق معاً لفهم الفائدة والحدود في التعلم الأكاديمي.',
    limitations: ['تعكس الدراسات المختارة سياقات جامعية متنوعة ولا تمثل السياق المحلي بصورة كاملة.'],
  }],
  ['analysis_input', {
    analysisKind: 'qualitative', analyzedBy: 'researcher', softwareOrMethod: 'تحليل موضوعي نوعي',
    sampleAnalyzed: 'نصوص مقابلات مجهولة الهوية من عينة طلبة الدراسات العليا المعتمدة.',
    procedureSummary: 'رُمزت الإفادات موضوعياً ثم ربطت الأنماط المتكررة بكل سؤال بحث معتمد من دون رفع النصوص الخام.',
    findings: [
      { questionIndex: 0, questionText: questionOne, hypothesisIndex: null, hypothesisText: null, findingSummary: resultOne, evidenceSummary: 'تكررت أوصاف تبسيط المفاهيم وبناء الفهم الأولي عبر الإفادات المحللة.' },
      { questionIndex: 1, questionText: questionTwo, hypothesisIndex: null, hypothesisText: null, findingSummary: resultTwo, evidenceSummary: 'تكررت إشارات صعوبة فحص المصدر ومقارنة المخرج بالأدلة الأصلية.' },
    ],
    limitations: 'تقتصر المخرجات على العينة والسياق الجامعي اللذين شملهما التحليل النوعي.',
    noRawDataConfirmed: true, noPersonalDataConfirmed: true,
  }],
  ['results', {
    results: [
      { questionIndex: 0, questionText: questionOne, hypothesisIndex: null, hypothesisText: null, sourceFindingSummary: resultOne, sourceEvidenceSummary: 'تكررت أوصاف تبسيط المفاهيم وبناء الفهم الأولي عبر الإفادات المحللة.', resultStatement: resultOne },
      { questionIndex: 1, questionText: questionTwo, hypothesisIndex: null, hypothesisText: null, sourceFindingSummary: resultTwo, sourceEvidenceSummary: 'تكررت إشارات صعوبة فحص المصدر ومقارنة المخرج بالأدلة الأصلية.', resultStatement: resultTwo },
    ],
    overallSummary: 'أظهرت المخرجات أن الطلبة يستفيدون من تبسيط المفاهيم أكاديمياً، بينما تظل مراجعة دقة المخرجات والمصادر تحدياً متكرراً في خبراتهم.',
    limitations: 'تقتصر النتائج على العينة والسياق المشمولين في التحليل النوعي المعتمد.', reportingOnlyConfirmed: true,
  }],
  ['discussion', {
    discussions: [
      { questionIndex: 0, questionText: questionOne, resultStatement: resultOne, interpretation: interpretationOne, literatureComparison: 'تتسق هذه القراءة بحذر مع الدراسة المختارة التي تصف دور الذكاء الاصطناعي في تبسيط المفاهيم وتكوين فهم أكاديمي أولي.', supportingPaperIds: ['paper-ai-learning'] },
      { questionIndex: 1, questionText: questionTwo, resultStatement: resultTwo, interpretation: interpretationTwo, literatureComparison: 'تتقاطع النتيجة مع الأدلة المختارة التي تربط الاستخدام الموثوق بمحو الأمية بالذكاء الاصطناعي وفحص المصادر الأصلية.', supportingPaperIds: ['paper-ai-literacy'] },
    ],
    overallSynthesis: 'توضح المناقشة أن الفائدة التعليمية ودقة المخرجات جانبان مترابطان؛ فالدعم الأولي للفهم لا يلغي الحاجة إلى المراجعة النقدية للمصادر.',
    limitationsInterpretation: 'يقتصر تفسير النتائج على خبرات العينة والسياق الجامعي والمنهج النوعي المستخدم.', evidenceGroundingConfirmed: true, noNewResultsConfirmed: true,
  }],
  ['conclusions', {
    conclusions: [
      { questionIndex: 0, questionText: questionOne, resultStatement: resultOne, discussionInterpretation: interpretationOne, conclusionStatement: conclusionOne },
      { questionIndex: 1, questionText: questionTwo, resultStatement: resultTwo, discussionInterpretation: interpretationTwo, conclusionStatement: conclusionTwo },
    ],
    overallConclusion: 'تخلص الدراسة إلى أن استخدام الذكاء الاصطناعي يدعم الفهم الأولي، لكن موثوقية استخدامه الأكاديمي تبقى مرتبطة بقدرة الطلبة على التحقق النقدي.',
    scopeStatement: 'تنطبق الاستنتاجات ضمن حدود عينة طلبة الدراسات العليا والسياق الجامعي والمنهج النوعي المستخدم.', noNewEvidenceConfirmed: true, noRecommendationsConfirmed: true,
  }],
  ['recommendations', {
    recommendations: [
      { questionIndex: 0, questionText: questionOne, conclusionStatement: conclusionOne, recommendationType: 'practice', targetAudience: 'مراكز دعم الطلبة', implementationHorizon: 'short_term', recommendationText: 'تطوير إرشادات تعلم توضح للطلبة كيفية استخدام الذكاء الاصطناعي لتكوين فهم أولي مع المحافظة على القراءة النقدية للمحتوى الأكاديمي.' },
      { questionIndex: 1, questionText: questionTwo, conclusionStatement: conclusionTwo, recommendationType: 'practice', targetAudience: 'المكتبات الجامعية', implementationHorizon: 'short_term', recommendationText: 'تقديم تدريب تطبيقي يساعد طلبة الدراسات العليا على فحص المصادر ومقارنة مخرجات الذكاء الاصطناعي بالأدلة الأكاديمية الأصلية.' },
    ],
    overallPriorities: 'تبدأ الأولوية ببناء مهارات التحقق النقدي لدى الطلبة، بالتوازي مع توضيح الاستخدام المسؤول للأدوات في أنشطة التعلم الأكاديمي.',
    feasibilityNote: 'يمكن تنفيذ الإرشادات والتدريب ضمن خدمات الدعم الأكاديمي الحالية مع مراجعتها وفق احتياجات التخصصات.', conclusionGroundingConfirmed: true, noNewFindingsConfirmed: true,
  }],
  ['publication', {
    approvedTitle: titleText, targetType: 'journal', targetName: 'مجلة دراسات التعليم الجامعي', manuscriptLanguage: 'ar', citationStyle: 'apa7',
    structuredAbstract: {
      background: 'لا تزال خبرات طلبة الدراسات العليا في استخدام الذكاء الاصطناعي لفهم المفاهيم ومراجعة دقة المخرجات غير موصوفة بوضوح في السياق الجامعي.',
      objective: 'هدفت الدراسة إلى تحليل خبرات الاستخدام الأكاديمي وتحديد تحديات التحقق من المخرجات والمصادر لدى طلبة الدراسات العليا.',
      methods: 'اتبعت الدراسة منهجاً نوعياً واعتمدت عينة قصدية من طلبة الدراسات العليا ومقابلات شبه منظمة وتحليلاً موضوعياً للإفادات المجهولة.',
      results: 'أظهرت النتائج أن الذكاء الاصطناعي يدعم تبسيط المفاهيم والفهم الأولي، بينما تمثل مراجعة دقة المخرجات والمصادر تحدياً متكرراً لدى الطلبة.',
      conclusion: 'خلصت الدراسة إلى أن دعم الفهم الأولي يرتبط بالحاجة إلى مهارات تحقق نقدي تضمن موثوقية الاستخدام الأكاديمي لدى الطلبة.',
    },
    keywords: ['الذكاء الاصطناعي التوليدي', 'طلبة الدراسات العليا', 'التعلم الأكاديمي', 'التحقق النقدي'],
    ethicsStatus: 'not_required', ethicsStatement: 'وثقت الدراسة أن المراجعة الأخلاقية غير مطلوبة لهذا الاختبار التقني ذي البيانات المصطنعة.',
    conflictOfInterestStatement: 'لا يوجد تضارب مصالح مرتبط بهذه الدراسة.', fundingStatement: 'لم تتلق الدراسة تمويلاً خارجياً.',
    dataAvailabilityStatement: 'تتوفر المخرجات المجهولة وفق ضوابط المؤسسة ولا تتضمن بيانات شخصية.',
    aiUseDisclosure: 'استُخدمت WAHA لتنظيم المراحل وفحص الاتساق، وبقيت المراجعة العلمية ومسؤولية القرار على الباحث.',
    originalSourcesReviewedConfirmed: true, authorshipConfirmed: true, venueGuidelinesConfirmed: true, noAcceptanceGuaranteeConfirmed: true,
  }],
] as const;

async function postStage(page: Page, projectId: string, stage: string, content: unknown) {
  return page.evaluate(async ({ projectId, stage, content }) => {
    const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/journey`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ stage, content }),
    });
    return { status: response.status, body: await response.json() };
  }, { projectId, stage, content });
}

test('@critical completes and renders the full research journey', async ({ page }) => {
  test.setTimeout(120_000);
  const email = process.env.E2E_JOURNEY_EMAIL;
  const password = process.env.E2E_JOURNEY_PASSWORD;
  const projectId = process.env.E2E_JOURNEY_PROJECT_ID;
  test.skip(!email || !password || !projectId || !process.env.E2E_JOURNEY_LITERATURE_RESULT_IDS, 'Set temporary E2E journey credentials, project ID and seeded literature result IDs.');
  if (!email || !password || !projectId) throw new Error('Temporary journey account is required.');

  await page.goto('/login');
  await page.locator('#login-email').fill(email);
  await page.locator('#login-password').fill(password);
  await page.getByRole('button', { name: 'تسجيل الدخول' }).click();
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 20_000 });

  for (const [stage, content] of stages) {
    const response = await postStage(page, projectId, stage, content);
    expect(response.status, `${stage}: ${JSON.stringify(response.body)}`).toBe(200);
    expect(response.body.nextStage).toBe(stage === 'publication' ? null : stages[stages.findIndex(([id]) => id === stage) + 1][0]);
  }

  await page.goto(`/research/journey?projectId=${projectId}`, { waitUntil: 'load' });
  await expect(page.getByText('17/17')).toBeVisible();
  await expect(page.getByText('اكتملت الرحلة البحثية')).toBeVisible();
  await page.getByRole('link', { name: /فتح التقرير النهائي/ }).click();
  await expect(page).toHaveURL(new RegExp(`/research/seminar\\?projectId=${projectId}$`));
  await expect(page.getByRole('heading', { name: titleText })).toBeVisible();
  await expect(page.getByText('WAHA · تقرير سيمنار بحثي')).toBeVisible();
});
