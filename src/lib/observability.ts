import { randomUUID } from 'node:crypto';

type OperationalLevel = 'info' | 'warn' | 'error';

export interface OperationalEvent {
  event: string;
  route: string;
  requestId?: string;
  durationMs?: number;
  status?: number | null;
  provider?: 'gemini' | 'openai' | 'groq';
  model?: string;
  feature?: string;
  stage?: string;
  outcome?: 'success' | 'fallback' | 'rejected' | 'failed';
  errorCode?: string;
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

export function logOperationalEvent(level: OperationalLevel, event: OperationalEvent): void {
  const entry = JSON.stringify({
    level,
    timestamp: new Date().toISOString(),
    ...event,
  });
  if (level === 'error') console.error(entry);
  else if (level === 'warn') console.warn(entry);
  else console.log(entry);
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
