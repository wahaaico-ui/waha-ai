import {
  completeOperationalRequest,
  logOperationalEvent,
  operationalHeaders,
  requestCorrelationId,
  startOperationalRequest,
  type OperationalEvent,
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

describe('runtime operational log boundary', () => {
  const base = { event: 'research.test.completed', route: '/api/projects/[projectId]/journey' };
  const runtimeEvent = (value: unknown) => value as OperationalEvent;
  const capture = () => jest.spyOn(console, 'log').mockImplementation(() => undefined);

  test('projects only allowed fields and prevents metadata overrides from runtime extras', () => {
    const write = capture();
    logOperationalEvent('info', runtimeEvent({
      ...base,
      level: 'error', timestamp: 'forged', prompt: 'private manuscript', apiKey: 'private-key',
      email: 'private@example.invalid', output: 'unreviewed output', userId: 'private-user',
      requestId: 'fra1::request-123', feature: 'citation-assessment', stage: 'literature',
      status: 200, durationMs: 12.5, outcome: 'success',
      toJSON: () => ({ apiKey: 'must-never-be-called' }),
    }));
    const payload = JSON.parse(write.mock.calls[0][0]);
    expect(payload).toEqual({
      ...base, level: 'info', timestamp: expect.any(String), requestId: 'fra1::request-123',
      feature: 'citation-assessment', stage: 'literature', status: 200, durationMs: 12.5, outcome: 'success',
    });
    expect(Number.isNaN(Date.parse(payload.timestamp))).toBe(false);
    expect(write.mock.calls[0][0]).not.toMatch(/private|forged|must-never/);
  });

  test('keeps current scholarly identity diagnostics with only their safe values', () => {
    const write = capture();
    const candidates = ['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222'];
    logOperationalEvent('info', {
      ...base, route: 'storeSearchResults', diagnostics: {
        position: 0, provider: 'openalex', identifierSchemes: ['openalex', 'pmid'], candidateWorkIds: candidates, rows: 1000,
        query: 'private research query', apiKey: 'private-key',
      },
    });
    expect(JSON.parse(write.mock.calls[0][0]).diagnostics).toEqual({
      position: 0, rows: 1000, provider: 'openalex', identifierSchemes: ['openalex', 'pmid'], candidateWorkIds: candidates,
    });
    expect(write.mock.calls[0][0]).not.toMatch(/private/);
  });

  test.each(['openalex', 'semantic-scholar', 'crossref', 'core', 'arxiv', 'europe-pmc', 'openaire', 'plos', 'doab', 'datacite', 'pubmed'])('retains existing academic diagnostic provider %s', (provider) => {
    const write = capture();
    logOperationalEvent('info', { ...base, diagnostics: { provider } });
    expect(JSON.parse(write.mock.calls[0][0]).diagnostics).toEqual({ provider });
  });

  test('rejects invalid numeric values, unknown enums and free text identifiers', () => {
    const write = capture();
    logOperationalEvent('info', runtimeEvent({
      event: 'secret research title', route: '/api/test?token=private',
      requestId: 'unsafe\nrequest', feature: '<script>private</script>', stage: { secret: 'private' }, errorCode: 'a'.repeat(129),
      durationMs: Infinity, status: 600, provider: 'unknown-provider', outcome: 'invented-success',
      diagnostics: { position: -1, rows: Number.MAX_SAFE_INTEGER + 1, provider: 'private provider name', identifierSchemes: ['doi', 'private-token', 123], candidateWorkIds: ['private@example.invalid', '11111111-1111-4111-8111-111111111111'] },
    }));
    expect(JSON.parse(write.mock.calls[0][0])).toEqual({
      level: 'info', timestamp: expect.any(String), event: 'operational.invalid_event', route: 'unknown',
      diagnostics: { identifierSchemes: ['doi'], candidateWorkIds: ['11111111-1111-4111-8111-111111111111'] },
    });
  });

  test.each([NaN, Infinity, -1, 86_400_001, '12', BigInt(12)])('omits invalid duration %s without coercion', (durationMs) => {
    const write = capture();
    logOperationalEvent('info', runtimeEvent({ ...base, durationMs }));
    expect(JSON.parse(write.mock.calls[0][0])).not.toHaveProperty('durationMs');
  });

  test.each([0, 99, 600, 200.5, NaN, Infinity, '200', BigInt(200)])('omits invalid HTTP status %s without coercion', (status) => {
    const write = capture();
    logOperationalEvent('info', runtimeEvent({ ...base, status }));
    expect(JSON.parse(write.mock.calls[0][0])).not.toHaveProperty('status');
  });

  test.each([100, 200, 429, 599, null])('preserves bounded HTTP status %s', (status) => {
    const write = capture();
    logOperationalEvent('info', { ...base, status });
    expect(JSON.parse(write.mock.calls[0][0]).status).toBe(status);
  });

  test('bounds identifiers, model tokens and diagnostic arrays without reading excess entries', () => {
    const write = capture();
    const notRead = jest.fn(() => { throw new Error('excess diagnostic getter'); });
    const candidateWorkIds = Array.from({ length: 70 }, () => '11111111-1111-4111-8111-111111111111');
    Object.defineProperty(candidateWorkIds, '50', { get: notRead });
    logOperationalEvent('info', {
      ...base, requestId: 'a'.repeat(128), feature: 'b'.repeat(129), model: 'm'.repeat(128), requestedModel: 'n'.repeat(129),
      diagnostics: { identifierSchemes: Array.from({ length: 70 }, () => 'doi'), candidateWorkIds },
    });
    const payload = JSON.parse(write.mock.calls[0][0]);
    expect(payload.requestId).toHaveLength(128);
    expect(payload.model).toHaveLength(128);
    expect(payload).not.toHaveProperty('feature');
    expect(payload).not.toHaveProperty('requestedModel');
    expect(payload.diagnostics.candidateWorkIds).toHaveLength(50);
    expect(payload.diagnostics.identifierSchemes).toHaveLength(50);
    expect(notRead).not.toHaveBeenCalled();
    expect(write.mock.calls[0][0].length).toBeLessThan(5000);
  });

  test('keeps compatible requested model and a separate reported response version', () => {
    const write = capture();
    logOperationalEvent('info', {
      ...base, provider: 'gemini', model: 'gemini-flash-latest', requestedModel: 'gemini-flash-latest',
      reportedModel: 'models/gemini-2.5-flash-001', modelVersionStatus: 'reported',
    });
    expect(JSON.parse(write.mock.calls[0][0])).toMatchObject({
      model: 'gemini-flash-latest', requestedModel: 'gemini-flash-latest',
      reportedModel: 'models/gemini-2.5-flash-001', modelVersionStatus: 'reported',
    });
  });

  test.each(['private model name', 'model\n', '/model', 'a'.repeat(129), '<private>', '', BigInt(1)])('does not turn invalid reported model %s into a reported version', (reportedModel) => {
    const write = capture();
    logOperationalEvent('info', runtimeEvent({ ...base, reportedModel, modelVersionStatus: 'reported' }));
    expect(JSON.parse(write.mock.calls[0][0])).toMatchObject({ reportedModel: null, modelVersionStatus: 'not_reported' });
  });

  test.each(['gpt-4.1-mini-2025-04-14', 'openai/gpt-oss-120b', 'vendor:model@v1+release'])('accepts conservative model token %s', (model) => {
    const write = capture();
    logOperationalEvent('info', { ...base, model, requestedModel: model, reportedModel: model, modelVersionStatus: 'reported' });
    expect(JSON.parse(write.mock.calls[0][0])).toMatchObject({ model, requestedModel: model, reportedModel: model, modelVersionStatus: 'reported' });
  });

  test('records explicitly unreported model version without inventing one', () => {
    const write = capture();
    logOperationalEvent('info', { ...base, model: 'gpt-4.1-mini', reportedModel: null, modelVersionStatus: 'not_reported' });
    expect(JSON.parse(write.mock.calls[0][0])).toMatchObject({ model: 'gpt-4.1-mini', reportedModel: null, modelVersionStatus: 'not_reported' });
  });

  test('does not invoke getters, inherited properties, conversion hooks or circular values', () => {
    const write = capture();
    const touched = jest.fn(() => { throw new Error('must not execute'); });
    const circular: Record<string, unknown> = {}; circular.self = circular;
    const diagnostics = Object.create({ rows: 500, provider: 'openalex' });
    Object.defineProperty(diagnostics, 'position', { get: touched });
    Object.defineProperty(diagnostics, 'identifierSchemes', { value: ['doi', circular, BigInt(1)] });
    const event = Object.assign(Object.create({ requestId: 'inherited-id' }), base, { diagnostics, circular, apiKey: BigInt(2), toJSON: touched });
    Object.defineProperty(event, 'model', { get: touched });
    Object.defineProperty(event, 'reportedModel', { get: touched });
    expect(() => logOperationalEvent('info', event)).not.toThrow();
    const payload = JSON.parse(write.mock.calls[0][0]);
    expect(payload.diagnostics).toEqual({ identifierSchemes: ['doi'] });
    expect(payload).not.toHaveProperty('requestId');
    expect(payload).not.toHaveProperty('model');
    expect(payload).not.toHaveProperty('reportedModel');
    expect(touched).not.toHaveBeenCalled();
  });

  test('does not fail requests on throwing or revoked proxy descriptors', () => {
    const write = capture();
    const proxy = new Proxy({}, { getOwnPropertyDescriptor: () => { throw new Error('unavailable'); } });
    const revoked = Proxy.revocable([], {}); revoked.revoke();
    expect(() => logOperationalEvent('info', runtimeEvent(proxy))).not.toThrow();
    expect(() => logOperationalEvent('info', runtimeEvent({ ...base, diagnostics: { candidateWorkIds: revoked.proxy } }))).not.toThrow();
    expect(write).toHaveBeenCalledTimes(2);
  });

  test.each([null, undefined, 'untrusted text', BigInt(1), Symbol('untrusted')])('does not fail on malformed runtime event %s', (value) => {
    const write = capture();
    expect(() => logOperationalEvent('info', runtimeEvent(value))).not.toThrow();
    expect(JSON.parse(write.mock.calls[0][0])).toMatchObject({ event: 'operational.invalid_event', route: 'unknown' });
  });

  test.each(['log', 'warn', 'error'] as const)('never fails a request when console.%s is unavailable', (method) => {
    const write = jest.spyOn(console, method).mockImplementation(() => { throw new Error('log sink unavailable'); });
    const level = method === 'log' ? 'info' : method;
    expect(() => logOperationalEvent(level, base)).not.toThrow();
    expect(write).toHaveBeenCalledTimes(1);
  });
});
