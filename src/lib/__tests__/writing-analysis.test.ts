import { createHash, randomUUID } from 'node:crypto';
import { parseAssessmentOutput, parseExtractionOutput, extractionIntoDraft, assessmentStillApplies, analysisExportSections, relationMismatch, readWritingAnalysis, readGroundedWritingAnalysis, EXTRACTION_FIELDS } from '@/lib/writing-analysis';
import { parseWritingDraft, type WritingSource } from '@/lib/evidence-writing';

const text = 'This fixture used 20 students. A small association was observed. Causation was not established.';
const source: WritingSource = { id: randomUUID(), kind: 'pdf', title: 'Synthetic study fixture', text, hash: createHash('sha256').update(text).digest('hex'), origin: 'uploaded_text', url: null, year: null };
const extraction = (value = 'شارك ٢٠ طالبًا.', quote = 'This fixture used 20 students.') => JSON.stringify({ fields: Object.fromEntries(EXTRACTION_FIELDS.map(key => [key, key === 'sample' ? { value, quote } : null])) });

test('grounds extracted values in original text, preserves missing fields, and rejects unsupported numbers', () => {
  const record = parseExtractionOutput(extraction(), source, 'ar')!;
  expect(record.fields.sample).toMatchObject({ value: 'شارك ٢٠ طالبًا.', quoteText: 'This fixture used 20 students.', quoteStart: 0 });
  expect(record.fields.findings).toBeNull(); expect(readWritingAnalysis(JSON.stringify(record))).toEqual(record);
  expect(parseExtractionOutput(extraction('شارك ٥٠ طالبًا.'), source, 'ar')).toBeNull();
  expect(parseExtractionOutput(extraction('Invented', 'Invented exact quote.'), source, 'en')).toBeNull();
  expect(parseExtractionOutput('{"fields":{}}', source, 'en')).toBeNull();
});
test('does not imply reading the whole file when the extraction context is bounded', () => {
  const long = { ...source, text: 'x'.repeat(60_001) + text };
  expect(parseExtractionOutput(extraction(), long, 'ar')).toBeNull();
  const empty = JSON.stringify({ fields: Object.fromEntries(EXTRACTION_FIELDS.map(key => [key, null])) });
  const result = parseExtractionOutput(empty, long, 'en')!;
  expect(result.scopeEnd).toBe(60_000); expect(result.sourceLength).toBe(long.text.length);
});
test('moves an extracted value into the writing with its own source passage and a cautious relation', () => {
  const record = parseExtractionOutput(extraction(), source, 'ar')!;
  const draft = extractionIntoDraft({ text: 'مقدمة.', citations: [] }, record, 'sample')!;
  expect(parseWritingDraft(draft)).not.toBeNull();
  expect(draft.text).toBe('مقدمة.\n\nشارك ٢٠ طالبًا.');
  expect(draft.citations[0]).toMatchObject({ sourceId: source.id, quoteStart: 0, relation: 'contextual' });
  expect(extractionIntoDraft(draft, record, 'findings')).toBeNull();
});
test('keeps semantic assessment as an explained suggestion tied to the exact claim and quote', () => {
  const draft = extractionIntoDraft({ text: '', citations: [] }, parseExtractionOutput(extraction(), source, 'ar')!, 'sample')!;
  const c = draft.citations[0];
  const output = { relation: 'contextual', rationale: 'The passage describes only the sampled students.', limitation: 'It cannot establish a universal conclusion.', quote: c.quoteText };
  const record = parseAssessmentOutput(JSON.stringify(output), source, c, randomUUID(), 'en')!;
  expect(readWritingAnalysis(record)).toEqual(record); expect(assessmentStillApplies(draft, record)).toBe(true);
  expect(assessmentStillApplies({ ...draft, text: 'Changed sentence' }, record)).toBe(false);
  expect(parseAssessmentOutput(JSON.stringify({ ...output, quote: 'Nonexistent evidence' }), source, c, randomUUID(), 'en')).toBeNull();
  expect(parseAssessmentOutput(JSON.stringify({ ...output, relation: 'verified' }), source, c, randomUUID(), 'en')).toBeNull();
  expect(parseAssessmentOutput(JSON.stringify({ ...output, rationale: 'I am 99.9 percent confident.' }), source, c, randomUUID(), 'en')).toBeNull();
});

test('does not validate assessment numbers against parts of a study that were not supplied to the model', () => {
  const longText = text + ' background'.repeat(1000) + ' An unrelated experiment enrolled 80 participants.';
  const longSource = { ...source, text: longText, hash: createHash('sha256').update(longText).digest('hex') };
  const draft = extractionIntoDraft({ text: '', citations: [] }, parseExtractionOutput(extraction(), longSource, 'ar')!, 'sample')!;
  const citation = draft.citations[0];
  const output = { relation: 'supports', rationale: 'The supplied context reports 80 participants.', limitation: 'Only this passage was assessed.', quote: citation.quoteText };
  expect(parseAssessmentOutput(JSON.stringify(output), longSource, citation, randomUUID(), 'en')).toBeNull();
  const valid = parseAssessmentOutput(JSON.stringify({ ...output, rationale: 'The supplied context reports ٢٠ students.' }), longSource, citation, randomUUID(), 'ar')!;
  expect(valid).not.toBeNull();
  expect(readGroundedWritingAnalysis(valid, longSource, citation)).toEqual(valid);
  expect(readGroundedWritingAnalysis({ ...valid, rationale: output.rationale }, longSource, citation)).toBeNull();
});

