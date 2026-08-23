import { evaluateGate, nextAllowedStage, stageComplete } from '../research-workflow';

const verified = {
  decision: 'proceed',
  topic: 'أثر الذكاء الاصطناعي على التعلم',
  searchCoverage: { uniqueStudies: 12 },
  researchPaths: [{ id: 'local' }, { id: 'recent' }, { id: 'comparison' }],
};
const title = { title: 'أثر الذكاء الاصطناعي التوليدي على تعلم طلبة الدراسات العليا' };
const problem = { problemStatement: 'لا يزال أثر استخدام الذكاء الاصطناعي التوليدي على تعلم طلبة الدراسات العليا غير واضح في السياق المحلي.', researchGap: 'توجد ندرة في الدراسات التي تربط الاستخدام الفعلي للذكاء الاصطناعي بتحسن مهارات التعلم لدى طلبة الدراسات العليا.', researcherNote: 'اخترت المشكلة لأنها تمس تجربة الباحثين اليومية وتحتاج فهماً مرتبطاً ببيئتهم.' };

describe('research workflow quality gates', () => {
  test('does not open a stage before all preceding stages are complete', () => {
    const gate = evaluateGate('problem', { verify: verified });
    expect(gate.status).toBe('locked');
    expect(gate.nextStage).toBe('title');
  });

  test('does not accept a numeric decision without enough evidence and grounded paths', () => {
    expect(stageComplete('verify', { decision: 'proceed', acceptanceScore: 85 })).toBe(false);
    expect(stageComplete('verify', { decision: 'proceed', searchCoverage: { uniqueStudies: 8 }, researchPaths: [{ id: 'one' }] })).toBe(false);
    expect(stageComplete('verify', verified)).toBe(true);
  });

  test('rejects an incomplete research problem without opening the next stage', () => {
    const gate = evaluateGate('problem', { verify: verified, title, problem: { problemStatement: 'قصيرة', researchGap: '', researcherNote: '' } });
    expect(gate.status).toBe('needs_improvement');
    expect(gate.nextStage).toBe('problem');
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
    expect(nextAllowedStage({ verify: verified, title, problem, objectives: { objectives: ['هدف أول واضح', 'هدف ثان واضح'] }, questions: { questions: ['سؤال بحثي أول واضح', 'سؤال بحثي ثان واضح'] }, methodology: { approach: 'quantitative', population: 'طلبة الدراسات العليا', sample: 'عينة طبقية', instrument: 'استبانة محكمة' }, literature: { papers: [{ id: '1' }, { id: '2' }, { id: '3' }] } })).toBe('analysis');
  });

  test('flags an incompatible qualitative method and questionnaire', () => {
    const gate = evaluateGate('methodology', {
      verify: verified, title, problem,
      objectives: { objectives: ['قياس أثر الاستخدام الفعلي للذكاء الاصطناعي على تعلم الباحثين', 'تحديد العوامل التي تؤثر في تبني الذكاء الاصطناعي'] },
      questions: { questions: ['ما أثر الاستخدام الفعلي للذكاء الاصطناعي على تعلم الباحثين؟', 'ما العوامل التي تؤثر في تبني الذكاء الاصطناعي؟'] },
      methodology: { approach: 'qualitative', population: 'طلبة الدراسات العليا', sample: 'عينة قصدية من الطلبة', instrument: 'استبانة محكمة من ثلاثين فقرة' },
    });
    expect(gate.status).toBe('needs_improvement');
    expect(gate.reason).toContain('تعارض');
  });
});
