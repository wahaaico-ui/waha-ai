import { createHash } from 'node:crypto';
import { passwordExposureCount } from '@/lib/pwned-password';

describe('Pwned Passwords k-anonymity check', () => {
  test('sends only the five-character hash prefix and detects a leaked password', async () => {
    const password = 'WahaSecure9!';
    const hash = createHash('sha1').update(password, 'utf8').digest('hex').toUpperCase();
    const fetcher = jest.fn().mockResolvedValue(new Response(`${hash.slice(5)}:42\r\n${'A'.repeat(35)}:0`, { status: 200 }));

    await expect(passwordExposureCount(password, fetcher)).resolves.toBe(42);
    expect(fetcher).toHaveBeenCalledWith(
      `https://api.pwnedpasswords.com/range/${hash.slice(0, 5)}`,
      expect.objectContaining({ headers: expect.objectContaining({ 'Add-Padding': 'true' }) }),
    );
    expect(JSON.stringify(fetcher.mock.calls)).not.toContain(password);
    expect(JSON.stringify(fetcher.mock.calls)).not.toContain(hash);
  });

  test('returns zero when the hash suffix is absent', async () => {
    const fetcher = jest.fn().mockResolvedValue(new Response(`${'B'.repeat(35)}:12`, { status: 200 }));
    await expect(passwordExposureCount('UniqueSecure9!', fetcher)).resolves.toBe(0);
  });

  test('fails closed when the external security check is unavailable', async () => {
    const fetcher = jest.fn().mockResolvedValue(new Response('', { status: 503 }));
    await expect(passwordExposureCount('UniqueSecure9!', fetcher)).rejects.toThrow('503');
  });
});
