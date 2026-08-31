import { createResearchObjectView, evaluateQuestionsHypothesesConsistency } from '@/lib/research-objects';
import type { JourneyDocumentSnapshot } from '@/lib/research-objects';

const projectId = 'project-question-hypothesis';
const base = { project_id: projectId, version: 1, created_at: '2026-08-31T10:00:00.000Z' };

function view(questions: string[], hypotheses?: string[]) {
  const documents: JourneyDocumentSnapshot[] = [
    { ...base, id: 'questions-v1', type: 'journey:questions', content: { questions } },
    ...(hypotheses ? [{ ...base, id: 'hypotheses-v1', type: 'journey:hypotheses', content: { mode: 'required', hypotheses, rationale: '' } }] : []),
  ];
  return createResearchObjectView(projectId, documents);
}

describe('questions-hypotheses consistency', () => {
  test('passes aligned and testable hypotheses', () => {
    const report = evaluateQuestionsHypothesesConsistency(view(
      ['ما أثر التعلم الإلكتروني على تحصيل طلبة التمريض؟'],
      ['يوجد أثر للتعلم الإلكتروني على تحصيل طلبة التمريض.'],
    ), { mode: 'required', checkedAt: '2026-08-31T12:00:00.000Z' });
    expect(report.status).toBe('passed');
    expect(report.coverageScore).toBe(100);
    expect(report.results[0].hypothesisId).not.toBeNull();
  });

  test('fails a hypothesis unrelated to its question', () => {
    const report = evaluateQuestionsHypothesesConsistency(view(
      ['ما أثر التعلم الإلكتروني على تحصيل طلبة التمريض؟'],
      ['توجد علاقة بين أسعار العقارات وحركة السياحة الساحلية.'],
    ), { mode: 'required' });
    expect(report.status).toBe('failed');
    expect(report.issues).toContain('الفرضية لا تعكس المفاهيم الأساسية في السؤال المقابل.');
  });

  test('accepts a documented no-hypotheses decision for qualitative questions', () => {
    const report = evaluateQuestionsHypothesesConsistency(view([
      'كيف يصف طلبة التمريض خبراتهم مع التعلم الإلكتروني؟',
    ]), {
      mode: 'not_applicable',
      rationale: 'الدراسة نوعية استكشافية وتهدف إلى فهم الخبرات دون اختبار علاقة كمية مسبقة.',
    });
    expect(report.status).toBe('passed');
    expect(report.mode).toBe('not_applicable');
  });

  test('rejects skipping hypotheses for a quantitative question', () => {
    const report = evaluateQuestionsHypothesesConsistency(view([
      'ما أثر التعلم الإلكتروني على تحصيل طلبة التمريض؟',
    ]), {
      mode: 'not_applicable',
      rationale: 'يريد الباحث الاكتفاء بالأسئلة رغم أن السؤال يختبر أثراً كمياً واضحاً.',
    });
    expect(report.status).toBe('failed');
  });
});
