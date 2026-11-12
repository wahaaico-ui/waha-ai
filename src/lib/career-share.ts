/**
 * Public share links for the research career (DOC-30-03). A link names the
 * ORCID iD and the sections the researcher chose; the public page shows only
 * OpenAlex data for that iD and stops at once when the link is revoked.
 */
export const SHARE_SECTIONS = ['timeline', 'citations', 'directions'] as const;
export type ShareSection = typeof SHARE_SECTIONS[number];
export type CareerShareLink = { token: string; orcid: string; sections: ShareSection[]; createdAt: string };

export const SECTION_LABELS: Record<ShareSection, string> = {
  timeline: 'الأعمال المنشورة',
  citations: 'تتبع الاستشهادات',
  directions: 'اتجاهات تالية مقترحة',
};

/** The chosen sections in their fixed order, or null when the choice is empty or unknown. */
export function parseShareSections(value: unknown): ShareSection[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.some(item => !SHARE_SECTIONS.includes(item as ShareSection))) return null;
  return SHARE_SECTIONS.filter(section => value.includes(section));
}

const TOKEN = /^[A-Za-z0-9_-]{32}$/;
export const isShareToken = (value: unknown): value is string => typeof value === 'string' && TOKEN.test(value);

/** 24 random bytes as 32 URL-safe characters. */
export function newShareToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return Buffer.from(bytes).toString('base64url');
}

export const sharePath = (token: string) => `/career/${token}`;

/** The table is missing until its migration is applied in production. */
export const isMissingTable = (error: { code?: string } | null | undefined) => error?.code === '42P01' || error?.code === 'PGRST205' || error?.code === 'PGRST202';
