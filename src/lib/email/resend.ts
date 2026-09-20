const RESEND_ENDPOINT = 'https://api.resend.com/emails';
const EMAIL_TIMEOUT_MS = 12_000;

export type TransactionalEmail = {
  to: string;
  subject: string;
  html: string;
  text: string;
  idempotencyKey: string;
  replyTo?: string;
};

export function isProjectEmailConfigured() {
  return Boolean(process.env.RESEND_API_KEY?.trim() && process.env.WAHA_EMAIL_FROM?.trim());
}

export async function sendTransactionalEmail(email: TransactionalEmail) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.WAHA_EMAIL_FROM?.trim();
  if (!apiKey || !from) throw new Error('EMAIL_NOT_CONFIGURED');

  const response = await fetch(RESEND_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': email.idempotencyKey.slice(0, 256),
    },
    body: JSON.stringify({
      from,
      to: [email.to],
      subject: email.subject,
      html: email.html,
      text: email.text,
      ...(email.replyTo ? { reply_to: email.replyTo } : {}),
    }),
    signal: AbortSignal.timeout(EMAIL_TIMEOUT_MS),
  });

  if (!response.ok) throw new Error(`EMAIL_PROVIDER_ERROR_${response.status}`);
  const data: unknown = await response.json();
  if (!data || typeof data !== 'object' || typeof (data as { id?: unknown }).id !== 'string') {
    throw new Error('EMAIL_PROVIDER_INVALID_RESPONSE');
  }
  return { id: (data as { id: string }).id };
}

export const sendProjectSnapshotEmail = sendTransactionalEmail;
