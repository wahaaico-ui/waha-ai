const createClient = jest.fn();
const createServiceClient = jest.fn();
const isProjectEmailConfigured = jest.fn();
const sendTransactionalEmail = jest.fn();

jest.mock('@/lib/supabase/server', () => ({ createClient: (...args: unknown[]) => createClient(...args) }));
jest.mock('@/lib/supabase/service', () => ({ createServiceClient: (...args: unknown[]) => createServiceClient(...args) }));
jest.mock('@/lib/email/resend', () => ({
  isProjectEmailConfigured: (...args: unknown[]) => isProjectEmailConfigured(...args),
  sendTransactionalEmail: (...args: unknown[]) => sendTransactionalEmail(...args),
}));

import { POST } from './route';

function request(body: Record<string, unknown>) {
  return new Request('https://waha.systems/api/support/tickets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-request-id': 'support-test-request' },
    body: JSON.stringify(body),
  });
}

function validBody() {
  return {
    name: 'محمد أحمد',
    email: 'Researcher@Example.com',
    category: 'research',
    subject: 'تعذر حفظ المرحلة',
    message: 'ظهرت رسالة خطأ بعد مراجعة المشكلة والضغط على زر الاعتماد.',
    pageUrl: 'https://waha.systems/research/problem?projectId=private-id',
    website: '',
  };
}

function serviceInsert(result: { data: unknown; error: unknown }) {
  const query: Record<string, jest.Mock> = {};
  query.insert = jest.fn().mockReturnValue(query);
  query.select = jest.fn().mockReturnValue(query);
  query.single = jest.fn().mockResolvedValue(result);
  const service = { from: jest.fn().mockReturnValue(query) };
  createServiceClient.mockReturnValue(service);
  return { service, query };
}

function operationalEvents() {
  return [console.log, console.warn, console.error].flatMap(write =>
    jest.mocked(write).mock.calls.map(([value]) => JSON.parse(String(value)) as Record<string, unknown>),
  );
}

