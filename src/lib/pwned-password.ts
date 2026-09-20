import { createHash } from 'node:crypto';

const RANGE_API = 'https://api.pwnedpasswords.com/range';

export async function passwordExposureCount(
  password: string,
  fetcher: typeof fetch = fetch,
): Promise<number> {
  const hash = createHash('sha1').update(password, 'utf8').digest('hex').toUpperCase();
  const prefix = hash.slice(0, 5);
  const suffix = hash.slice(5);
  const response = await fetcher(`${RANGE_API}/${prefix}`, {
    headers: {
      'Add-Padding': 'true',
      'User-Agent': 'WAHA-AI/1.0 password-security',
    },
    signal: AbortSignal.timeout(5_000),
  });

  if (!response.ok) throw new Error(`Pwned Passwords returned ${response.status}`);
  const match = (await response.text())
    .split(/\r?\n/)
    .map((line) => line.split(':'))
    .find(([candidate]) => candidate === suffix);
  if (!match) return 0;
  const count = Number(match[1]);
  return Number.isFinite(count) && count > 0 ? count : 0;
}

export async function isCompromisedPassword(password: string): Promise<boolean> {
  return (await passwordExposureCount(password)) > 0;
}
