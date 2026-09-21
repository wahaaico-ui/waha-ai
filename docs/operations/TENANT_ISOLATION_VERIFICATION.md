# Production tenant-isolation verification

## Verified gate

- Date: 2026-09-21
- Target: Supabase production project used by `https://waha.systems`
- Command: `npm run test:authorization`
- Result: **passed**
- Actors: two isolated confirmed users plus one anonymous browser client
- Cleanup: temporary accounts and rows are deleted after every run

## Coverage

- Owner access was verified for 10 browser-facing datasets.
- Cross-account and anonymous reads were blocked across 15 datasets.
- Cross-account updates, deletes, and inserts were blocked for projects, documents, sources, references, profiles, and research-stage drafts.
- `save_research_stage_draft` was called as the second user and preserved project ownership through its `security invoker` execution.
- Browser mutation was blocked for usage, subscription, verification, integration-secret, and support-ticket records.
- Forged usage and idea-verification audit records were rejected.
- The production rate limiter accepted the allowed request, blocked the excess request atomically, and rejected direct browser RPC execution.

## Datasets exercised

`projects`, `documents`, `sources`, `ai_generations_log`, `project_references`, `research_stage_drafts`, `profiles`, `users_usage`, `subscriptions`, `idea_verifications`, `user_integrations`, `support_requests`, `research_projects`, `saved_papers`, and `research_profiles`.

## CI handling

The production release gate stores the service-role key and public browser key as encrypted GitHub Actions secrets. The runner does not print or persist either key. The service role is used only to create fixtures, assert their final state, and clean them up; all authorization assertions use actual authenticated or anonymous browser-role clients.
