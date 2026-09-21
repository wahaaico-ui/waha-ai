# Browser verification

Run `E2E_BASE_URL=https://waha.systems npm run test:e2e:critical` for public checks. The authenticated checks are skipped when dedicated credentials are unavailable.

For the required account gate, set `E2E_REQUIRE_AUTH=true`, `E2E_TEST_EMAIL`, and `E2E_TEST_PASSWORD` in the process environment. Missing credentials or an unresolved MFA challenge fail this gate. Do not put credentials in source control or chat.

The manually dispatched GitHub workflow `Browser checks (partial launch coverage)` requires the repository secret `SUPABASE_SERVICE_ROLE_KEY`. The key is server-only and is used by `scripts/run-production-core-e2e.mjs` to create isolated temporary accounts/projects, run the production gate, and delete the fixtures in `finally`. Authenticated tests disable traces, screenshots, and videos to avoid recording credentials. Never expose the secret in browser code, artifacts, or raw logs.

Coverage includes public navigation, login/dashboard/logout, opt-in temporary-account signup/confirmation, password recovery, TOTP MFA enrollment/challenge/removal, the sequential 17-stage research journey and final seminar rendering, plus the live Google OAuth initiation and production callback configuration. Transactional signup and recovery delivery is verified separately against the production Resend event log; see [`docs/operations/TRANSACTIONAL_EMAIL_VERIFICATION.md`](../../docs/operations/TRANSACTIONAL_EMAIL_VERIFICATION.md). Automated completion inside a real Google account remains outside this suite. Galaxy S8 settings emulate a mobile viewport in current Chromium, not Xiaomi hardware or an old browser engine. The remote URL tests the currently deployed version, not necessarily the checked-out commit.
