# Originality check — design (2026-11-06)

Requirements: DOC-39-01 (originality across internal research, external databases and machine-origin signals) and DOC-39-02 (report before submission). Owner instruction: integrate every source available.

## What it is, honestly

A **text-overlap check**: it finds passages in the researcher's text that repeat, word for word, text from sources the platform can actually read, and shows each matching source with its link. It is not a plagiarism certificate and shows no "originality score". The existing `/api/academic/originality` stub refused to guess a percentage; this design keeps that rule.

## Sources

| Source | What is compared | Status |
| --- | --- | --- |
| Project sources | Full text of the project's PDFs and saved references (via `readWritingSource`) | Built now |
| Open scholarly sources | Titles and abstracts returned by `UnifiedResearchEngine.searchDetailed` for queries taken from the text | Built now, opt-in |
| Licensed similarity service | Full-text databases (e.g. iThenticate, Copyleaks) | Interface only. Reports `not_configured` until the owner adds a contract and key. No untested client is written. |

Machine-origin (AI-writing) detection is **not** built: no detector is reliable enough to judge a student's work, and DOC-39 cannot be met honestly with one. The report states this.

## Matching

- Normalise: Arabic diacritics and tatweel removed; alef, yaa and taa-marbuta forms unified; Latin lower-cased; punctuation dropped.
- Word shingles of 7 words. A draft passage matches a source when it shares at least one shingle; contiguous shared shingles merge into one passage.
- Coverage = matched words / total words, reported as "share of text matching checked sources" with the list of what was checked.

## Citations

When the researcher checks the **saved evidence-writing draft**, its citations are loaded on the server. A matched passage inside a claim cited to the same source is marked **cited** (quoted and attributed); otherwise **uncited**. Pasted text has no citations, so every match is uncited.

## Privacy

Project text is compared on the server and never sent out. The open-source check is opt-in: up to three short phrases (12 words each) from the text are sent as search queries to public scholarly APIs; the page says so before the researcher runs it.

## Interface

- `POST /api/academic/originality` `{ projectId, input: 'draft' | 'text', text?, includeOpenSources }` → `{ checkedAt, coverage, passages[{ start, end, text, matches[{ origin, title, url, year, cited }] }], checked{ projectSources, openSources, providers }, licensed: 'not_configured', limitations[] }`. Owner check and rate limit (5/min).
- Page `/research/originality`, linked from the research workspace navigation, Arabic and English.

## Units

- `src/lib/originality/text-match.ts` — normalise, shingles, `findOverlaps(text, sources)`. Pure.
- `src/lib/originality/report.ts` — citation marking, coverage, limitations. Pure.
- `src/lib/originality/sources-server.ts` — project source loading, open-source queries, licensed provider status.
- Route and `OriginalityWorkspace` component.

## Testing

Unit tests for normalisation (Arabic forms), shingle matching, passage merging, cited/uncited marking and coverage. Route tests for auth, ownership, input limits. Production gate: a saved draft that copies a sentence from an uploaded PDF without a citation is reported uncited with that PDF as the source.

## Plan

1. `text-match.ts` with tests (failing first).
2. `report.ts` with tests.
3. `sources-server.ts`.
4. Replace the stub route; rate limit; MVP_SCOPE entry.
5. Page, navigation entry, English catalog entries.
6. Production gate check; tsc, eslint, jest, build; gate run.
