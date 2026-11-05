/** Actual public index data; checks processing and export, not scientific validity or AI quality. */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildSynthesisPacket } from '@/lib/synthesis-packet';
import { buildProjectExportModel } from '@/lib/project-export';
import { CITATION_STYLES } from '@/lib/citations/types';

type Source = { id: string; title: string; abstract: string; authors: string; year: number; doi: string; source: string; journal: string | null; publicationType: string; url: string };
const path = join(process.cwd(), 'output/qa/real-source-inputs.json');
const dataset: { checkedAt: string; query: string; selected: Source[] } = JSON.parse(readFileSync(path, 'utf8'));

test.each([20, 50])('%i actual public references survive context allocation and all six export styles', (count) => {
  const papers = dataset.selected.slice(0, count);
  expect(papers).toHaveLength(count);
  expect(new Set(papers.map((paper) => paper.id)).size).toBe(count);
  expect(new Set(papers.map((paper) => paper.doi.toLowerCase())).size).toBe(count);
  const packet = buildSynthesisPacket(papers);
  expect(packet.ok).toBe(true);
  if (!packet.ok) throw new Error(packet.error);
  expect(packet.papers.map((paper) => paper.id)).toEqual(papers.map((paper) => paper.id));
  for (const paper of packet.papers) {
    expect(paper.abstract.length).toBeGreaterThanOrEqual(200);
    expect(papers.find((input) => input.id === paper.id)?.abstract.startsWith(paper.abstract)).toBe(true);
  }
  const references = papers.map((paper) => ({ title: paper.title, authors: paper.authors.split(', '), publication_year: paper.year, publication_title: paper.journal, doi: paper.doi, url: paper.url, citation_data: { type: paper.publicationType } }));
  for (const style of CITATION_STYLES) {
    const model = buildProjectExportModel({ title: dataset.query, university_policy: null }, [], [], references, style, 'en');
    expect(model.sections.filter((section) => /^Reference \d+$/.test(section.title))).toHaveLength(count);
    const bibliography = model.sections.find((section) => section.title === `Bibliography — ${style}`)!;
    expect(bibliography.paragraphs).toHaveLength(count + 1);
    for (const paper of papers) expect(bibliography.paragraphs.some((entry) => entry.includes(paper.doi.replace('https://doi.org/', '')))).toBe(true);
    expect(bibliography.paragraphs.join('\n')).not.toMatch(/doi\.org\/https?:/);
  }
});

test('QA records distinguish heterogeneous indexed records from independent reviewed studies', () => {
  const normalize = (value: string) => value.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
  const groups = new Map<string, Source[]>();
  for (const paper of dataset.selected) { const key = normalize(paper.title); groups.set(key, [...(groups.get(key) || []), paper]); }
  const report = {
    checkedAt: new Date().toISOString(), query: dataset.query, actualReferences: dataset.selected.length,
    distinctJournals: new Set(dataset.selected.map((paper) => paper.journal).filter(Boolean)).size,
    publicationTypes: Object.fromEntries([...new Set(dataset.selected.map((paper) => paper.publicationType))].map((type) => [type, dataset.selected.filter((paper) => paper.publicationType === type).length])),
    possibleReprints: [...groups.values()].filter((group) => group.length > 1).map((group) => group.map(({ id, title, doi }) => ({ id, title, doi }))),
    paidAiCalls: 0, fullTextsRead: 0, scientificQualityValidated: false,
    checks: ['20 and 50 sources retained without dropping selected IDs', 'Source excerpts remain prefixes of the actual supplied abstracts', '50 references exported under all six citation styles'],
    warning: 'Different identifiers and record counts do not establish independent studies, peer review, or a research gap. Review source type, possible reprints, full texts and topic relevance.',
  };
  writeFileSync(join(process.cwd(), 'output/qa/real-source-workflow.json'), JSON.stringify(report, null, 2) + '\n');
  expect(report.publicationTypes.article).toBeGreaterThan(0);
});

test('English PDF and editable Word export actual 50-reference metadata', async () => {
  const { buildProjectPdf, buildProjectDocx } = await import('@/lib/project-document-export');
  const { execFileSync } = await import('node:child_process');
  const { mkdtempSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const references = dataset.selected.map((paper) => ({ title: paper.title, authors: paper.authors.split(', '), publication_year: paper.year, publication_title: paper.journal, doi: paper.doi, url: paper.url, citation_data: { type: paper.publicationType } }));
  const model = buildProjectExportModel({ title: 'Actual public reference data - QA export', university_policy: 'Quality assurance sample. These indexed records have not been validated as independent peer-reviewed studies.' }, [], [], references, 'apa-7', 'en');
  const pdf = await buildProjectPdf(model); const docx = await buildProjectDocx(model);
  expect(pdf.subarray(0, 4).toString()).toBe('%PDF');
  const folder = mkdtempSync(join(tmpdir(), 'waha-real-export-')); const wordPath = join(folder, 'references.docx'); writeFileSync(wordPath, docx);
  const xml = execFileSync('unzip', ['-p', wordPath, 'word/document.xml'], { encoding: 'utf8' });
  expect(xml).toContain('University guidelines'); expect(xml).not.toContain('تعليمات الجامعة');
  for (const paper of dataset.selected) expect(xml).toContain(paper.doi);
  if (process.env.WAHA_QA_ARTIFACT_DIR) {
    writeFileSync(join(process.env.WAHA_QA_ARTIFACT_DIR, 'actual-50-reference-export.pdf'), pdf);
    writeFileSync(join(process.env.WAHA_QA_ARTIFACT_DIR, 'actual-50-reference-export.docx'), docx);
  }
}, 30_000);
