const generateStructured = jest.fn();

jest.mock('@/lib/ai/geminiClient', () => ({
  generateStructured: (...args: unknown[]) => generateStructured(...args),
}));

import { parseIdeaQueryPlan, planIdeaSearchQueries } from '@/lib/idea-query-planning';

describe('idea query planning', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  test('accepts fenced JSON and removes duplicate query scopes', () => {
    expect(parseIdeaQueryPlan('```json\n{"valid":true,"full":"Digital learning outcomes","focused":"digital learning outcomes","broad":"education"}\n```'))
      .toEqual({ isValid: true, queries: ['Digital learning outcomes', 'education'] });
  });

  test('preserves a semantic rejection from the planner', () => {
    expect(parseIdeaQueryPlan('{"valid":false}')).toEqual({ isValid: false, queries: [] });
  });

  test('uses the shared provider router result', async () => {
    generateStructured.mockResolvedValue({
      output: '{"valid":true,"full":"Generative AI effects on university learning outcomes","focused":"AI university learning","broad":"generative AI"}',
      confidenceLabel: 'عالي',
    });

    await expect(planIdeaSearchQueries('أثر الذكاء الاصطناعي في التعليم الجامعي', 'request-1')).resolves.toEqual({
      isValid: true,
      queries: [
        'Generative AI effects on university learning outcomes',
        'AI university learning',
        'generative AI',
      ],
      mode: 'ai',
    });
    expect(generateStructured).toHaveBeenCalledWith(expect.objectContaining({
      feature: 'idea-query-planning',
      requestId: 'request-1',
    }));
  });

  test('falls back safely to the original topic when every planner fails', async () => {
    generateStructured.mockRejectedValue(new Error('providers unavailable'));

    await expect(planIdeaSearchQueries('التعليم الإلكتروني', 'request-2')).resolves.toEqual({
      isValid: true,
      queries: ['التعليم الإلكتروني'],
      mode: 'raw',
    });
  });
});
