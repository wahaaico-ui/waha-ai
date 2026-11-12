# DOAJ among the open sources — design (2026-11-13)

Requirement: DOC-31-04 (DOAJ and BASE among the named open sources; acceptance: a search shows each source's data under its correct name). Roadmap item 2.5 covers DOAJ; BASE stays open (below).

## Source

- DOAJ article search `https://doaj.org/api/search/articles/<query>`: public, no key, free. DOAJ asks clients to stay near two requests a second, so each search asks for one page of at most 20 articles.
- The path is read as an Elasticsearch query string, so query operators (`: " ( ) [ ] { } + - ! ^ ~ * ? \ /` and the like) are replaced by spaces; a title stays plain words and cannot change the query.
- Checked live on 13 Nov: Arabic queries return Arabic articles from Arabic journals with DOIs (for example education journals from Egyptian and Gulf universities), which the other open sources rarely surface.

## Mapping (`src/lib/academic/services/DOAJService.ts`)

Only what DOAJ states: title, abstract (markup removed), year, authors, DOI from `identifier`, journal title, publisher, ISSNs, volume, issue, pages, subjects and keywords, and the full-text link (a PDF link only when DOAJ marks it as PDF). Every record is open access because its journal is listed. No citation counts (DOAJ has none). Records without an id or title are dropped. Ids are `doaj:<DOAJ id>`.

## Wiring

- Provider id `doaj` in the provider type, the search registry, the source registry (label DOAJ, no key), the diagnostics allow-list and the live provider check script.
- Routed for `social-humanities` and `general` topics, beside DOAB and OpenAIRE. Not for biomedical, computing or engineering, where PubMed, Europe PMC, arXiv and others already cover open access.
- Shown by its own name wherever the interface names sources (`providerDisplayName`), with DOAB, Europe PMC, OpenAIRE, PLOS and DataCite named correctly too.

## BASE (not built)

BASE (Bielefeld Academic Search Engine) gives API access only to registered IP addresses after a request to the library, and the site runs on shared Vercel addresses. It needs the owner to apply for access; DOC-31-04 stays partial until then.

## Tests

Unit: mapping, query cleaning and page size, PDF link rule, routing and display names; engine tests mock DOAJ so they never call the network. Gate: an authenticated Arabic humanities search on the live site returns at least one result whose sources include `doaj`, each with a title and link.
