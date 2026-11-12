# Journal matching and reverse planning — design (2026-11-12)

Requirements: DOC-29-02 (match trusted journals; acceptance rates only when available; acceptance: a journal without a published rate shows "not available") and DOC-29-03 (reverse planning from a journal to three research angles tied to the journal's scope and the date of its data; acceptance: three different angles based on the journal's field).

## Rules

- Only OpenAlex data, as stated by OpenAlex. OpenAlex publishes no acceptance rates, so `acceptanceRate` is always null and the page says "not available; OpenAlex does not publish it". Nothing is estimated.
- Angles come from the journal's own most published topics; topics with fewer than three works in the period are not offered, and the page says when the data supports fewer than three.

## Model

`src/lib/journal-matching.ts`:

- `loadJournalMatches(query)`: works on the topic in the last five complete years, journals only, grouped by source (title search, falling back to OpenAlex full search under 20 works); the top eight sources with publisher, ISSN-L, open access, DOAJ listing, APC in USD and h-index from `/sources`. Cached six hours.
- `loadJournalAngles(journalId)`: the journal's works in the last three complete years grouped by primary topic; the top three topics with at least three works, each with the journal's latest work in it. Cached six hours.
- Pure `toJournalMatches` and `toJournalAngles` hold the rules and are unit tested.

## Interface

- `POST /api/journals` `{ query }` → `{ matches }`, `{ journalId }` → `{ angles }`; signed-in users, 10 requests a minute, 503 without a list when OpenAlex fails.
- `/research/publication`: "Journals that publish on your topic" before the journal template, the topic prefilled from the saved title; each journal can open "Plan from this journal".

## Tests

Unit tests for the rules, route tests (sign-in, validation, failure), render tests (Arabic and English; the acceptance rate reads not available; angles show their topics, counts and data date). Gate: the live route returns journals with null acceptance rates and at most three distinct angles.
