export class ExternalApiError extends Error {
  constructor(public readonly status: number, message: string) { super(message); }
}

const delay = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

function retryDelay(response: Response, attempt: number) {
  const retryAfter = Number(response.headers.get('retry-after'));
  if (Number.isFinite(retryAfter) && retryAfter >= 0) return retryAfter * 1_000;
  return 300 * (2 ** attempt);
}

export async function resilientFetch(
  input: string | URL,
  init: RequestInit = {},
  options: { timeoutMs?: number; retries?: number } = {},
) {
  const timeoutMs = options.timeoutMs ?? 12_000;
  const retries = options.retries ?? 1;
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(input, { ...init, signal: AbortSignal.timeout(timeoutMs) });
      if (response.ok) return response;
      if ((response.status === 429 || response.status >= 500) && attempt < retries) {
        const wait = retryDelay(response, attempt);
        if (wait > 2_000) throw new ExternalApiError(response.status, `External API requested retry after ${Math.ceil(wait / 1_000)} seconds`);
        await delay(wait);
        continue;
      }
      throw new ExternalApiError(response.status, `External API returned ${response.status}`);
    } catch (error) {
      lastError = error;
      if (attempt >= retries || error instanceof ExternalApiError) throw error;
      await delay(300 * (2 ** attempt));
    }
  }
  throw lastError instanceof Error ? lastError : new Error('External API request failed');
}

export async function fetchJson<T>(input: string | URL, init?: RequestInit, options?: { timeoutMs?: number; retries?: number }) {
  const response = await resilientFetch(input, { ...init, headers: { Accept: 'application/json', ...init?.headers } }, options);
  const type = response.headers.get('content-type') || '';
  if (!type.includes('json')) throw new Error('External API returned a non-JSON response');
  return await response.json() as T;
}

export async function fetchText(input: string | URL, init?: RequestInit, options?: { timeoutMs?: number; retries?: number }) {
  return await (await resilientFetch(input, init, options)).text();
}

export const APPLICATION_EMAIL = process.env.ACADEMIC_API_EMAIL || 'waha.ai.co@gmail.com';
export const APPLICATION_USER_AGENT = `WAHA-AI/1.0 (mailto:${APPLICATION_EMAIL})`;
