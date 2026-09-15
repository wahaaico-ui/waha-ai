import { generateStructured } from '@/lib/ai/geminiClient';
import { logOperationalEvent } from '@/lib/observability';

export interface IdeaQueryPlan {
  isValid: boolean;
  queries: string[];
  mode: 'ai' | 'raw';
}

type QueryPlanPayload = {
  valid?: unknown;
  full?: unknown;
  focused?: unknown;
  broad?: unknown;
};

function cleanJsonOutput(output: string): string {
  return output
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
}

export function parseIdeaQueryPlan(output: string): Omit<IdeaQueryPlan, 'mode'> {
  const parsed = JSON.parse(cleanJsonOutput(output)) as QueryPlanPayload;
  if (parsed.valid === false) return { isValid: false, queries: [] };
  if (parsed.valid !== true) throw new Error('QUERY_PLAN_VALIDITY_MISSING');

  const queries = [parsed.full, parsed.focused, parsed.broad]
    .filter((query): query is string => typeof query === 'string')
    .map((query) => query.replace(/\s+/g, ' ').trim())
    .filter((query) => query.length >= 2)
    .filter((query, index, all) => all.findIndex((candidate) => candidate.toLocaleLowerCase('en') === query.toLocaleLowerCase('en')) === index);

  if (queries.length === 0) throw new Error('QUERY_PLAN_EMPTY');
  return { isValid: true, queries };
}

export async function planIdeaSearchQueries(userTopic: string, requestId: string): Promise<IdeaQueryPlan> {
  const startedAt = Date.now();
  const prompt = `You are an academic search strategist. Analyze this research topic and produce a JSON plan.

TOPIC: ${userTopic}

Rules:
1. Decide whether this is a genuine research topic with a meaningful subject.
2. Reject only gibberish, repeated random letters, promotional text, or empty input.
3. A single meaningful academic concept is valid.
4. For valid input, produce three ENGLISH academic search queries:
   - full: a precise translation with 7-12 words
   - focused: the core variables with 3-5 words
   - broad: the main concept with 1-3 words

Return only JSON:
{"valid":true,"full":"...","focused":"...","broad":"..."}
or {"valid":false}`;

  try {
    const generation = await generateStructured({
      prompt,
      feature: 'idea-query-planning',
      requestId,
    });
    const parsed = parseIdeaQueryPlan(generation.output);
    logOperationalEvent('info', {
      event: 'api.verify_idea.query_plan_completed',
      route: '/api/verify-idea',
      requestId,
      durationMs: Date.now() - startedAt,
      feature: 'query-planning',
      outcome: 'success',
    });
    return { ...parsed, mode: 'ai' };
  } catch {
    logOperationalEvent('warn', {
      event: 'api.verify_idea.query_plan_fallback',
      route: '/api/verify-idea',
      requestId,
      durationMs: Date.now() - startedAt,
      feature: 'query-planning',
      outcome: 'fallback',
      errorCode: 'all_planners_unavailable_or_invalid',
    });
    return { isValid: true, queries: [userTopic], mode: 'raw' };
  }
}
