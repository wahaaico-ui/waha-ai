# Research career from OpenAlex and ORCID — design (2026-11-12)

Requirements: DOC-30-01 (track citations after publication: count, journals, countries and contexts; acceptance: a work with a similar title is never mixed with the intended work), DOC-30-02 (suggest next research directions from the career), DOC-30-03 (a timeline profile that can be shared and exported; acceptance: a revoked link exposes nothing).

## Rules

- Works are found by the researcher's ORCID iD (`author.orcid` in OpenAlex), never by name or title, so a work with a similar title or an author with the same name is never mixed in. The iD's ISO 7064 11,2 check digit is verified before use.
- Only what OpenAlex states. It does not publish the sentences that cite a work, so `contexts` is always null and the page and file say "not available".
- Free sources only (owner decision): no paid citation index.
- Directions are topics of the works citing the researcher's five most cited works, minus the topics the researcher already publishes in; each names the works it came from and the number of citing studies. No scores.

## Model

`src/lib/scholarly-career.ts`, with `normalizeOrcid` in `src/lib/orcid.ts` so the page bundle carries no server code:

- `loadCareer(orcid)`: the author record (`authors/orcid:<id>`), up to 100 works, and for the five most cited works their citations by year (`works/<id>` `counts_by_year`) plus the citing works grouped by country, journal and topic (`cites:<id>`). Each group lookup that fails leaves that list empty; the work list itself must load or the route answers 503. Cached six hours. Every call carries the platform OpenAlex key.
- Pure `toTimeline`, `toCitationProfile`, `toNextDirections` and `careerExportModel` hold the rules and are unit tested.

## Interface

- The iD is kept in the account's `user_metadata.orcid` (saved with `supabase.auth.updateUser`, like the academic profile). No new table.
- `GET /api/career` → `{ orcid, career }` from the signed-in account's own iD only (no iD in the request, so no one can read another account's career through it); `POST /api/career` `{ format: docx|pdf, language }` → the file from the shared export builders. 10 requests a minute.
- `/dashboard/career` ("My research career"), linked from `/dashboard/profile`: iD entry with remove, export buttons, then researcher, citation tracking, next directions and the timeline.

## Public share link (DOC-30-03, owner approved 12 Nov)

- Table `career_share_links` (migration `20261112000000_career_share_links.sql`): token (32 URL-safe random characters), owner, the ORCID iD at creation, chosen sections (timeline, citations, directions), created and revoked times. RLS: the owner reads, creates and revokes only their own rows; only `revoked_at` can be updated; one active link per researcher (partial unique index). No table access for visitors.
- Visitors reach a link only through `shared_career(token)`, a security-definer function that returns the iD and sections of an active link and nothing else. No service role.
- `GET/POST/DELETE /api/career/share` under the owner's session: read the active link, create one (the earlier link is revoked first), revoke. 503 "not enabled yet" while the migration is not applied.
- `/career/<token>`: public, never indexed; shows only OpenAlex data for the linked iD and the chosen sections; a malformed, unknown or revoked token is "not found", so a revoked link reveals nothing. No project or account data is ever read.
- On the career page: choose sections, create or replace the link, copy it, revoke it after a confirmation. A warning appears when the link still shows an earlier iD.

## Tests

Unit tests for the iD check, timeline, citation profile, directions and the export file (Arabic, and English with no Arabic left); route tests (sign-in, no iD, OpenAlex failure, format, missing iD, file); render tests (empty states, contexts not available, DOI links). Gate: a signed-in account opens the page from the profile, saves a public test iD, sees citation tracking and downloads a PDF; then creates a link without the directions section, a visitor without a session sees only the chosen sections, and after revoking the link the visitor gets 404 (skipped with a stated reason while the migration is not applied).
