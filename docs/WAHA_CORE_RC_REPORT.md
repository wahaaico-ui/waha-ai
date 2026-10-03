# WAHA Core Release Candidate — implementation report

Starting branch: `claude/jolly-euler-1qu9i5`.
Starting commit: `9a0ce7ca845f00e7adde9624e0333c2ef5f93242`.
Scope: only the five approved RC corrections. No Phase 3, billing activation, deployment or migration.

## Behavior changed

1. Academic search removes legacy enrichment `verificationStatus` and `confidenceScore` from the public paper projection. Server-issued resultId and unverified citation-item contracts remain. The server-held paper, identifiers, observations, provenance and enrichment outcomes are not altered.
2. Four consistency panels now use a neutral preliminary-review component, explicit disclaimer and researcher review questions. Heuristic scores, progress bars, verdicts, missing-token concepts and categorical summaries are not rendered. Failed lexical overlap no longer independently rejects stage approval. Required fields, structural/integrity gates, ownership, versioning, autosave and server-owned writes remain unchanged. New decision records explicitly mark consistency as advisory.
3. Sources and formal Literature no longer display relevance percentages. Internal scores, ranking and deduplication remain unchanged.
4. Library empty state and locked Literature link to project-scoped Sources. Formal Literature approval still requires its existing prior stages. SearchScopePanel is untouched.
5. A server-only free-launch allowlist grants academic_language_tools and zotero_sync. Free launch defaults on; WAHA_CORE_FREE_LAUNCH=false explicitly restores existing subscription gates. This is not a development override, does not create subscriptions, and does not activate billing. Route authentication, ownership, read-only OAuth consent, encrypted credentials, rate/input limits and provider requirements remain.

## Verification

- `npm test`: **92 suites, 632 tests passed**, with the standard timeout.
- Existing search/resultId tests cover forged, expired, anonymous and cross-project selections, citations, canonical linkage, observations and server-write boundaries.
- Journey regressions cover all four failed lexical reports accepted with valid structure, and all four invalid structures rejected.
- Existing Research Intelligence, gap-rules-v2, workflow, ownership and trust-boundary regressions ran in the full suite.
- New free-launch tests: **12 passed**; real route handlers with mocked authentication/providers exercise language operations, text limits, unauthenticated rejection, Zotero read-only consent, encrypted user-bound OAuth state, collections and cross-project import rejection.
- New advisory component tests: **5 passed**; existing three panel suites now assert absence of heuristic verdicts, scores and token conclusions.
- `npx tsc --noEmit`: passed.
- `npm run lint`: passed.
- `git diff --check`: passed.
- Production compilation: `npm run build -- --webpack` passed, including Next's TypeScript pass and 119 generated pages.
- Default Turbopack build encountered a local subprocess/port error: `Operation not permitted (os error 1)`. No product/build configuration was changed to conceal this; Webpack production compilation succeeded.
- Browser suite: **10/10 passed** using the real local production build at 360px and 1280px. Sources search/save, Library empty state, early Literature discovery, advisory consistency and populated Literature were checked. RTL, mixed Arabic/English results, keyboard activation, project/resultId preservation and no horizontal overflow were asserted. Screenshots were inspected.
- Browser authentication and provider/API responses are isolated test fixtures, not live Production tests. These checks do not claim a fresh live OAuth/provider test or a Production deployment.

## Reproduce isolated UI verification

Build locally with NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:4319, NEXT_PUBLIC_SUPABASE_ANON_KEY=rc-test-anon and SUPABASE_SERVICE_ROLE_KEY=rc-test-service. Use the same temporary environment for the local server; do not upload this test build.

```sh
npm run build -- --webpack
npm start -- --hostname 127.0.0.1 --port 4320
E2E_BASE_URL=http://127.0.0.1:4320 npx playwright test tests/e2e/core-rc.spec.ts --project=chromium-desktop
```

The suite starts an isolated local Supabase-auth fixture on port 4319. No production database or credentials are used by the browser suite.

## Trust and scope

No changes to Research Intelligence semantics, gap-rules-v2, evidence qualification, claims/supports/search-runs/gap APIs, canonical resolution, provenance storage, RLS, migrations, OAuth/encryption implementations, rate-limit proxy, or server-write boundaries. Only the specifically authorized lexical approval veto was removed from journey POST; structural approval remains.

No manual deployment or Promote, no migrations, no billing activation. These changes are committed/pushed only to the requested branch; they do not assert that waha.systems is running this revision.

## Exact files changed

Repository root: `/Users/mohammedallouh/Downloads/node-v24.18.0-darwin-x64/waha-ai`.

```text
.env.example
docs/WAHA_CORE_RC_REPORT.md
src/app/api/academic/search/route.ts
src/app/api/projects/[projectId]/journey/route.test.ts
src/app/api/projects/[projectId]/journey/route.ts
src/app/research/library/page.tsx
src/app/research/literature/page.tsx
src/app/research/sources/page.test.tsx
src/components/ObjectivesQuestionsConsistencyPanel.test.tsx
src/components/ObjectivesQuestionsConsistencyPanel.tsx
src/components/ProblemObjectivesConsistencyPanel.test.tsx
src/components/ProblemObjectivesConsistencyPanel.tsx
src/components/QuestionsHypothesesConsistencyPanel.tsx
src/components/QuestionsMethodologyConsistencyPanel.test.tsx
src/components/QuestionsMethodologyConsistencyPanel.tsx
src/components/ResearchConsistencyAdvisory.test.tsx
src/components/ResearchConsistencyAdvisory.tsx
src/components/ResearchEvidenceSidebar.tsx
src/lib/__tests__/academic-integrations.test.ts
src/lib/__tests__/core-free-launch.test.ts
src/lib/__tests__/search-results-selection.test.ts
src/lib/billing/entitlements.ts
tests/e2e/core-rc.spec.ts
```

All changed source/test files are listed above. No environment secrets or .env.local changes are included.
