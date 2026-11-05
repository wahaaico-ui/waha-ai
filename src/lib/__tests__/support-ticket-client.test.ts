import { submitSupportTicket } from '@/lib/support-ticket-client';

const originalFetch = global.fetch;
const mockFetch = jest.fn();
const values = { name: 'Test Researcher', email: 'researcher@example.com', category: 'research', subject: 'Research support', message: 'A declared test message, not an actual support request.' };
beforeEach(() => { global.fetch = mockFetch; mockFetch.mockReset(); });
afterEach(() => { global.fetch = originalFetch; jest.useRealTimers(); });

test('only accepts a recorded reference and removes URL query data before sending', async () => {
  mockFetch.mockResolvedValue(Response.json({ success: true, ticket: { number: 'WH-20261023-ABC12345' } }, { status: 201 }));
  expect(await submitSupportTicket(values, 'https://waha.systems/contact?code=private#secret')).toBe('WH-20261023-ABC12345');
  const body = JSON.parse(mockFetch.mock.calls[0][1].body);
  expect(body.pageUrl).toBe('https://waha.systems/contact');
  expect(JSON.stringify(body)).not.toMatch(/private|secret/);
  expect(mockFetch).toHaveBeenCalledTimes(1);
});

test.each([
  [201, { success: true }], [200, { ticket: { number: 'OK' } }],
  [201, { ticket: { number: '<script>bad</script>' } }], [500, { ticket: { number: 'WH-20261023-ABC12345' } }],
])('does not turn an invalid or failed response into receipt (%s)', async (status, body) => {
  mockFetch.mockResolvedValue(Response.json(body, { status }));
  await expect(submitSupportTicket(values, 'https://waha.systems/contact')).rejects.toMatchObject({ reason: 'unconfirmed' });
  expect(mockFetch).toHaveBeenCalledTimes(1);
});

test.each([[429, 'rate-limited'], [422, 'rejected']] as const)('classifies %i without automatically retrying a POST', async (status, reason) => {
  mockFetch.mockResolvedValue(Response.json({}, { status }));
  await expect(submitSupportTicket(values, 'https://waha.systems/contact')).rejects.toMatchObject({ reason });
  expect(mockFetch).toHaveBeenCalledTimes(1);
});

test('a lost response is uncertain and never automatically sent twice', async () => {
  mockFetch.mockRejectedValue(new TypeError('Network unavailable'));
  await expect(submitSupportTicket(values, 'https://waha.systems/contact')).rejects.toMatchObject({ reason: 'unconfirmed' });
  expect(mockFetch).toHaveBeenCalledTimes(1);
});

function pendingFetch() {
  mockFetch.mockImplementation((_url, options: RequestInit) => new Promise((_resolve, reject) => {
    const cancel = () => reject(new DOMException('Aborted', 'AbortError'));
    if (options.signal?.aborted) cancel();
    else options.signal?.addEventListener('abort', cancel, { once: true });
  }));
}

test('a stalled request times out without declaring non-receipt or retrying', async () => {
  jest.useFakeTimers(); pendingFetch();
  const pending = submitSupportTicket(values, 'https://waha.systems/contact');
  const expectation = expect(pending).rejects.toMatchObject({ reason: 'unconfirmed' });
  await jest.advanceTimersByTimeAsync(25_000);
  await expectation;
  expect(jest.getTimerCount()).toBe(0);
  expect(mockFetch).toHaveBeenCalledTimes(1);
});

test('leaving the component cancels the in-flight request and clears its timer', async () => {
  jest.useFakeTimers(); pendingFetch();
  const controller = new AbortController();
  const pending = submitSupportTicket(values, 'https://waha.systems/contact', controller.signal);
  const expectation = expect(pending).rejects.toMatchObject({ reason: 'unconfirmed' });
  controller.abort();
  await expectation;
  expect(jest.getTimerCount()).toBe(0);
});
