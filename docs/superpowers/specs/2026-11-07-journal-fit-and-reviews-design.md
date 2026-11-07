# Journal template fit and reviewer comments — design (2026-11-07)

Owner direction (6 Nov 2026): help the researcher arrange the idea and content to a journal's template — not publish on their behalf — and handle journal reviewers' comments the way supervisor notes are handled. Requirements: DOC-29-05 (apply the journal template), DOC-29-06 (respond to reviewers and track accepted and declined changes), and part of DOC-29-04 (arrange a thesis as an article).

## 1. Journal template fit

The researcher enters the journal's own instructions, starting from a generic preset, never from a claimed journal rule set:

| Field | Meaning |
| --- | --- |
| `sections` | Ordered manuscript sections (introduction, literature, methods, results, discussion, conclusion) |
| `wordLimit` | Total words, optional |
| `abstractMaxWords` | Abstract words, optional |
| `keywordsMin` / `keywordsMax` | Keyword count range |
| `referenceLimit` | Maximum references, optional |

Presets: «research article (IMRaD)» and «review article». Both are labelled starting points to adjust to the journal's guide for authors.

The fit is computed in the browser from the journey outputs the publication page already loads:

- Each journey stage maps to one manuscript section (problem, objectives, questions and hypotheses to introduction; literature and analysis to literature; methodology, design and instrument to methods; analysis input and results to results; discussion; conclusions and recommendations to conclusion).
- Words are counted in the saved outputs (all string values), the abstract in the publication stage's structured abstract, keywords in its keyword list, references in the project library.
- The result is an outline in the template's order, each section listing its source stages and word count, plus pass or fail checks with the actual number and the limit. Sections the template requires but the project lacks are flagged.

Stored as a server-written `journal-template:v1` document. `GET|PUT /api/projects/[projectId]/journal-template`, owner only.

## 2. Reviewer comments

One review round per journal decision: the editor's decision (accept, minor revision, major revision, reject), and comments, each with reviewer (editor or reviewer 1–5), comment, location, the researcher's response and status (open, addressed, declined). Addressed and declined comments need a response, a declined one says why.

- A point-by-point response letter is generated from the round (pure text, Arabic or English), ready to copy.
- Stored as immutable `journal-review:v1` snapshots written by the server, like supervisor reviews. `GET|POST /api/projects/[projectId]/journal-review`, owner only.

## Pages

Two new sections on `/research/publication`: «مطابقة قالب المجلة» and «ملاحظات المحكّمين»; Arabic and English.

## Testing

Unit tests for the template parser, stage mapping, word counting and checks; review parser and response letter. Route tests for owner checks and validation. Production gate: save a template and a review round on the temporary project and read them back.
