import { isProjectEmailConfigured, sendProjectSnapshotEmail, sendTransactionalEmail } from '@/lib/email/resend';

const originalApiKey = process.env.RESEND_API_KEY;
const originalFrom = process.env.WAHA_EMAIL_FROM;

const email = {
  to: 'owner@example.com',
  subject: 'آخر نسخة',
  html: '<p>نسخة آمنة</p>',
  text: 'نسخة آمنة',
  idempotencyKey: 'project:document:2',
};

describe('Resend project email transport', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    if (originalApiKey === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = originalApiKey;
    if (originalFrom === undefined) delete process.env.WAHA_EMAIL_FROM;
    else process.env.WAHA_EMAIL_FROM = originalFrom;
  });

  test('stays disabled until both server variables are configured', () => {
    delete process.env.RESEND_API_KEY;
    process.env.WAHA_EMAIL_FROM = 'WAHA <research@example.com>';
    expect(isProjectEmailConfigured()).toBe(false);
  });

  test('sends the API key only as a server authorization header', async () => {
    process.env.RESEND_API_KEY = 'server-secret-key';
    process.env.WAHA_EMAIL_FROM = 'WAHA <research@example.com>';
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ id: 'email-1' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await expect(sendProjectSnapshotEmail(email)).resolves.toEqual({ id: 'email-1' });
    const [, init] = fetchMock.mock.calls[0];
    const headers = init?.headers as Record<string, string>;
    const body = String(init?.body);

    expect(headers.Authorization).toBe('Bearer server-secret-key');
    expect(headers['Idempotency-Key']).toBe(email.idempotencyKey);
    expect(body).toContain('owner@example.com');
    expect(body).not.toContain('server-secret-key');
  });

  test('rejects invalid provider responses', async () => {
    process.env.RESEND_API_KEY = 'server-secret-key';
    process.env.WAHA_EMAIL_FROM = 'WAHA <research@example.com>';
    jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ unexpected: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await expect(sendProjectSnapshotEmail(email)).rejects.toThrow('EMAIL_PROVIDER_INVALID_RESPONSE');
  });

  test('adds reply-to for support notifications', async () => {
    process.env.RESEND_API_KEY = 'server-secret-key';
    process.env.WAHA_EMAIL_FROM = 'WAHA <research@example.com>';
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ id: 'email-2' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await sendTransactionalEmail({ ...email, replyTo: 'owner@example.com' });

    expect(String(fetchMock.mock.calls[0][1]?.body)).toContain('"reply_to":"owner@example.com"');
  });
});
