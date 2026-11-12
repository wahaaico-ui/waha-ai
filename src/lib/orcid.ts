/** Shared by the career page and server: no network or server code here. */
/** The 16-character iD with its ISO 7064 11,2 check digit verified, or null. */
export function normalizeOrcid(value: unknown): string | null {
  const match = typeof value === 'string' ? /(\d{4})-?(\d{4})-?(\d{4})-?(\d{3}[\dX])\s*$/i.exec(value.trim()) : null;
  if (!match) return null;
  const digits = match.slice(1).join('').toUpperCase();
  let total = 0;
  for (const char of digits.slice(0, 15)) total = (total + Number(char)) * 2;
  const check = (12 - (total % 11)) % 11;
  if ((check === 10 ? 'X' : String(check)) !== digits[15]) return null;
  return `${digits.slice(0, 4)}-${digits.slice(4, 8)}-${digits.slice(8, 12)}-${digits.slice(12)}`;
}
