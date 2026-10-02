# Production E2E verification

## Verified release gate

- Date: 2026-10-02
- Target: `https://waha.systems`
- Result: **19/19 production browser checks passed**
- Tested release: `9748dcc881bd89fc2939a8d7464546492ca44a3f`
- CI evidence: https://github.com/wahaaico-ui/waha-ai/actions/runs/37028044177
- Fixtures: isolated temporary Supabase accounts and projects, removed after the run
- Command: `npm run test:e2e:production`

## Covered paths

| Area | Production evidence |
| --- | --- |
| Account lifecycle | Login, dashboard resume, logout, password recovery, password change, and sign-in with the new password |
| Authentication | Google OAuth initiation with the production callback and TOTP MFA enrollment, challenge, verification, and removal |
| Privacy | Account archive and permanent account deletion using an isolated disposable account |
| Research workflow | Complete authenticated journey through all 17 stages and rendering of the final output |
| Export | Authenticated Word and PDF export |
| Public launch path | Home, protected-route redirect, signup progression, recovery states, and exploration validation |
| Responsive smoke | Public launch path repeated with the Playwright Android mobile profile |

## Security controls

- The runner requires `SUPABASE_SERVICE_ROLE_KEY` from the process environment or an encrypted CI secret.
- The service key and temporary credentials are never printed or written to the repository.
- Every run creates unique accounts and deletes any surviving fixtures in a `finally` cleanup.
- Recovery verification uses the same PKCE-compatible `token_hash` confirmation route as production email templates; secret-bearing URL fragments are not used.
- CI runs only on manual dispatch because the gate creates and permanently deletes isolated production fixtures.

## Evidence boundaries

- The journey gate submits fixed synthetic stage payloads and checks rendered output. It does not certify the scientific quality of every generated AI draft.
- Google OAuth initiation is checked; interactive completion with a personal Google account is not automated.
- Temporary users are preconfirmed. Signup email delivery and inbox receipt are documented separately in `TRANSACTIONAL_EMAIL_VERIFICATION.md`; they were not reverified by this run.
- Android checks use Chromium device emulation, not a physical Xiaomi browser.

## Re-run

```bash
E2E_BASE_URL=https://waha.systems \
SUPABASE_SERVICE_ROLE_KEY='<encrypted-runtime-secret>' \
npm run test:e2e:production
```

Do not place the service-role key in `.env.local`, shell history, test reports, or repository files.
