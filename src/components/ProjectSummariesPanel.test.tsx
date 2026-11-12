import { renderToStaticMarkup } from 'react-dom/server';
import { SummaryCard } from './ProjectSummariesPanel';
import { decisionSummary, journalSummary } from '@/lib/project-summaries';

test('a summary without data shows only what is missing, and no export buttons', () => {
  const html = renderToStaticMarkup(<SummaryCard projectId="p" summary={decisionSummary({})} />);
  expect(html).toContain('ملخص لصانع القرار');
  expect(html).toContain('ما ينقص هذا الملخص');
  expect(html).toContain('لا يُسلَّم ملخص القرار دونها');
  expect(html).not.toContain('DOCX');
});

test('a decision summary with findings but no limits is not offered as a file', () => {
  const html = renderToStaticMarkup(<SummaryCard projectId="p" summary={decisionSummary({ results: { overallSummary: 'نتيجة' } })} />);
  expect(html).toContain('نتيجة');
  expect(html).not.toContain('DOCX');
});

test('a journal summary shows its headings, its template checks and the export buttons', () => {
  const html = renderToStaticMarkup(<SummaryCard projectId="p" summary={journalSummary({ publication: {
    approvedTitle: 'عنوان', targetName: 'BMC Nursing', keywords: ['أ', 'ب', 'ج'],
    structuredAbstract: { background: 'خلفية', objective: 'هدف', methods: 'منهج', results: 'نتائج', conclusion: 'خاتمة' },
  } }, { preset: 'imrad', sections: [], wordLimit: null, abstractMaxWords: 2, keywordsMin: 3, keywordsMax: 6, referenceLimit: null })} />);
  expect(html).toContain('الخلفية');
  expect(html).toContain('المجلة المستهدفة: BMC Nursing');
  expect(html).toContain('الملخص 5 كلمات، وحد المجلة 2 كلمة.');
  expect(html).toContain('DOCX');
});
