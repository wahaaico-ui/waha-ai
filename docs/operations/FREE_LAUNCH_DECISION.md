# Free launch decision — 2026-10-02

## Decision

The current production core can open to a limited free Beta on https://waha.systems. The tested release is `9748dcc881bd89fc2939a8d7464546492ca44a3f`. This decision does not certify all requirements in the 61-page product document or all possible user inputs.

Payment remains disabled at the owner's request. No new subscription or API key was required to pass this release gate.

## Current evidence

| Check | Result |
| --- | --- |
| Unit/regression suite | 405 tests across 74 suites passed |
| Production build | Passed on Vercel; deployed to the production domain |
| Production browser gate | 19 checks passed: account lifecycle, recovery, MFA, privacy, 17-stage journey, academic search, Word/PDF export, public and mobile smoke |
| Tenant isolation | Owner access to 10 datasets; cross-account and anonymous reads blocked across 15 datasets; writes, privileged RPC access, forged audit data and rate limiting checked |
| Disposable fixtures | Production runners completed cleanup without reported failures |

Reproducible CI evidence: https://github.com/wahaaico-ui/waha-ai/actions/runs/37028044177

## Security advisor result

Supabase security advisors returned no ERROR findings on 2026-10-02. The two INFO findings (RLS enabled without policies for `api_rate_limits` and `support_requests`) concern intentionally server-managed tables; browser grants are revoked and the authorization gate verifies denied browser access. Do not add permissive policies to suppress those notices.

One WARN remains: Supabase leaked-password protection is disabled. Supabase documents this feature as requiring Pro or above: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection. No paid upgrade was initiated. Enabling it remains a security hardening item, not a completed control.

## Limits and launch wording

Use: “WAHA free Beta: organize the research journey, review drafts and sources, and export saved research.”

Do not advertise full implementation of the 61-page document, guaranteed scientific acceptance, comprehensive plagiarism detection, or completed consultant/institution services. Researcher review is still required.

The current browser gate does not freshly prove inbox delivery, live scientific quality of every AI generation, or completion of Google consent. Earlier delivery evidence is recorded separately. Dedicated exports for LaTeX/EPUB, advanced indexes, university-specific formatting and complete citation-style conformance remain outside the tested export scope.

## Practical launch

1. Share the production domain with the first limited group of researchers using the free-Beta wording above.
2. Gather defects through the existing support path, including the failing page, step and approximate time; do not collect passwords or API keys.
3. Resolve reproduced defects before broadening access. Repeat the release gate after relevant changes.
