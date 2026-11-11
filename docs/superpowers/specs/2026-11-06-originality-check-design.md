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

- `POST /api/academic/originality` `{ projectId, input: 'draft' | 'text', text?, includeOpenSources }` → `{ checkedAt, coverage, passages[{ start, end, text, matches[{ origin, title, url, year, cited }] }], checked{ projectSources, openSources, providers }, licensed: 'not_configured', limitations[] }`. Owner check and the existing rate limit (10/min in `src/proxy.ts`).
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

## Deliverable report file (2026-11-11, DOC-39-02)

- Each check is saved as an immutable project document of type `journey:originality_report`, written with the service client after the owner check, as supervisor reviews are. The full project export, the journey and the dashboard read only stage types, so they skip it. A failed save fails the check: the page never shows a report that cannot be downloaded.
- The saved report adds what a reviewer needs to trace each match: every checked source, numbered (`sources`); each match's `sourceNumber`; each passage's paragraph and word range; the input kind and, for a draft, the time the draft was saved.
- `POST /api/academic/export { projectId, task: 'originality', documentId, format }` renders it with the existing Word, PDF and Markdown builders. Sections: report data (number, check time, project, researcher, checked text, words), summary (share of matched words with its definition, passages, uncited), scope (counts, open providers, licensed service), checked sources (numbered, kind, year, link, passages matched), matching rules, matches (location, text, each source number and cited state), limits.
- Privacy: the file holds only the project's own sources and public records; the export reads the document with the owner's session after the ownership check.
- Page: the shared `TaskExportButtons` under the report.
- Gate: the existing similarity check downloads the Word file and finds the report number, the copied sentence and the PDF source in it; the PDF download must be a real PDF.