test('rejects an assessment when the selected evidence no longer matches its source', () => {
  const citation = extractionIntoDraft({ text: '', citations: [] }, parseExtractionOutput(extraction(), source, 'ar')!, 'sample')!.citations[0];
  const output = { relation: 'contextual', rationale: 'The passage describes the sample.', limitation: 'Only this passage was assessed.', quote: citation.quoteText };
  expect(parseAssessmentOutput(JSON.stringify(output), { ...source, hash: 'b'.repeat(64) }, citation, randomUUID(), 'en')).toBeNull();
  expect(parseAssessmentOutput(JSON.stringify(output), source, { ...citation, quoteStart: 1, quoteEnd: citation.quoteEnd + 1 }, randomUUID(), 'en')).toBeNull();
});

test.each([
  ['The correlation was r = -0.42.', 'The correlation was r = +0.42.'],
  ['The response rate was 25%.', 'There were 25 participants.'],
  ['The difference was p < .001.', 'The difference was p = .001.'],
  ['The estimate was 1e-3.', 'The estimate was 1e3.'],
  ['The estimate was ±2.', 'The estimate was 2.'],
] as const)('rejects a changed numerical meaning from %s in both new and restored extractions', (quote, value) => {
  const study = { ...source, text: quote, hash: createHash('sha256').update(quote).digest('hex') };
  const valid = parseExtractionOutput(extraction(quote, quote), study, 'en')!;
  expect(valid).not.toBeNull();
  expect(parseExtractionOutput(extraction(value, quote), study, 'en')).toBeNull();
  const forged = { ...valid, fields: { ...valid.fields, sample: { ...valid.fields.sample!, value } } };
  expect(readGroundedWritingAnalysis(forged, study)).toBeNull();
});

test.each([
  ['The response rate was 25%.', 'The response rate was 25 percent.'],
  ['The correlation was r = −0.42.', 'كان الارتباط r = -٠٫٤٢.'],
  ['The estimate was 1e-3.', 'The estimate was 0.001.'],
] as const)('accepts equivalent notation without changing the quantity in %s', (quote, value) => {
  const study = { ...source, text: quote, hash: createHash('sha256').update(quote).digest('hex') };
  expect(parseExtractionOutput(extraction(value, quote), study, 'ar')).not.toBeNull();
});

test('checks numerical meaning in citation assessments and their restored records', () => {
  const quote = 'The observed correlation was r = −0.42.';
  const study = { ...source, text: quote, hash: createHash('sha256').update(quote).digest('hex') };
  const draft = extractionIntoDraft({ text: '', citations: [] }, parseExtractionOutput(extraction('An association was observed.', quote), study, 'en')!, 'sample')!;
  const citation = draft.citations[0];
  const assessment = { relation: 'supports', rationale: 'The observed correlation was r = -0.42.', limitation: 'This does not establish causation.', quote };
  const valid = parseAssessmentOutput(JSON.stringify(assessment), study, citation, randomUUID(), 'en')!;
  expect(valid).not.toBeNull();
  const rationale = 'The observed correlation was r = +0.42.';
  expect(parseAssessmentOutput(JSON.stringify({ ...assessment, rationale }), study, citation, randomUUID(), 'en')).toBeNull();
  expect(readGroundedWritingAnalysis({ ...valid, rationale }, study, citation)).toBeNull();
});
test('flags an assessment that disagrees with the relation the researcher kept, in the export and for the panel', () => {
  const draft = extractionIntoDraft({ text: '', citations: [] }, parseExtractionOutput(extraction(), source, 'ar')!, 'sample')!;
  const supported = { ...draft, citations: draft.citations.map(c => ({ ...c, relation: 'supports' as const })) };
  const c = supported.citations[0];
  const record = parseAssessmentOutput(JSON.stringify({ relation: 'contradicts', rationale: 'The passage reports the opposite.', limitation: 'Abstract only.', quote: c.quoteText }), source, c, randomUUID(), 'ar')!;
  expect(relationMismatch(supported, record)).toEqual({ researcher: 'supports', suggested: 'contradicts' });
  const [section] = analysisExportSections([record], 'ar', supported);
  expect(section.paragraphs[0]).toBe('تنبيه: العلاقة التي حددتها «يدعم»، والعلاقة المقترحة في التقييم «يعارض». راجع الإحالة قبل التسليم.');
  const [english] = analysisExportSections([record], 'en', supported);
  expect(english.paragraphs[0]).toBe('Warning: the relation you set is “Supports”; the assessment suggests “Contradicts”. Review this citation before submission.');

  const agreed = { ...supported, citations: supported.citations.map(x => ({ ...x, relation: 'contradicts' as const })) };
  expect(relationMismatch(agreed, record)).toBeNull();
  expect(analysisExportSections([record], 'ar', agreed)[0].paragraphs[0]).toBe(record.claimText);
  expect(analysisExportSections([record], 'ar')[0].paragraphs[0]).toBe(record.claimText);
});
