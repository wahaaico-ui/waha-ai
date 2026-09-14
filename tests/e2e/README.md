# Browser verification

Run `E2E_BASE_URL=https://waha.systems npm run test:e2e:critical` for public checks. The authenticated checks are skipped when dedicated credentials are unavailable.

For the required account gate, set `E2E_REQUIRE_AUTH=true`, `E2E_TEST_EMAIL`, and `E2E_TEST_PASSWORD` in the process environment. Missing credentials or an unresolved MFA challenge fail this gate. Do not put credentials in source control or chat.

The manually dispatched GitHub workflow `Browser checks (partial launch coverage)` requires repository secrets named `E2E_TEST_EMAIL` and `E2E_TEST_PASSWORD`. Use a confirmed dedicated account with no research data. Authenticated tests disable traces, screenshots, and videos to avoid recording credentials. Do not publish raw test logs containing private account information.

Coverage includes public navigation, login/dashboard/logout, opt-in temporary-account signup/confirmation, password recovery, TOTP MFA enrollment/challenge/removal, the sequential 17-stage research journey and final seminar rendering, plus the live Google OAuth initiation and production callback configuration. SMTP inbox delivery and automated completion inside a real Google account remain unverified by this suite. Galaxy S8 settings emulate a mobile viewport in current Chromium, not Xiaomi hardware or an old browser engine. The remote URL tests the currently deployed version, not necessarily the checked-out commit.
