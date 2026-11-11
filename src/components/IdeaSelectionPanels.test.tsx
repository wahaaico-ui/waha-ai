import { renderToStaticMarkup } from 'react-dom/server';
import { narrowingSuggestion, rankPathsByConstraints } from '@/lib/idea-selection/path-fit';
import type { Constraints } from '@/lib/idea-selection/questions';

let mockLanguage: 'ar' | 'en' = 'ar';
jest.mock('@/lib/use-ui-translation', () => {
  const { translateUiText } = jest.requireActual('@/lib/i18n/ui-text');
  return { useUiTranslation: () => ({ language: mockLanguage, text: (message: string, values?: readonly unknown[]) => translateUiText(message, mockLanguage, values) }) };
});

import { NarrowingSummary, PathOrder } from './IdeaSelectionPanels';

const paths = [
  { id: 'geographic-comparison', title: 'Blended learning: a comparison between two countries' },
  { id: 'recent-evidence', title: 'Blended learning: the last five years of evidence' },
];
const titles = paths.map(path => path.title);
const page = (constraints: Constraints) => renderToStaticMarkup(<PathOrder ranked={rankPathsByConstraints(paths, constraints)} answered />);
const withoutTitles = (html: string) => titles.reduce((text, title) => text.replaceAll(title, ''), html);

afterEach(() => { mockLanguage = 'ar'; });

test.each(['ar', 'en'] as const)('changing the time answer reorders the paths on the page and shows why (DOC-23-03), in %s', language => {
  mockLanguage = language;
  const long = page({ time: 'long' });
  const short = page({ time: 'short' });
  expect(long.indexOf(titles[0])).toBeLessThan(long.indexOf(titles[1]));
  expect(short.indexOf(titles[1])).toBeLessThan(short.indexOf(titles[0]));
  expect(short).toContain(language === 'ar'
    ? 'يحتاج عادةً أكثر من سنة، والوقت المتاح لك أقل من ستة أشهر.'
    : 'Usually needs: Over a year. Your time: Under six months.');
  if (language === 'en') expect(withoutTitles(short)).not.toMatch(/\p{Script=Arabic}/u);
});

test('before any quick answer the page asks for them instead of showing an order', () => {
  const html = renderToStaticMarkup(<PathOrder ranked={rankPathsByConstraints(paths, {})} answered={false} />);
  expect(html).toContain('أجب عن أسئلة الوصول والبيانات والوقت ليُرتَّب كل مسار بحسب قيودك.');
  expect(html).not.toContain('<ol');
});

test.each(['ar', 'en'] as const)('the five answers and the profile appear in the initial narrowing (DOC-23-04), in %s', language => {
  mockLanguage = language;
  const narrowing = narrowingSuggestion({
    answers: { interest: 'interactive apps', problem: 'weak grasp of abstract concepts', access: 'I teach there', data: 'none published', time: 'one term' },
    constraints: { access: 'yes', data: 'no', time: 'short' },
    countryName: 'Palestine', specialty: 'Mathematics education',
  });
  const html = renderToStaticMarkup(<NarrowingSummary lines={narrowing.lines} advice={narrowing.advice} />);
  for (const text of ['weak grasp of abstract concepts', 'interactive apps', 'Palestine', 'Mathematics education', 'I teach there', 'none published', 'one term']) expect(html).toContain(text);
  expect(html).toContain(language === 'ar' ? 'ابدأ بمسار يعتمد على الدراسات المنشورة' : 'Start with a path that relies on published studies');
  if (language === 'en') expect(html).not.toMatch(/\p{Script=Arabic}/u);
});
