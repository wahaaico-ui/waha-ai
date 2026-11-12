import { randomUUID } from 'node:crypto';

type OperationalLevel = 'info' | 'warn' | 'error';

export interface OperationalEvent {
  event: string;
  route: string;
  requestId?: string;
  durationMs?: number;
  status?: number | null;
  provider?: 'gemini' | 'openai' | 'groq' | 'semantic_scholar' | 'openalex';
  model?: string;
  requestedModel?: string;
  reportedModel?: string | null;
  modelVersionStatus?: 'reported' | 'not_reported';
  feature?: string;
  stage?: string;
  outcome?: 'success' | 'fallback' | 'rejected' | 'failed';
  errorCode?: string;
  /** Non-sensitive identifiers for investigation (never user content, queries or credentials). */
  diagnostics?: Record<string, string | number | string[]>;
}

export interface OperationalRequestContext {
  route: string;
  requestId: string;
  startedAt: number;
}

export function requestCorrelationId(request: Request): string {
  const supplied = request.headers.get('x-vercel-id') || request.headers.get('x-request-id');
  const normalized = supplied?.trim();
  if (normalized && normalized.length <= 128 && /^[A-Za-z0-9._:-]+$/.test(normalized)) return normalized;
  return randomUUID();
}

const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const MODEL = /^[A-Za-z0-9][A-Za-z0-9._:/@+-]{0,127}$/;
const ROUTE = /^(?:\/[A-Za-z0-9._/[\]-]{0,191}|[A-Za-z0-9][A-Za-z0-9._-]{0,127})$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PROVIDERS = ['gemini', 'openai', 'groq', 'semantic_scholar', 'openalex'] as const;
const ACADEMIC_PROVIDERS = ['openalex', 'semantic-scholar', 'crossref', 'core', 'arxiv', 'europe-pmc', 'openaire', 'plos', 'doab', 'doaj', 'datacite', 'pubmed'] as const;
const IDENTIFIER_SCHEMES = ['doi', 'arxiv', 'pmid', 'pmcid', 'openalex', 'semantic_scholar', 'core'] as const;
const OUTCOMES = ['success', 'fallback', 'rejected', 'failed'] as const;
const MAX_DIAGNOSTIC_ITEMS = 50;

/** Read only own data properties: getters, prototypes and toJSON are not log input. */
function ownData(value: unknown, key: string): unknown {
  if (typeof value !== 'object' || value === null) return undefined;
  try {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return descriptor && 'value' in descriptor ? descriptor.value : undefined;
  } catch { return undefined; }
}

function token(value: unknown, pattern = IDENTIFIER): string | undefined {
  // Comparing the full match also rejects the final newline accepted by `$`.
  return typeof value === 'string' && value.length <= 192 && pattern.exec(value)?.[0] === value ? value : undefined;
}

function enumeration<T extends string>(value: unknown, values: readonly T[]): T | undefined {
  return typeof value === 'string' && values.includes(value as T) ? value as T : undefined;
}

function integer(value: unknown, minimum: number, maximum: number): number | undefined {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= minimum && value <= maximum ? value : undefined;
}

function diagnosticList(value: unknown, accept: (item: unknown) => string | undefined): string[] | undefined {
  try {
    if (!Array.isArray(value)) return undefined;
    const length = integer(ownData(value, 'length'), 0, 4_294_967_295);
    if (length === undefined) return undefined;
    const items: string[] = [];
    for (let index = 0; index < Math.min(length, MAX_DIAGNOSTIC_ITEMS); index++) {
      const item = accept(ownData(value, String(index)));
      if (item !== undefined) items.push(item);
    }
    return items;
  } catch { return undefined; }
}

