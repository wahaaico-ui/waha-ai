import { safeAuthRedirect } from '../auth/safe-redirect';

describe('safeAuthRedirect', () => {
  test('preserves approved project routes and query parameters', () => {
    expect(safeAuthRedirect('/research/journey?projectId=project-1')).toBe('/research/journey?projectId=project-1');
    expect(safeAuthRedirect('/projects/workspace?projectId=project-2')).toBe('/projects/workspace?projectId=project-2');
  });

  test.each([
    'https://attacker.example/path',
    '//attacker.example/path',
    '/\\attacker.example/path',
    'javascript:alert(1)',
    '/unapproved-route',
  ])('rejects an unsafe redirect: %s', (value) => {
    expect(safeAuthRedirect(value)).toBe('/dashboard');
  });

  test('uses the requested fallback when no value is supplied', () => {
    expect(safeAuthRedirect(null, '/verify-idea')).toBe('/verify-idea');
  });
});
