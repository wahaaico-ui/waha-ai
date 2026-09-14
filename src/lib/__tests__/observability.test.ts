import {
  completeOperationalRequest,
  logOperationalEvent,
  operationalHeaders,
  requestCorrelationId,
  startOperationalRequest,
} from '@/lib/observability';

afterEach(() => {
  jest.restoreAllMocks();
});

test('keeps a valid infrastructure correlation id', () => {
  const request = new Request('https://waha.systems/api/test', { headers: { 'x-vercel-id': 'fra1::abc-123' } });
  expect(requestCorrelationId(request)).toBe('fra1::abc-123');
});

test('replaces an unsafe correlation id', () => {
  const request = new Request('https://waha.systems/api/test', { headers: { 'x-request-id': 'unsafe id' } });
  expect(requestCorrelationId(request)).toMatch(/^[0-9a-f-]{36}$/);
});

test('writes structured allow-listed operational fields only', () => {
  const write = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  logOperationalEvent('warn', {
    event: 'ai.provider_failed',
    route: '/server/structured-generation',
    requestId: 'request-1',
    provider: 'gemini',
    status: 429,
    outcome: 'fallback',
    errorCode: 'provider_http_error',
  });

  const payload = JSON.parse(write.mock.calls[0][0]);
  expect(payload).toMatchObject({
    level: 'warn',
    event: 'ai.provider_failed',
    requestId: 'request-1',
    provider: 'gemini',
    status: 429,
    outcome: 'fallback',
  });
  expect(payload).not.toHaveProperty('prompt');
  expect(payload).not.toHaveProperty('apiKey');
});

test('tracks a request from start to a safe completion event', () => {
  const info = jest.spyOn(console, 'log').mockImplementation(() => undefined);
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  const request = new Request('https://waha.systems/api/test', { headers: { 'x-request-id': 'request-2' } });
  const operation = startOperationalRequest(request, '/api/test', 'api.test.started');

  completeOperationalRequest(operation, 'api.test.completed', 409, 'rejected', 'stage_locked');

  expect(JSON.parse(info.mock.calls[0][0])).toMatchObject({
    event: 'api.test.started',
    route: '/api/test',
    requestId: 'request-2',
  });
  expect(JSON.parse(warn.mock.calls[0][0])).toMatchObject({
    event: 'api.test.completed',
    requestId: 'request-2',
    status: 409,
    outcome: 'rejected',
    errorCode: 'stage_locked',
  });
  expect(operationalHeaders(operation)).toEqual({ 'x-waha-request-id': 'request-2' });
});
