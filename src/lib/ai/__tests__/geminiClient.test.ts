import { generateStructured } from '@/lib/ai/geminiClient';

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
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  global.fetch = jest.fn()
    .mockResolvedValueOnce(new Response('{}', { status: 403 }))
    .mockResolvedValueOnce(new Response(JSON.stringify({
      choices: [{ message: { content: '{"problemStatement":"مسودة","researchGap":"فجوة"}' } }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));

  const result = await generateStructured({ prompt: 'أعد JSON', feature: 'test' });

  expect(result.output).toContain('problemStatement');
  expect(global.fetch).toHaveBeenCalledTimes(2);
  expect((global.fetch as jest.Mock).mock.calls[1][0]).toBe('https://api.groq.com/openai/v1/chat/completions');
});

test('uses Gemini without calling the fallback when it succeeds', async () => {
  process.env.GEMINI_API_KEY = 'valid-gemini-key';
  process.env.GROQ_API_KEY = 'valid-groq-key';
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
  global.fetch = jest.fn()
    .mockResolvedValueOnce(new Response('{}', { status: 403 }))
    .mockResolvedValueOnce(new Response(JSON.stringify({
      choices: [{ message: { content: '{"ok":"openai"}' } }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));

  const result = await generateStructured({ prompt: 'أعد JSON', feature: 'test' });

  expect(result.output).toBe('{"ok":"openai"}');
  expect((global.fetch as jest.Mock).mock.calls[1][0]).toBe('https://api.openai.com/v1/chat/completions');
});
