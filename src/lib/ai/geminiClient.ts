import { createClient as createServerClient } from '@/lib/supabase/server';
import { ownsProject } from '@/lib/supabase/authorization';
import { logOperationalEvent } from '@/lib/observability';
import { createHash } from 'node:crypto';

const AI_TIMEOUT_MS = 30_000;
const GEMINI_MODEL = 'gemini-flash-latest';
const OPENAI_MODEL = 'gpt-4.1-mini';
const GROQ_MODELS = ['qwen/qwen3.6-27b', 'openai/gpt-oss-120b', 'openai/gpt-oss-20b'] as const;

class AIProviderError extends Error {
  constructor(public readonly provider: 'gemini' | 'openai' | 'groq', public readonly status: number | null) {
    super(`${provider} request failed${status ? ` (${status})` : ''}`);
    this.name = 'AIProviderError';
  }
}

async function generateWithOpenAI(apiKey: string, prompt: string) {
  let response: Response;
  try {
    response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages: [
          { role: 'system', content: 'أنت مساعد بحث علمي أكاديمي دقيق. أعد JSON صالحاً فقط.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.2,
        response_format: { type: 'json_object' },
      }),
      signal: AbortSignal.timeout(AI_TIMEOUT_MS),
    });
  } catch {
    throw new AIProviderError('openai', null);
  }
  if (!response.ok) throw new AIProviderError('openai', response.status);
  const data = await response.json();
  const output = data.choices?.[0]?.message?.content;
  if (typeof output !== 'string' || !output.trim()) throw new AIProviderError('openai', response.status);
  return { output, model: OPENAI_MODEL };
}

async function generateWithGemini(apiKey: string, prompt: string) {
  let response: Response;
  try {
    response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      signal: AbortSignal.timeout(AI_TIMEOUT_MS),
    });
  } catch {
    throw new AIProviderError('gemini', null);
  }
  if (!response.ok) throw new AIProviderError('gemini', response.status);
  const data = await response.json();
  const output = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof output !== 'string' || !output.trim()) throw new AIProviderError('gemini', response.status);
  return { output, model: GEMINI_MODEL };
}

async function generateWithGroq(apiKey: string, prompt: string) {
  let lastStatus: number | null = null;
  for (const model of GROQ_MODELS) {
    let response: Response;
    try {
      response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: 'أنت مساعد بحث علمي أكاديمي دقيق. أعد JSON صالحاً فقط.' },
            { role: 'user', content: prompt },
          ],
          temperature: 0.2,
          response_format: { type: 'json_object' },
        }),
        signal: AbortSignal.timeout(AI_TIMEOUT_MS),
      });
    } catch {
      throw new AIProviderError('groq', null);
    }
    lastStatus = response.status;
    if (!response.ok) {
      if (response.status === 404 || response.status === 403) continue;
      throw new AIProviderError('groq', response.status);
    }
    const data = await response.json();
    const output = data.choices?.[0]?.message?.content;
    if (typeof output === 'string' && output.trim()) return { output, model };
  }
  throw new AIProviderError('groq', lastStatus);
}

interface GenerateOptions {
  prompt: string;
  projectId?: string;
  userId?: string;
  supabase?: Awaited<ReturnType<typeof createServerClient>>;
  feature: string;
  requestId?: string;
}

interface GenerateResult {
  output: string;
  confidenceLabel: string;
}

