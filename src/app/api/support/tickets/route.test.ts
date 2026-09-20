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
    headers: { 'Content-Type': 'application/json' },
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

describe('support ticket route', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    createClient.mockResolvedValue({ auth: { getUser: jest.fn().mockResolvedValue({ data: { user: null } }) } });
    isProjectEmailConfigured.mockReturnValue(true);
    sendTransactionalEmail.mockResolvedValue({ id: 'email-1' });
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
      page_path: '/research/problem?projectId=private-id',
    }));
    expect(sendTransactionalEmail).toHaveBeenCalledWith(expect.objectContaining({
      to: 'support@waha.systems',
      replyTo: 'researcher@example.com',
      subject: expect.stringContaining('WH-20260920-ABC12345'),
    }));
  });

  test('keeps a stored ticket successful when email notification is unavailable', async () => {
    serviceInsert({
      data: { ticket_number: 'WH-20260920-DEF67890', status: 'received', assigned_queue: 'partnerships', review_due_at: '2026-09-23T12:00:00.000Z' },
      error: null,
    });
    sendTransactionalEmail.mockRejectedValue(new Error('provider outage'));

    const response = await POST(request({ ...validBody(), category: 'partnership' }));

    expect(response.status).toBe(201);
  });
});