describe('support ticket route', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    jest.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Unexpected network request in isolated route test'));
    createClient.mockResolvedValue({ auth: { getUser: jest.fn().mockResolvedValue({ data: { user: null } }) } });
    isProjectEmailConfigured.mockReturnValue(true);
    sendTransactionalEmail.mockResolvedValue({ id: 'email-1' });
  });

  afterEach(() => {
    try { expect(globalThis.fetch).not.toHaveBeenCalled(); }
    finally { jest.restoreAllMocks(); }
  });

  test('validates input before accessing Supabase', async () => {
    const response = await POST(request({ ...validBody(), message: 'قصير' }));
    expect(response.status).toBe(422);
    expect(createServiceClient).not.toHaveBeenCalled();
  });

  test('silently accepts honeypot submissions without storing or emailing', async () => {
    const response = await POST(request({ ...validBody(), website: 'bot.example' }));
    expect(response.status).toBe(202);
    expect(createServiceClient).not.toHaveBeenCalled();
    expect(sendTransactionalEmail).not.toHaveBeenCalled();
  });

  test('stores a minimal ticket, returns tracking data, and notifies support', async () => {
    const { service, query } = serviceInsert({
      data: { ticket_number: 'WH-20260920-ABC12345', status: 'received', assigned_queue: 'support', review_due_at: '2026-09-23T12:00:00.000Z' },
      error: null,
    });

    const response = await POST(request(validBody()));
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.ticket).toEqual({ number: 'WH-20260920-ABC12345', status: 'received', queue: 'support', reviewDueAt: '2026-09-23T12:00:00.000Z' });
    expect(service.from).toHaveBeenCalledWith('support_requests');
    expect(query.insert).toHaveBeenCalledWith(expect.objectContaining({
      user_id: null,
      requester_email: 'researcher@example.com',
      assigned_queue: 'support',
      page_path: '/research/problem',
    }));
    expect(sendTransactionalEmail).toHaveBeenCalledWith(expect.objectContaining({
      to: 'support@waha.systems',
      replyTo: 'researcher@example.com',
      subject: expect.stringContaining('WH-20260920-ABC12345'),
    }));
    expect(query.insert).toHaveBeenCalledTimes(1);
    expect(sendTransactionalEmail).toHaveBeenCalledTimes(1);
    expect(operationalEvents()).toContainEqual(expect.objectContaining({
      level: 'info', event: 'api.support.notification.accepted', stage: 'email_notification',
      route: '/api/support/tickets', requestId: 'support-test-request', outcome: 'success',
    }));
    // The provider accepted the request; neither the response nor the event
    // claims delivery to the recipient's mail server or inbox.
    expect(body).toEqual({ success: true, ticket: expect.any(Object) });
    expect(JSON.stringify(operationalEvents())).not.toMatch(/deliver|email-1/);
  });

  test('keeps a stored ticket successful when email notification is unavailable', async () => {
    const { query } = serviceInsert({
      data: { ticket_number: 'WH-20260920-DEF67890', status: 'received', assigned_queue: 'partnerships', review_due_at: '2026-09-23T12:00:00.000Z' },
      error: null,
    });
    sendTransactionalEmail.mockRejectedValue(new Error('provider outage'));

    const response = await POST(request({ ...validBody(), category: 'partnership' }));

    expect(response.status).toBe(201);
    expect((await response.json()).ticket.number).toBe('WH-20260920-DEF67890');
    expect(query.insert).toHaveBeenCalledTimes(1);
    expect(query.single).toHaveBeenCalledTimes(1);
    expect(sendTransactionalEmail).toHaveBeenCalledTimes(1);
    expect(operationalEvents()).toContainEqual(expect.objectContaining({
      level: 'warn', event: 'api.support.notification.failed', outcome: 'failed',
      errorCode: 'email_provider_failed', requestId: 'support-test-request',
    }));
    expect(operationalEvents().filter(event => event.event === 'api.support.notification.accepted')).toHaveLength(0);
  });

  test.each([
    ['https://waha.systems/contact?code=secret&text=private#fragment', '/contact'],
    ['https://www.waha.systems/contact?token=secret', '/contact'],
    ['https://outside.example/private?code=secret', null],
    ['ftp://waha.systems/private?code=secret', null],
  ])('omits sensitive URL parts from stored tickets and email: %s', async (pageUrl, expected) => {
    const { query } = serviceInsert({ data: { ticket_number: 'WH-20261023-ABC12345', status: 'received', assigned_queue: 'support' }, error: null });
    const response = await POST(request({ ...validBody(), pageUrl }));
    expect(response.status).toBe(201);
    expect(query.insert.mock.calls[0][0].page_path).toBe(expected);
    expect(JSON.stringify(sendTransactionalEmail.mock.calls)).not.toMatch(/secret|fragment|outside\.example|ftp:/);
  });

  test('escapes user markup in the support notification', async () => {
    serviceInsert({ data: { ticket_number: 'WH-20261023-ABC12345', status: 'received', assigned_queue: 'support' }, error: null });
    await POST(request({ ...validBody(), name: '<img src=x onerror=evil()>', message: 'Please help <script>evil()</script> with my project.' }));
    const sent = sendTransactionalEmail.mock.calls[0][0];
    expect(sent.html).not.toContain('<script>');
    expect(sent.html).not.toContain('<img src=x');
    expect(sent.html).toContain('&lt;script&gt;');
  });

  test('does not claim receipt or notify email when saving fails', async () => {
    serviceInsert({ data: null, error: { code: 'database_unavailable' } });
    const response = await POST(request(validBody()));
    expect(response.status).toBe(500);
    expect((await response.json()).ticket).toBeUndefined();
    expect(sendTransactionalEmail).not.toHaveBeenCalled();
    expect(operationalEvents().filter(event => String(event.event).startsWith('api.support.notification.'))).toHaveLength(0);
  });

  test('returns a recorded reference without claiming email delivery when email is not configured', async () => {
    isProjectEmailConfigured.mockReturnValue(false);
    const { query } = serviceInsert({ data: { ticket_number: 'WH-20261023-ABC12345', status: 'received', assigned_queue: 'support' }, error: null });
    const response = await POST(request(validBody()));
    expect(response.status).toBe(201);
    expect((await response.json()).ticket.number).toBe('WH-20261023-ABC12345');
    expect(sendTransactionalEmail).not.toHaveBeenCalled();
    expect(query.insert).toHaveBeenCalledTimes(1);
    expect(operationalEvents()).toContainEqual(expect.objectContaining({
      level: 'warn', event: 'api.support.notification.unconfigured', outcome: 'rejected',
      errorCode: 'email_not_configured', requestId: 'support-test-request',
    }));
  });

  test.each(['accepted', 'failed', 'unconfigured'])('keeps %s notification logs free of personal data, content and provider details', async (mode) => {
    const { query } = serviceInsert({ data: { ticket_number: 'WH-20261025-PRIVATE12', status: 'received', assigned_queue: 'support' }, error: null });
    createClient.mockResolvedValue({ auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'private-user-id' } } }) } });
    if (mode === 'unconfigured') isProjectEmailConfigured.mockReturnValue(false);
    else if (mode === 'failed') sendTransactionalEmail.mockRejectedValue(new Error('PRIVATE_PROVIDER_RESPONSE Bearer credential-secret sensitive-reader@example.invalid'));
    else sendTransactionalEmail.mockResolvedValue({ id: 'private-provider-message-id' });

    const response = await POST(request({
      ...validBody(), name: 'PRIVATE_REQUESTER', email: 'sensitive-reader@example.invalid',
      subject: 'PRIVATE_SUBJECT', message: 'PRIVATE_MANUSCRIPT_TEXT_NEVER_LOG',
      pageUrl: 'https://waha.systems/contact?token=secret-token',
    }));
    expect(response.status).toBe(201);
    expect(query.insert).toHaveBeenCalledTimes(1);
    const events = operationalEvents();
    expect(events.filter(event => String(event.event).startsWith('api.support.notification.'))).toHaveLength(1);
    expect(JSON.stringify(events)).not.toMatch(/PRIVATE|sensitive-reader|credential-secret|private-user-id|private-provider-message-id|support@|secret-token|deliver/i);
    const allowedKeys = new Set(['level', 'timestamp', 'event', 'route', 'requestId', 'stage', 'outcome', 'errorCode', 'durationMs', 'status']);
    for (const event of events) {
      expect(Object.keys(event).every(key => allowedKeys.has(key))).toBe(true);
    }
  });
});
