# WAHA pricing and email operations

Last reviewed: 2026-09-09

## Launch status

- The Free plan is available.
- Pro and Expert are displayed for product positioning only.
- Paid checkout is intentionally not exposed in the pricing UI.
- Stripe routes remain dormant until approved price IDs and production billing are explicitly enabled.

## Product plans

| Plan | Price | Active projects | AI assists / month | Intended user |
| --- | ---: | ---: | ---: | --- |
| Free | $0 | 1 | 3 | Evaluation and early exploration |
| Pro | $20/month | 5 | 150 | Individual researchers |
| Expert | $60/month | 20 | 500 | Supervisors and research consultants |
| Institutional | Quote | Contract based | Contract based | Universities and research organisations |

### Free

- Idea, title, and problem exploration.
- Project persistence and academic source discovery.
- Limited WAHA-branded export.

### Pro

- Complete idea-to-publication journey.
- Questionnaire, interview, and research-instrument drafting.
- PDF and Word export without WAHA branding.
- Zotero and Google Forms integrations.
- Academic translation, proofreading, version history, and email delivery.
- Support target: 24–48 hours.

### Expert

- Everything in Pro.
- Multi-project management, expanded consistency reports, advanced templates, and priority processing.
- Support target: one business day.

### Institutional

- Starts from 25 users.
- Administrative dashboard, roles, institutional integrations, training, and dedicated support.
- Never advertise unlimited accounts without a signed capacity agreement.

## Cost baseline and unit economics

Planning baseline, excluding tax, refunds, advertising, salaries, and exceptional overages:

| Service | Planning cost / month |
| --- | ---: |
| Vercel Pro | $20.00 |
| Supabase Pro | $25.00 |
| Google Workspace Business Starter (flexible) | $8.40 |
| Domain amortisation | $3.83 |
| Resend Free, within allowance | $0.00 |
| Fixed baseline | $57.23 |

Assume $0.50 of AI usage per paid subscriber for conservative early planning. At a $20 Pro price, a domestic Stripe fee assumption of 2.9% + $0.30 leaves $19.12 before AI and fixed costs. Approximate contribution after the AI allowance is $18.62, so the fixed-cost break-even point is about four Pro subscribers.

Recalculate this model monthly from actual provider invoices and per-user token telemetry. Do not promise unlimited AI usage.

## Email architecture

### Transactional email

Use Resend SMTP/API for account and application events:

- `no-reply@waha.systems`: signup confirmation and password recovery.
- `notifications@waha.systems`: project snapshots and system notifications.
- Set `Reply-To: support@waha.systems` when a response is useful.
- Never place passwords, OTP secrets, API keys, or unnecessary private research content in email.

Production evidence for account confirmation and password recovery is recorded in [`docs/operations/TRANSACTIONAL_EMAIL_VERIFICATION.md`](operations/TRANSACTIONAL_EMAIL_VERIFICATION.md).

### Human-operated aliases

- `support@waha.systems`: technical and account support.
- `billing@waha.systems`: billing questions and invoices.
- `followup@waha.systems`: customer follow-up.
- `partnerships@waha.systems`: institutions and partnerships.

These may remain aliases routed to one licensed Google Workspace mailbox until workload justifies separate seats.

### Marketing email

- Use `newsletter@waha.systems` only for opted-in contacts.
- Keep marketing audiences and transactional recipients logically separate.
- Include an unsubscribe mechanism in every campaign.
- Record consent source and time; honour suppression/unsubscribe lists.
- Do not import application users into marketing campaigns without explicit consent.

## Activation checklist for paid billing

- Create and approve Stripe products and monthly/yearly prices.
- Configure production price IDs and webhook secret in Vercel.
- Enforce entitlements server-side, not only in the pricing page.
- Add customer self-service cancellation and subscription status.
- Test successful, failed, cancelled, refunded, and international payments.
- Publish Terms, Privacy, Refund, and Acceptable Use policies.
- Confirm tax, business-registration, and payout eligibility for the operating jurisdiction.
- Remove the “coming soon / no charge” notice only after every item above passes.

## Provider references

- Vercel pricing: https://vercel.com/pricing
- Supabase pricing: https://supabase.com/pricing
- Resend pricing: https://resend.com/pricing
- Stripe pricing: https://stripe.com/pricing
- Google Workspace pricing: https://workspace.google.com/pricing.html
