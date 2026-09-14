# Production transactional email verification

Verification date: 2026-09-14  
Environment: `https://waha.systems`  
Provider evidence: Resend production event log

## Verified flows

| Flow | Sender | Subject | Provider events | Link target |
| --- | --- | --- | --- | --- |
| Account confirmation | `notifications@waha.systems` | `تأكيد حسابك في WAHA` | `sent`, `delivered` | `https://waha.systems/auth/confirm` with a one-time `token_hash` and `type=email` |
| Password recovery | `notifications@waha.systems` | `إعادة تعيين كلمة مرورك \| WAHA` | `sent`, `delivered` | `https://waha.systems/auth/confirm` with a one-time `token_hash`, `type=recovery`, and `next=/reset-password` |

Both delivered messages render the WAHA Arabic template and keep the user on the production domain. Recipient addresses and one-time tokens are intentionally excluded from this repository.

## Diagnostic boundary

Messages sent to generated `+` aliases at `waha.systems` bounced because those generated recipients were not valid mailboxes. This is expected mailbox behaviour and does not indicate an SMTP or application failure. Production delivery checks must use a dedicated, controlled mailbox that can receive mail; credentials and addresses must stay in the secret store and must not be committed.

## Release rule

- Keep browser tests free of real inbox credentials and message bodies.
- Verify UI/auth callbacks automatically with temporary users.
- Verify provider delivery events manually or in a protected, opt-in job using a dedicated mailbox.
- Never log API keys, one-time confirmation/recovery tokens, or private recipient addresses.
