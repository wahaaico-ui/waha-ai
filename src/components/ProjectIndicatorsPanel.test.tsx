import { renderToStaticMarkup } from 'react-dom/server';
import { JOURNAL_PRESETS } from '@/lib/journal-template';
import { guideIndicator, publicationIndicator, timeIndicator } from '@/lib/project-indicators';

let mockLanguage: 'ar' | 'en' = 'ar';
jest.mock('@/lib/use-ui-translation', () => {
  const { translateUiText } = jest.requireActual('@/lib/i18n/ui-text');
  return { useUiTranslation: () => ({ language: mockLanguage, text: (message: string, values?: readonly unknown[]) => translateUiText(message, mockLanguage, values) }) };
});

import { ProjectIndicatorsView } from './ProjectIndicatorsPanel';

const now = new Date('2026-11-11T12:00:00.000Z');
const indicators = [
  guideIndicator({ guide: null, draft: null, abstractText: null }),
  timeIndicator({ time: 'short', completed: 3, total: 17, startedAt: new Date(now.getTime() - 90 * 86_400_000).toISOString(), now }),
  publicationIndicator({ template: { ...JOURNAL_PRESETS.imrad, sections: ['introduction'] }, outputs: { problem: { problemStatement: 'نص قصير للمشكلة' } }, referenceCount: 4 }),
];
const card = (html: string, label: string) => html.slice(html.indexOf(`aria-label="${label}"`), html.indexOf('</article>', html.indexOf(`aria-label="${label}"`)));

afterEach(() => { mockLanguage = 'ar'; });

test('without a guide the indicator says not assessed and shows no number (DOC-38-01)', () => {
  const html = renderToStaticMarkup(<ProjectIndicatorsView indicators={indicators} />);
  const guide = card(html, 'الالتزام بدليل الجامعة');
  expect(guide).toContain('غير مُقيَّم');
  expect(guide).toContain('لا توجد قواعد معتمدة من دليل الجامعة');
  // Only the visible text counts: style classes such as p-5 contain digits.
  expect(guide.slice(guide.indexOf('>') + 1).replace(/<[^>]*>/g, ' ')).not.toMatch(/\d/);
  expect(card(html, 'الوقت')).toContain('يحتاج متابعة');
  expect(card(html, 'الوقت')).toContain('هذا يتجاوز الوقت المتاح لك: أقل من ستة أشهر');
});

test('the English page translates every indicator line', () => {
  mockLanguage = 'en';
  const html = renderToStaticMarkup(<ProjectIndicatorsView indicators={indicators} />);
  expect(html).toContain('Not assessed');
  expect(html).toContain('This exceeds your available time: Under six months; narrow the scope or choose a shorter path.');
  expect(html).not.toMatch(/\p{Script=Arabic}/u);
});
