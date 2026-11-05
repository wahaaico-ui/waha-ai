/** Availability only; this does not qualify evidence or verify study findings. */
export function availableAbstract(value: unknown): string {
  if (typeof value !== 'string') return '';
  const text = value.trim();
  const marker = text.replace(/[.!\s]+$/u, '').toLowerCase();
  if (/^(?:(?:المستخلص|الملخص) غير (?:متوفر|متاح)|لا يوجد (?:مستخلص|ملخص)|no abstract(?: available)?|abstract (?:not available|unavailable)|n\/a)$/u.test(marker)) return '';
  return text;
}
