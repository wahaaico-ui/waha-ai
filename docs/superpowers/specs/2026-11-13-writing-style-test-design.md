# Writing style test before drafting help — design (2026-11-13)

Roadmap item 3.1, first part. Requirements: DOC-26-03 (style test of sentences, vocabulary, paragraphs, terms and citations; acceptance: the user reviews the profile before it is used in rewriting) and DOC-13-06 (a mandatory style test before writing assistance; acceptance: no personalised generation starts before the style sample is approved). Owner decision 13 Nov: the test is mandatory before the «اقترح مسودة» button.

## Measuring (no model)

`src/lib/writing-style.ts` measures a pasted sample of at least 150 words (at most 12,000 characters) with fixed rules:

- Sentences: count, average words, share longer than 30 words; a length class (short under 15, medium 15 to 25, long above 25).
- Paragraphs: count and average sentences.
- Vocabulary range: distinct words over all words.
- Terms: two-word phrases and words that recur in at least three different sentences (stop words and citations removed); a word inside a chosen phrase counts only where it also recurs elsewhere. At most eight.
- Citations: author-year in parentheses or numbers in brackets, and how many per 100 words.
- Voice: first person, third person (الباحث، الدراسة), mixed, or not shown.

## Review and approval

`/research/writing-style` (linked from the account page and from the draft assistant when it is blocked): paste, analyse (nothing saved), review the measures in plain words, edit the terms, choose voice and sentence length, approve. On approval the server measures the same sample again, applies the edits and saves only the profile in the account metadata (`writingStyle`, version 1 with `approvedAt`). The sample is never stored.

## Gate and use

- `/api/research/draft` answers 428 `STYLE_PROFILE_REQUIRED` until an approved profile exists; the draft assistant shows the reason and a link to the test, which brings the researcher back to the same page.
- With a profile, the approved choices (sentence length, paragraph size, voice, terms, citation format) are added to the drafting prompt as rules, before the project record. The rules never add citations that are not in the project.

## Tests

Unit: measures on Arabic and English samples, minimum length, approval with edits, validation of stored profiles, drafting rules without the sample text. Routes: sign-in, measuring saves nothing, approval re-measures and stores only the profile, allowed choices, the 428 gate, rules placed before the project record. Render: measures in plain words, the sample is not kept. Gate: the draft route answers 428 for a new account, the test page measures and approves a sample, and the saved profile reads back.
