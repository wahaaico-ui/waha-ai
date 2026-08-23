import { evaluateTitleCandidate, recommendedTitle } from '../title-comparison';
import type { EvidencePaper } from '../research-exploration';

const evidence: EvidencePaper[] = Array.from({ length: 6 }, (_, index) => ({
  title: `دراسة مرتبطة ${index + 1}`,
  abstract: 'Academic writing and generative AI among graduate students.',
  year: index < 4 ? 2025 : 2020,
  citations: 10 - index,
  url: `https://example.com/${index + 1}`,
  source: 'openalex',
  countries: index < 2 ? ['SA'] : ['US'],
}));

describe('title comparison', () => {
  test('rewards a scoped title with population, context, and real evidence', () => {
    const result = evaluateTitleCandidate(
      'one',
      'أثر استخدام الذكاء الاصطناعي التوليدي على الكتابة الأكاديمية لدى طلبة الدراسات العليا في المملكة العربية السعودية',
      evidence,
      'المملكة العربية السعودية',
      2026,
    );
    expect(result.clarityScore).toBeGreaterThanOrEqual(80);
    expect(result.contextScore).toBeGreaterThanOrEqual(70);
    expect(result.relevantStudies).toBe(6);
    expect(result.references).toHaveLength(5);
  });

  test('does not recommend an unsupported broad title over a grounded title', () => {
    const grounded = evaluateTitleCandidate('grounded', 'أثر الذكاء الاصطناعي على الكتابة لدى طلبة الجامعات في السعودية', evidence, 'السعودية', 2026);
    const broad = evaluateTitleCandidate('broad', 'الذكاء الاصطناعي والتعليم', [], 'السعودية', 2026);
    expect(recommendedTitle([broad, grounded])?.id).toBe('grounded');
  });
});
