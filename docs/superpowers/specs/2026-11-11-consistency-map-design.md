# Consistency map — design (2026-11-11)

Requirement: DOC-26-01, a visual map linking the research parts. Acceptance: an error in an objective shows its affected relationships visually.

## Owner decision (2026-11-11)

The four consistency engines already compute, for every link, a status, the reasons (`gapsFound`) and a suggested action, but every page showed only fixed review prompts. The owner chose to show each link's signal with its reasons and suggested action, framed as a prompt for the researcher's review, without numbers: the engines compare wording, so a signal points to a place to look, not a verdict. The per-page review panels stay as they are and link to the map.

## Model

`src/lib/research-objects/consistency-map.ts`, pure:

- `evaluateConsistencyMap(projectId, documents)` builds the research object view from the saved `journey:problem`, `objectives`, `questions`, `hypotheses` and `methodology` documents and runs the four engines. Without a hypotheses document the hypotheses check is not run, and the map says the stage is not saved yet.
- One chain per objective: problem → objective → each question that operationalizes it → its hypothesis, and question → methodology. Questions tied to no objective form their own chain.
- Signals: passed → sound, warning → needs review, failed → conflicting, no result → not checked. A decision not to use hypotheses is shown once, with the hypotheses engine's thresholds.
- `flagged`: nodes whose own link needs review or conflicts. `affected`: for each node, its own links and every link built on it (the problem affects everything; an objective affects its problem link and its questions' links; the methodology affects every question→methodology link).
- `notices`: why parts were not checked (missing stages, unreadable inputs).

## Interface

- `GET /api/projects/[projectId]/consistency/map` → `{ map }`, signed-in owner only, private no-store.
- `/research/consistency-map`: legend; the problem; one card per objective with a row per link (two node buttons, the signal word, reasons and suggested action when it needs review). Choosing a node marks every affected link with a ring and "affected by your choice", and says how many links depend on it. No scores, no engine summaries.
- The shared review panel on the objectives, questions, hypotheses and methodology pages links to the map.
- English: every interface string and every engine reason or action the map can show has a catalog entry; the two actions that quote the problem's concepts are system templates, and the quoted concepts stay as written.

## Tests

Unit tests for the chains, signals, flags, affected links, the hypotheses decision, unsaved stages and an empty project; route tests for sign-in, ownership, private responses and hidden database errors; component render tests that choosing an objective that conflicts with the problem marks exactly its affected links, in Arabic and English, and that no score appears. Gate: after the journey test saves all stages, the map has a signal on every link and choosing objective 1 on the live page marks its affected links.