export async function generateStructured({
  prompt,
  projectId,
  userId,
  supabase: callerSupabase,
  feature,
  requestId,
}: GenerateOptions): Promise<GenerateResult> {
  const startedAt = Date.now();
  const geminiKey = process.env.GEMINI_API_KEY;
  const openAIKey = process.env.OPENAI_API_KEY;
  const groqKey = process.env.GROQ_API_KEY;
  if (!geminiKey && !openAIKey && !groqKey) {
    logOperationalEvent('error', {
      event: 'ai.generation_failed', route: '/server/structured-generation', requestId, feature,
      durationMs: Date.now() - startedAt, outcome: 'failed', errorCode: 'no_provider_configured',
    });
    throw new Error('No structured-generation provider is configured.');
  }

  if (projectId) {
    if (!userId || !callerSupabase) {
      throw new Error('generateStructured: projectId requires userId and supabase to verify project ownership.');
    }
    if (!(await ownsProject(projectId, userId, callerSupabase))) {
      throw new Error('generateStructured: caller does not own the referenced project.');
    }
  }

  let generation: { output: string; model: string; provider: 'gemini' | 'openai' | 'groq' } | null = null;
  if (geminiKey) {
    const providerStartedAt = Date.now();
    try {
      generation = { ...(await generateWithGemini(geminiKey, prompt)), provider: 'gemini' };
    } catch (reason) {
      const failure = reason instanceof AIProviderError ? reason : null;
      logOperationalEvent('warn', {
        event: 'ai.provider_failed', route: '/server/structured-generation', requestId, feature, provider: 'gemini',
        status: failure?.status ?? null, durationMs: Date.now() - providerStartedAt, outcome: 'fallback',
        errorCode: failure?.status ? 'provider_http_error' : 'provider_transport_error',
      });
    }
  }
  if (!generation && openAIKey) {
    const providerStartedAt = Date.now();
    try {
      generation = { ...(await generateWithOpenAI(openAIKey, prompt)), provider: 'openai' };
    } catch (reason) {
      const failure = reason instanceof AIProviderError ? reason : null;
      logOperationalEvent('warn', {
        event: 'ai.provider_failed', route: '/server/structured-generation', requestId, feature, provider: 'openai',
        status: failure?.status ?? null, durationMs: Date.now() - providerStartedAt, outcome: 'fallback',
        errorCode: failure?.status ? 'provider_http_error' : 'provider_transport_error',
      });
    }
  }
  if (!generation && groqKey) {
    const providerStartedAt = Date.now();
    try {
      generation = { ...(await generateWithGroq(groqKey, prompt)), provider: 'groq' };
    } catch (reason) {
      const failure = reason instanceof AIProviderError ? reason : null;
      logOperationalEvent('warn', {
        event: 'ai.provider_failed', route: '/server/structured-generation', requestId, feature, provider: 'groq',
        status: failure?.status ?? null, durationMs: Date.now() - providerStartedAt, outcome: 'failed',
        errorCode: failure?.status ? 'provider_http_error' : 'provider_transport_error',
      });
    }
  }
  if (!generation) {
    logOperationalEvent('error', {
      event: 'ai.generation_failed', route: '/server/structured-generation', requestId, feature,
      durationMs: Date.now() - startedAt, outcome: 'failed', errorCode: 'all_providers_unavailable',
    });
    throw new Error('Structured generation is temporarily unavailable.');
  }
  const { output, model: modelName, provider } = generation;

  // منطق بسيط لتحديد مستوى الثقة (confidenceLabel)
  let confidenceLabel = 'منخفض';
  const lowerPrompt = prompt.toLowerCase();
  if (
    lowerPrompt.includes('source') ||
    lowerPrompt.includes('citation') ||
    lowerPrompt.includes('مرجع') ||
    lowerPrompt.includes('سياق') ||
    lowerPrompt.includes('context')
  ) {
    confidenceLabel = 'عالي';
  } else if (prompt.length > 150) {
    confidenceLabel = 'متوسط';
  }

  // سجّل العملية من خلال عميل المستخدم نفسه؛ لا حاجة لتجاوز RLS بمفتاح خدمة.
  if (projectId && callerSupabase) {
    const { error } = await callerSupabase.from('ai_generations_log').insert({
      project_id: projectId,
      feature,
      model: modelName,
      output,
      confidence_label: confidenceLabel,
      prompt_hash: createHash('sha256').update(prompt).digest('hex'),
    });
    if (error) {
      logOperationalEvent('error', {
        event: 'ai.audit_write_failed', route: '/server/structured-generation', requestId, feature, provider,
        model: modelName, durationMs: Date.now() - startedAt, outcome: 'failed', errorCode: 'database_write_failed',
      });
    }
  }

  logOperationalEvent('info', {
    event: 'ai.generation_completed', route: '/server/structured-generation', requestId, feature, provider,
    model: modelName, durationMs: Date.now() - startedAt, outcome: 'success',
  });

  return {
    output,
    confidenceLabel,
  };
}
