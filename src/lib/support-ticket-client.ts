export class SupportTicketError extends Error {
  constructor(public readonly reason: 'unconfirmed' | 'rate-limited' | 'rejected') {
    super(reason);
    this.name = 'SupportTicketError';
  }
}

/** A lost response may follow a durable insert. Never retry a POST automatically
 * or tell the reporter it was not received when receipt is uncertain. */
export async function submitSupportTicket(values: Record<string, FormDataEntryValue>, pageUrl: string, signal?: AbortSignal): Promise<string> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal?.aborted) abort();
  signal?.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(abort, 25_000);
  try {
    const url = new URL(pageUrl);
    const response = await fetch('/api/support/tickets', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...values, pageUrl: `${url.origin}${url.pathname}` }),
      signal: controller.signal,
    });
    if (response.status === 429) throw new SupportTicketError('rate-limited');
    if (response.status >= 400 && response.status < 500) throw new SupportTicketError('rejected');
    const body: unknown = await response.json().catch(() => null);
    const ticket = body && typeof body === 'object' ? (body as { ticket?: { number?: unknown } }).ticket : undefined;
    if (!response.ok || !ticket || typeof ticket.number !== 'string' || !/^WH-\d{8}-[A-F0-9]{8}$/.test(ticket.number)) {
      throw new SupportTicketError('unconfirmed');
    }
    return ticket.number;
  } catch (error) {
    if (error instanceof SupportTicketError) throw error;
    throw new SupportTicketError('unconfirmed');
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
  }
}
