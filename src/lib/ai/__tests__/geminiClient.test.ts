const serviceInsert = jest.fn();
jest.mock('@/lib/supabase/service', () => ({ createServiceClient: () => ({ from: () => ({ insert: (...args: unknown[]) => serviceInsert(...args) }) }) }));
jest.mock('@/lib/supabase/authorization', () => ({ ownsProject: jest.fn().mockResolvedValue(true) }));

import { AI_OUTPUT_NOT_ASSESSED, generateStructured } from '@/lib/ai/geminiClient';

const originalGeminiKey = process.env.GEMINI_API_KEY;
const originalOpenAIKey = process.env.OPENAI_API_KEY;
const originalGroqKey = process.env.GROQ_API_KEY;
const originalFetch = global.fetch;

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
