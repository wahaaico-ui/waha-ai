import { decryptIntegrationSecret } from '@/lib/integrations/crypto';

export const GOOGLE_FORMS_RECEIPT_COOKIE = 'waha_google_forms_receipt';
export const GOOGLE_FORM_ID_PATTERN = /^[A-Za-z0-9_-]{10,200}$/u;

export type GoogleFormsReceipt = {
  userId: string;
  projectId: string;
  formId: string;
  responderUri: string | null;
  expiresAt: number;
};

export function safeGoogleFormsResponderUri(value: string | null) {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' && parsed.hostname === 'docs.google.com'
      && !parsed.username && !parsed.password && parsed.pathname.startsWith('/forms/')
      ? parsed.toString() : null;
  } catch { return null; }
}

/** Only authenticated server receipts count as proof; URL parameters never do. */
export function readGoogleFormsReceipt(encrypted: string | undefined, userId: string, projectId: string) {
  if (!encrypted) return null;
  try {
    const receipt = decryptIntegrationSecret<GoogleFormsReceipt>(encrypted);
    if (!receipt || receipt.userId !== userId || receipt.projectId !== projectId
      || !Number.isFinite(receipt.expiresAt) || receipt.expiresAt <= Date.now()
      || typeof receipt.formId !== 'string' || !GOOGLE_FORM_ID_PATTERN.test(receipt.formId)) return null;
    return {
      formId: receipt.formId,
      editUrl: `https://docs.google.com/forms/d/${encodeURIComponent(receipt.formId)}/edit`,
      responderUri: safeGoogleFormsResponderUri(receipt.responderUri),
    };
  } catch { return null; }
}
