# Idea selection — design (2026-11-06)

Requirements: DOC-23-01 (map of recent directions), DOC-23-03 (passion and feasibility matrix), DOC-23-04 (five open questions before fixing the idea), DOC-24-07 (timing: emerging, peak or saturated). DOC-24-06 (private idea fingerprint) is deferred: it compares one researcher's idea with other users' ideas and needs an explicit consent decision from the owner first. Approved by the owner on 2026-11-06.

## Rules

- Every number shown comes from OpenAlex counts; nothing is estimated by a model.
- Only complete years are used. OpenAlex counts the current, incomplete year and a few future-dated records; both would distort a trend.
- The passion and feasibility ratings come from the researcher, not from WAHA.

## 1. Timing indicator (DOC-24-07)

`GET https://api.openalex.org/works?search=<query>&group_by=publication_year` gives real yearly counts for the topic. The last five complete years `c1..c5` are classified:

| Verdict | Rule |
| --- | --- |
| Not enough evidence | total < 20 |
| Emerging | total < 500 and growth ≥ 1.5 |
| At its peak | growth ≥ 1.2 |
| Saturated | total ≥ 500 and growth < 1.2 |
| Limited and stable | otherwise |

growth = (c4 + c5) / max(1, c1 + c2). The thresholds are a stated heuristic; the page shows the yearly counts and the growth so the researcher can judge.

## 2. Recent directions (DOC-23-01)

`group_by=primary_topic.id` for the query in the last two complete years and in the two years before. Topics with at least 10 recent works are ranked by the increase in works; up to 20 are shown with recent count, previous count and a link to the OpenAlex topic page.

## 3. Five open questions (DOC-23-04)

Fixed questions, not generated: what interests you most in this topic; what problem have you seen yourself; can you reach the people or cases you would study; is the data available to you; how much time do you have. Answers (up to 1,000 characters each) are saved in the project.

## 4. Passion and feasibility matrix (DOC-23-03)

For each research path in the exploration report, the researcher rates passion (1–5) and feasibility (1–5). Quadrants: pursue (both ≥ 4), make feasible (passion ≥ 4, feasibility < 4), reconsider interest (feasibility ≥ 4, passion < 4), set aside (both < 4). Saved in the project.

## Interface

- `POST /api/idea-insights` `{ query }` → `{ timing, trends, years, source: 'openalex' }`. Public like `/api/verify-idea`, rate limited, cached 6 hours per query.
- `GET|PUT /api/projects/[projectId]/idea-selection` → `{ answers, ratings }`. Owner only (`authoriseProject`); stored as a `documents` row of type `idea-selection:v1`, written by the server.
- `/verify-idea` shows timing and directions with the report, and the questions and matrix below the research paths. Without a project, answers stay on the page and the researcher is invited to sign in to save them.

## Units

- `src/lib/idea-selection/timing.ts`, `trends.ts`, `matrix.ts`, `questions.ts` — pure, unit tested.
- `src/lib/idea-selection/openalex-insights.ts` — the two OpenAlex group-by requests.
- Routes and `IdeaSelectionPanels` component; English catalog entries.

## Plan

1. timing and trends, tests first.
2. questions and matrix, tests first.
3. OpenAlex fetcher, `/api/idea-insights`, project route, route tests.
4. Page sections, translations.
5. tsc, eslint, jest, build; publish after approval; production gate check for `/api/idea-insights`.
