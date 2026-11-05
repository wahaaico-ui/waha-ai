const serviceInsert = jest.fn();
jest.mock('@/lib/supabase/service', () => ({ createServiceClient: () => ({ from: () => ({ insert: (...args: unknown[]) => serviceInsert(...args) }) }) }));
jest.mock('@/lib/supabase/authorization', () => ({ ownsProject: jest.fn().mockResolvedValue(true) }));

import { AI_OUTPUT_NOT_ASSESSED, generateStructured } from '@/lib/ai/geminiClient';
import { ownsProject } from '@/lib/supabase/authorization';

const originalGeminiKey = process.env.GEMINI_API_KEY;
const originalOpenAIKey = process.env.OPENAI_API_KEY;
const originalGroqKey = process.env.GROQ_API_KEY;
const originalFetch = global.fetch;

beforeEach(() => {
  delete process.env.GEMINI_API_KEY;
  delete process.env.OPENAI_API_KEY;
  delete process.env.GROQ_API_KEY;
  serviceInsert.mockReset().mockResolvedValue({ error: null });
  jest.mocked(ownsProject).mockResolvedValue(true);
  // Every provider exchange in this suite is synthetic; unexpected calls fail
  // here instead of using inherited credentials or reaching a real service.
  global.fetch = jest.fn().mockRejectedValue(new Error('Unexpected synthetic provider request'));
});

