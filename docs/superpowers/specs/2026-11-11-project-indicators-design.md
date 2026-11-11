# Project indicators — design (2026-11-11)

Requirement: DOC-38-01, indicators of compliance with the university guide, time and publishability. What is missing: each indicator explained with its missing data. Acceptance: without a guide the indicator is "not assessed", not a made-up score.

## Rules

- Three indicators, each a state (met, needs follow-up, not assessed), the lines it measured, and the data it is missing. No overall score, in line with the owner's decision for the consistency map.
- An indicator is "not assessed" when nothing could be measured; it then lists what to add and where.
- Numbers shown are measured counts (words, stages, days, references), never estimates of quality.

## Indicators

`src/lib/project-indicators.ts`, pure:

- **Guide** (`guideIndicator`): needs approved rules in the saved guide; an unreadable guide is reported as such. Checked against the draft: thesis word limit (evidence-writing draft words), abstract word limit (publication stage abstract) and citation system (the draft's style). Approved formatting rules are listed as applied by the Word export. A guide of formatting rules alone is met by the export; checked rules need a measurement, otherwise the indicator is not assessed and lists the missing draft or abstract.
- **Time** (`timeIndicator`): needs the researcher's quick time answer (DOC-23-03) and at least three finished stages. Pace = days since the first saved stage ÷ finished stages; the remaining stages are estimated at that pace and compared with under six months (182 days) or six months to a year (365 days); over a year has no upper limit. A finished journey is met.
- **Publishability** (`publicationIndicator`): needs a saved journal template; reuses `buildJournalFit` (sections, words, abstract, keywords, references).

## Interface

- `GET /api/projects/[projectId]/indicators` → `{ indicators: [guide, time, publication] }`, owner only, private no-store. Reads the project's guide, its journey stages (through the shared `journeyOutputs`, now also used by the journey route), the latest writing draft, journal template and idea selection, and the owner's reference count.
- `/research/journey` shows "Project indicators" after the stage grid: one card per indicator with its state, lines and missing data.

## Tests

Unit tests for each indicator (not assessed, met, needs follow-up, missing data, no invented numbers), route tests (ownership, empty project, saved guide/draft/template/time answer, unreadable guide), component render tests (Arabic and English; a not-assessed card shows no number). Gate: the research tools project (guide, template, time answer saved earlier) is assessed on guide and publishability and not on time; the journey project, without guide or template, is not assessed on both and met on time, and the journey page shows the panel.
