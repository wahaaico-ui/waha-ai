# Academic export verification

Last verified: 2026-10-02

## Scope

Verified WAHA academic project export for:

- Word DOCX with Arabic RTL content, cover page, manual contents page, section headings, footer page numbers, sources, and references.
- Academic PDF with embedded Arabic font, cover page, contents page, outline bookmarks, page numbers, Arabic text, numbers, equations, DOI/URL strings, sources, and references.

## Commands

```bash
WRITE_EXPORT_QA=1 npm test -- --runInBand src/lib/__tests__/project-document-export.test.ts src/lib/__tests__/project-export.test.ts src/app/api/academic/export/route.test.ts
npx tsc --noEmit
npx eslint src/lib/project-export.ts src/lib/project-document-export.ts src/lib/__tests__/project-document-export.test.ts
```

## Generated QA artifacts

When `WRITE_EXPORT_QA=1` is enabled, test files are written to:

- `/private/tmp/waha-export-qa/waha-academic-export.docx`
- `/private/tmp/waha-export-qa/waha-academic-export.pdf`

Visual rendering was checked with LibreOffice/docx rendering and `pdftoppm` image conversion.

The full unit suite passed: 74 suites, 405 tests. TypeScript, targeted ESLint, and whitespace checks passed. Academic alternate-query tests now mock every routed provider so they do not depend on live network availability.

## Current known limits

- LaTeX, HTML, EPUB, and RTF exports are not implemented.
- Contents indexes are implemented; separate figure, table, and glossary indexes are not implemented.
- Full APA/Vancouver/IEEE/reference-style conformance still needs a dedicated reference formatter and golden fixtures.
- University-specific formatting needs the university guide ingestion/formatter phase.