afterEach(() => {
  global.fetch = originalFetch;
  if (originalGeminiKey === undefined) delete process.env.GEMINI_API_KEY;
  else process.env.GEMINI_API_KEY = originalGeminiKey;
  if (originalOpenAIKey === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = originalOpenAIKey;
  if (originalGroqKey === undefined) delete process.env.GROQ_API_KEY;
  else process.env.GROQ_API_KEY = originalGroqKey;
  jest.restoreAllMocks();
});

test('falls back to Groq when Gemini rejects the configured key', async () => {
  process.env.GEMINI_API_KEY = 'invalid-gemini-key';
  process.env.GROQ_API_KEY = 'valid-groq-key';
  const warning = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  jest.spyOn(console, 'log').mockImplementation(() => undefined);
  global.fetch = jest.fn()
    .mockResolvedValueOnce(new Response('{}', { status: 403 }))
    .mockResolvedValueOnce(new Response(JSON.stringify({
      choices: [{ message: { content: '{"problemStatement":"مسودة","researchGap":"فجوة"}' } }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));

  const result = await generateStructured({ prompt: 'أعد JSON', feature: 'test', requestId: 'test-request' });

  expect(result.output).toContain('problemStatement');
  expect(global.fetch).toHaveBeenCalledTimes(2);
  expect((global.fetch as jest.Mock).mock.calls[1][0]).toBe('https://api.groq.com/openai/v1/chat/completions');
  expect(JSON.parse((global.fetch as jest.Mock).mock.calls[1][1].body).model).toBe('qwen/qwen3.6-27b');
  const providerFailure = JSON.parse(warning.mock.calls[0][0]);
  expect(providerFailure).toMatchObject({ event: 'ai.provider_failed', requestId: 'test-request', provider: 'gemini', status: 403, outcome: 'fallback' });
  expect(warning.mock.calls[0][0]).not.toContain('invalid-gemini-key');
  expect(warning.mock.calls[0][0]).not.toContain('أعد JSON');
});

test('uses Gemini without calling the fallback when it succeeds', async () => {
  process.env.GEMINI_API_KEY = 'valid-gemini-key';
  process.env.GROQ_API_KEY = 'valid-groq-key';
  jest.spyOn(console, 'log').mockImplementation(() => undefined);
  global.fetch = jest.fn().mockResolvedValueOnce(new Response(JSON.stringify({
    candidates: [{ content: { parts: [{ text: '{"ok":true}' }] } }],
  }), { status: 200, headers: { 'Content-Type': 'application/json' } }));

  const result = await generateStructured({ prompt: 'أعد JSON', feature: 'test' });

  expect(result.output).toBe('{"ok":true}');
  expect(global.fetch).toHaveBeenCalledTimes(1);
});

test('tries OpenAI before Groq when Gemini is unavailable', async () => {
  process.env.GEMINI_API_KEY = 'invalid-gemini-key';
  process.env.OPENAI_API_KEY = 'valid-openai-key';
  process.env.GROQ_API_KEY = 'valid-groq-key';
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  jest.spyOn(console, 'log').mockImplementation(() => undefined);
  global.fetch = jest.fn()
    .mockResolvedValueOnce(new Response('{}', { status: 403 }))
    .mockResolvedValueOnce(new Response(JSON.stringify({
      choices: [{ message: { content: '{"ok":"openai"}' } }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));

  const result = await generateStructured({ prompt: 'أعد JSON', feature: 'test' });

  expect(result.output).toBe('{"ok":"openai"}');
  expect((global.fetch as jest.Mock).mock.calls[1][0]).toBe('https://api.openai.com/v1/chat/completions');
});

test('does not claim a confidence level from prompt keywords and logs through the server client', async () => {
  process.env.GEMINI_API_KEY = 'valid-gemini-key';
  jest.spyOn(console, 'log').mockImplementation(() => undefined);
  serviceInsert.mockResolvedValue({ error: null });
  global.fetch = jest.fn().mockResolvedValueOnce(new Response(JSON.stringify({
    candidates: [{ content: { parts: [{ text: 'Smith, J. (2031). Invented study.' }] } }],
  }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
  const callerInsert = jest.fn();
  const caller = { from: () => ({ insert: callerInsert }) } as unknown as Parameters<typeof generateStructured>[0]['supabase'];

  // Before Slice 0 a prompt mentioning "citation", "source" or "context" was labelled high confidence.
  const result = await generateStructured({ prompt: 'Generate a citation for this source and context', feature: 'test', projectId: 'project-a', userId: 'user-a', supabase: caller });

  expect(result.confidenceLabel).toBe(AI_OUTPUT_NOT_ASSESSED);
  expect(serviceInsert).toHaveBeenCalledWith(expect.objectContaining({ project_id: 'project-a', confidence_label: 'not_assessed' }));
  expect(callerInsert).not.toHaveBeenCalled();
});

test.each([
  ['gemini', 'GEMINI_API_KEY', 'gemini-flash-latest', 'gemini-2.5-flash-001', 'modelVersion'],
  ['openai', 'OPENAI_API_KEY', 'gpt-4.1-mini', 'gpt-4.1-mini-2025-04-14', 'model'],
  ['groq', 'GROQ_API_KEY', 'qwen/qwen3.6-27b', 'qwen/qwen3.6-27b', 'model'],
] as const)('separates requested and provider-reported model identity for %s', async (provider, key, requestedModel, reportedModel, property) => {
  process.env[key] = 'synthetic-secret';
  const log = jest.spyOn(console, 'log').mockImplementation(() => undefined);
  const body = provider === 'gemini'
    ? { candidates: [{ content: { parts: [{ text: '{"ok":true}' }] } }], [property]: reportedModel }
    : { choices: [{ message: { content: '{"ok":true}' } }], [property]: reportedModel };
  global.fetch = jest.fn().mockResolvedValue(new Response(JSON.stringify(body)));

  const result = await generateStructured({ prompt: 'private input', feature: 'test', requestId: 'provenance-test' });

  const provenance = { provider, requestedModel, reportedModel, modelVersionStatus: 'reported' };
  expect(result.provenance).toEqual(provenance);
  expect(result.confidenceLabel).toBe('not_assessed');
  expect(JSON.parse(log.mock.calls[0][0])).toMatchObject({ ...provenance, model: requestedModel, requestId: 'provenance-test' });
  expect(log.mock.calls[0][0]).not.toContain('private input');
  expect(log.mock.calls[0][0]).not.toContain('synthetic-secret');
});

test.each([undefined, null, '', 'x'.repeat(129), 'model with private text', 'model\ninjected', 'model\n', 42, { model: 'secret' }])(
  'does not invent a reported version from invalid or absent provider metadata: %p', async (modelVersion) => {
    process.env.GEMINI_API_KEY = 'synthetic-secret';
    const log = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    global.fetch = jest.fn().mockResolvedValue(new Response(JSON.stringify({
      candidates: [{ content: { parts: [{ text: 'private output' }] } }], modelVersion,
    })));

    const result = await generateStructured({ prompt: 'private input', feature: 'test' });

    expect(result.provenance).toEqual({ provider: 'gemini', requestedModel: 'gemini-flash-latest', reportedModel: null, modelVersionStatus: 'not_reported' });
    expect(JSON.parse(log.mock.calls[0][0])).toMatchObject({ reportedModel: null, modelVersionStatus: 'not_reported' });
    expect(log.mock.calls[0][0]).not.toContain('private output');
    expect(log.mock.calls[0][0]).not.toContain('injected');
  },
);

test('records the successful fallback identity rather than the failed provider alias', async () => {
  process.env.GEMINI_API_KEY = 'synthetic-gemini';
  process.env.GROQ_API_KEY = 'synthetic-groq';
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  const log = jest.spyOn(console, 'log').mockImplementation(() => undefined);
  global.fetch = jest.fn()
    .mockResolvedValueOnce(new Response('{}', { status: 429 }))
    .mockResolvedValueOnce(new Response('{}', { status: 404 }))
    .mockResolvedValueOnce(new Response(JSON.stringify({ choices: [{ message: { content: '{"ok":true}' } }], model: 'openai/gpt-oss-120b' })));

  const result = await generateStructured({ prompt: 'test', feature: 'test' });

  expect(result.provenance).toEqual({ provider: 'groq', requestedModel: 'openai/gpt-oss-120b', reportedModel: 'openai/gpt-oss-120b', modelVersionStatus: 'reported' });
  expect(global.fetch).toHaveBeenCalledTimes(3);
  expect(JSON.parse(log.mock.calls[0][0])).toMatchObject(result.provenance);
});

test('keeps legacy audit semantics while retaining separate response metadata on an audit failure', async () => {
  process.env.GEMINI_API_KEY = 'synthetic-gemini';
  serviceInsert.mockRejectedValue(new Error('private database detail'));
  const error = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  jest.spyOn(console, 'log').mockImplementation(() => undefined);
  global.fetch = jest.fn().mockResolvedValue(new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: '{"ok":true}' }] } }], modelVersion: 'gemini-2.5-flash-001' })));
  const caller = {} as NonNullable<Parameters<typeof generateStructured>[0]['supabase']>;

  const result = await generateStructured({ prompt: 'private input', feature: 'test', projectId: 'project-a', userId: 'user-a', supabase: caller });

  expect(serviceInsert).toHaveBeenCalledWith(expect.objectContaining({ model: 'gemini-flash-latest', confidence_label: 'not_assessed' }));
  expect(result.provenance.reportedModel).toBe('gemini-2.5-flash-001');
  expect(JSON.parse(error.mock.calls[0][0])).toMatchObject({ event: 'ai.audit_write_failed', requestedModel: 'gemini-flash-latest', reportedModel: 'gemini-2.5-flash-001', modelVersionStatus: 'reported' });
  expect(error.mock.calls[0][0]).not.toContain('private database detail');
});

test('never calls a provider or writes audit data for a foreign project', async () => {
  process.env.GEMINI_API_KEY = 'synthetic-key';
  jest.mocked(ownsProject).mockResolvedValue(false);
  const caller = {} as NonNullable<Parameters<typeof generateStructured>[0]['supabase']>;

  await expect(generateStructured({ prompt: 'test', feature: 'test', projectId: 'foreign', userId: 'user-a', supabase: caller })).rejects.toThrow('caller does not own');

  expect(global.fetch).not.toHaveBeenCalled();
  expect(serviceInsert).not.toHaveBeenCalled();
});
