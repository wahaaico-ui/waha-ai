import { POST as research } from '@/app/api/research/route';
import { POST as statistics } from '@/app/api/research-statistics/route';
import { POST as intent } from '@/app/api/analyze-intent/route';
import { POST as analyzeIdea } from '@/app/api/analyze-idea/route';
import { POST as seminar } from '@/app/api/seminar/route';

describe('retired unsafe research routes', () => {
  it.each([
    ['unscoped research pipeline', research, '/research/literature'],
    ['fabricated research statistics', statistics, '/research/analysis'],
    ['legacy keyword intent classifier', intent, '/verify-idea'],
    ['unauthenticated AI idea scoring', analyzeIdea, '/verify-idea'],
    ['fixed seminar alternatives presented as verified', seminar, '/research/seminar'],
  ])('returns 410 for %s without processing attacker input', async (_name, handler, next) => {
    const response = await handler();
    const body = await response.json();

    expect(response.status).toBe(410);
    expect(body.next).toBe(next);
    expect(body.error).toEqual(expect.any(String));
  });
});
