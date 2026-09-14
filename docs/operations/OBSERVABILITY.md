# Production observability

Critical research and delivery paths emit structured JSON to Vercel Runtime Logs. They do not log prompts, generated content, API keys, user IDs, project IDs, research titles, or email addresses.

## Correlation

The research draft, journey load/save, literature search, evidence synthesis, and project snapshot routes include `x-waha-request-id`. A failed response also includes the same value in its JSON body so support can locate matching server events without asking for research content.

## Events

| Event | Meaning |
| --- | --- |
| `api.research_draft.started` | Request accepted by the route |
| `ai.provider_failed` | One provider failed; `provider`, HTTP `status`, and duration identify the dependency |
| `ai.generation_completed` | A provider completed the structured generation |
| `ai.generation_failed` | No configured provider completed the request |
| `api.research_draft.local_fallback` | The user received a grounded local draft instead of an empty error page |
| `api.research_draft.completed` | Final controlled outcome and HTTP status |
| `api.research_draft.failed` | Unexpected route failure |
| `api.research.journey.load.*` | Loading a user's saved research journey |
| `api.research.journey.save.*` | Validating and saving a research stage |
| `api.research.literature.*` | Searching configured academic sources |
| `api.research.analysis.*` | Synthesising only the user's selected evidence |
| `api.email.project_snapshot.*` | Sending the latest saved project snapshot |

## Incident lookup

1. Ask the user only for the displayed request ID and approximate time.
2. Open the production deployment's Runtime Logs in Vercel.
3. Filter for that request ID, then inspect `provider`, `status`, `durationMs`, `outcome`, and `errorCode`.
4. Do not request or paste the research prompt, password, token, or API key into a support ticket.

## Daily check

Filter production Runtime Logs by `level=error`. Group repeated failures by `route` and `errorCode`; a request ID links the public error to its server event. Treat controlled 4xx rejections as user-flow signals, not outages.

This baseline uses Vercel Runtime Logs and requires no paid log drain. External alerting and long-term retention remain a separate operational decision.