function safeDiagnostics(value: unknown): Record<string, string | number | string[]> | undefined {
  const result: Record<string, string | number | string[]> = {};
  for (const key of ['position', 'rows']) {
    const count = integer(ownData(value, key), 0, Number.MAX_SAFE_INTEGER);
    if (count !== undefined) result[key] = count;
  }
  const provider = enumeration(ownData(value, 'provider'), ACADEMIC_PROVIDERS);
  if (provider !== undefined) result.provider = provider;
  const schemes = diagnosticList(ownData(value, 'identifierSchemes'), item => enumeration(item, IDENTIFIER_SCHEMES));
  if (schemes !== undefined) result.identifierSchemes = schemes;
  const candidates = diagnosticList(ownData(value, 'candidateWorkIds'), item => token(item, UUID));
  if (candidates !== undefined) result.candidateWorkIds = candidates;
  return Object.keys(result).length ? result : undefined;
}

export function logOperationalEvent(level: OperationalLevel, event: OperationalEvent): void {
  // Operational logging is best effort. An invalid event or unavailable log sink
  // must never turn an otherwise valid research request into an application error.
  try {
    const safeLevel = enumeration(level, ['info', 'warn', 'error'] as const) ?? 'warn';
    const entry: Record<string, unknown> = {
      level: safeLevel,
      timestamp: new Date().toISOString(),
      event: token(ownData(event, 'event')) ?? 'operational.invalid_event',
      route: token(ownData(event, 'route'), ROUTE) ?? 'unknown',
    };
    for (const key of ['requestId', 'feature', 'stage', 'errorCode']) {
      const value = token(ownData(event, key));
      if (value !== undefined) entry[key] = value;
    }
    for (const key of ['model', 'requestedModel']) {
      const value = token(ownData(event, key), MODEL);
      if (value !== undefined) entry[key] = value;
    }
    const reportedInput = ownData(event, 'reportedModel');
    const reportedModel = token(reportedInput, MODEL);
    if (reportedInput !== undefined) entry.reportedModel = reportedModel ?? null;
    const versionStatus = enumeration(ownData(event, 'modelVersionStatus'), ['reported', 'not_reported'] as const);
    if (versionStatus !== undefined) entry.modelVersionStatus = reportedModel ? 'reported' : 'not_reported';
    const provider = enumeration(ownData(event, 'provider'), PROVIDERS);
    if (provider !== undefined) entry.provider = provider;
    const outcome = enumeration(ownData(event, 'outcome'), OUTCOMES);
    if (outcome !== undefined) entry.outcome = outcome;
    const duration = ownData(event, 'durationMs');
    if (typeof duration === 'number' && Number.isFinite(duration) && duration >= 0 && duration <= 86_400_000) entry.durationMs = duration;
    const status = ownData(event, 'status');
    if (status === null || integer(status, 100, 599) !== undefined) entry.status = status;
    const diagnostics = safeDiagnostics(ownData(event, 'diagnostics'));
    if (diagnostics !== undefined) entry.diagnostics = diagnostics;
    const serialized = JSON.stringify(entry);
    if (safeLevel === 'error') console.error(serialized);
    else if (safeLevel === 'warn') console.warn(serialized);
    else console.log(serialized);
  } catch { /* Do not recurse or expose the rejected event through a fallback log. */ }
}

export function startOperationalRequest(
  request: Request,
  route: string,
  event: string,
): OperationalRequestContext {
  const context = { route, requestId: requestCorrelationId(request), startedAt: Date.now() };
  logOperationalEvent('info', { event, route, requestId: context.requestId });
  return context;
}

export function completeOperationalRequest(
  context: OperationalRequestContext,
  event: string,
  status: number,
  outcome: NonNullable<OperationalEvent['outcome']>,
  errorCode?: string,
): void {
  logOperationalEvent(status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info', {
    event,
    route: context.route,
    requestId: context.requestId,
    durationMs: Date.now() - context.startedAt,
    status,
    outcome,
    ...(errorCode ? { errorCode } : {}),
  });
}

export function operationalHeaders(context: OperationalRequestContext): HeadersInit {
  return { 'x-waha-request-id': context.requestId };
}
