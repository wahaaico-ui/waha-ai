/** Configuration presence only; never proof of a completed provider consent flow. */
export function isZoteroOAuthConfigured() {
  return Boolean(process.env.ZOTERO_CLIENT_KEY?.trim()
    && process.env.ZOTERO_CLIENT_SECRET?.trim()
    && process.env.INTEGRATIONS_ENCRYPTION_KEY
    && process.env.INTEGRATIONS_ENCRYPTION_KEY.length >= 32);
}

export function isGoogleFormsOAuthConfigured() {
  return Boolean(process.env.GOOGLE_FORMS_CLIENT_ID?.trim()
    && process.env.GOOGLE_FORMS_CLIENT_SECRET?.trim()
    && process.env.INTEGRATIONS_ENCRYPTION_KEY
    && process.env.INTEGRATIONS_ENCRYPTION_KEY.length >= 32);
}
