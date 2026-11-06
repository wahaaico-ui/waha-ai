const loadIdeaInsights = jest.fn();
jest.mock('@/lib/idea-selection/openalex-insights', () => ({ loadIdeaInsights: (...args: unknown[]) => loadIdeaInsights(...args) }));

import { POST } from './route';

const call = (body: unknown) => POST(new Request('https://waha.systems/api/idea-insights', { method: 'POST', body: JSON.stringify(body) }));

describe('idea insights route', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    loadIdeaInsights.mockResolvedValue({ query: 'q', timing: { stage: 'peak', total: 10, growth: 2, years: [] }, directions: [], recentYears: [2024, 2025], priorYears: [2022, 2023], source: 'openalex' });
  });

  test('rejects a missing, short or overlong query without calling OpenAlex', async () => {
    expect((await call({})).status).toBe(400);
    expect((await call({ query: 'ab' })).status).toBe(400);
    expect((await call({ query: 'x'.repeat(301) })).status).toBe(400);
    expect(loadIdeaInsights).not.toHaveBeenCalled();
  });

  test('returns the counts for a trimmed query', async () => {
    const response = await call({ query: '  generative AI in higher education  ' });
    expect(response.status).toBe(200);
    expect(loadIdeaInsights).toHaveBeenCalledWith('generative AI in higher education');
    expect((await response.json()).insights.timing.stage).toBe('peak');
  });

  test('says plainly when OpenAlex is unavailable instead of guessing', async () => {
    loadIdeaInsights.mockRejectedValue(new Error('timeout'));
    const response = await call({ query: 'generative AI' });
    expect(response.status).toBe(503);
    expect(await response.json()).not.toHaveProperty('insights');
  });
});
