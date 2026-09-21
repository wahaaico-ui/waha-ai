# Production academic-search verification

## Verified gate

- Date: 2026-09-21
- Target: `https://waha.systems/api/academic/search`
- Release commit: `eaa46ce`
- GitHub Actions: `https://github.com/wahaaico-ui/waha-ai/actions/runs/35609205235`
- Result: **passed**

## What was proven

- The production endpoint requires an authenticated account and returns original provider records.
- A stable higher-education query returned at least one source with a title, provider provenance, and DOI or safe URL.
- At least two independent providers were available during the production request.
- Arabic searches can execute one distinct translated query; the alternate query is no longer ranking-only metadata.
- Results from both query forms are deduplicated before ranking and enrichment.
- A provider remains usable when one query form fails and the other succeeds.
- A failed provider is reported as unavailable and is never replaced with a fabricated citation.

## Provider availability check

`npm run test:integrations` passed its production quorum with 12 of 14 checked services available. OpenAlex, Crossref, CORE, arXiv, Europe PMC, OpenAIRE, PLOS, DataCite, PubMed, OpenCitations, Unpaywall, and CiteAs responded successfully. Semantic Scholar returned HTTP 429 and DOAB timed out during this run; both were treated as explicit degraded providers, while the independent-source quorum kept discovery operational.

## Automated regression coverage

- 404 Jest tests passed locally, including translated-query execution and partial-provider recovery.
- The production release gate passed the browser suite and the separate tenant-authorization suite.
- The academic endpoint gate validates authentication, provider coverage, non-empty results, source provenance, and a traceable identifier.
