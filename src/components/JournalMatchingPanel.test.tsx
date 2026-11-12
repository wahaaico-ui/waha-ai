import { renderToStaticMarkup } from 'react-dom/server';
import type { JournalMatch } from '@/lib/journal-matching';

let mockLanguage: 'ar' | 'en' = 'ar';
jest.mock('@/lib/use-ui-translation', () => {
  const { translateUiText } = jest.requireActual('@/lib/i18n/ui-text');
  return { useUiTranslation: () => ({ language: mockLanguage, text: (message: string, values?: readonly unknown[]) => translateUiText(message, mockLanguage, values) }) };
});

import { JournalAnglesView, JournalCard } from './JournalMatchingPanel';

const journal: JournalMatch = { id: 'S1', name: 'Clinical Simulation in Nursing', publisher: 'Elsevier BV', issn: '1876-1399', topicWorks: 53, openAccess: false, inDoaj: false, apcUsd: 3210, hIndex: 95, homepage: 'https://example.org', acceptanceRate: null };
const card = () => renderToStaticMarkup(<JournalCard journal={journal} years={[2021, 2025]} onPlan={() => undefined} planning={false} />);
afterEach(() => { mockLanguage = 'ar'; });

test('a journal without a published acceptance rate shows it as not available (DOC-29-02)', () => {
  const html = card();
  expect(html).toContain('غير متاحة؛ لا تنشرها OpenAlex');
  expect(html).not.toMatch(/نسبة القبول: <\/dt><dd[^>]*>\d/);
  expect(html).toContain('53');
});

test('three angles name the journal topics, their counts and the data date (DOC-29-03)', () => {
  const angles = { journalId: 'S1', years: [2023, 2025] as [number, number], checkedAt: '2026-11-12T10:00:00.000Z', source: 'openalex' as const, angles: [
    { topicId: 'T1', topic: 'Simulation-Based Education in Healthcare', journalWorks: 400, example: { title: 'Debriefing study', year: 2025, doi: 'https://doi.org/10.1/a' } },
    { topicId: 'T2', topic: 'Interprofessional Education and Collaboration', journalWorks: 12, example: null },
    { topicId: 'T3', topic: 'Empathy and Medical Education', journalWorks: 6, example: null },
  ] };
  const html = renderToStaticMarkup(<JournalAnglesView journal="Clinical Simulation in Nursing" angles={angles} topic="المحاكاة في تعليم التمريض" />);
  for (const angle of angles.angles) expect(html).toContain(angle.topic);
  expect(html).toContain('2026-11-12');
  expect(html).toContain('نشرت المجلة 400 دراسة في هذا الموضوع.');
});

test('the English card has no untranslated label', () => {
  mockLanguage = 'en';
  const html = card();
  expect(html).toContain('Not available; OpenAlex does not publish it');
  expect(html).not.toMatch(/\p{Script=Arabic}/u);
});
