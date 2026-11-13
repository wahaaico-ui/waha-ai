jest.mock('@/components/SiteHeader', () => ({ __esModule: true, default: () => null }));

import { renderToStaticMarkup } from 'react-dom/server';
import WritingStyleWorkspace, { StyleMeasures } from './WritingStyleWorkspace';
import type { StyleProfile } from '@/lib/writing-style';

const profile: StyleProfile = { sample: { words: 210 }, sentences: { count: 12, averageWords: 17.5, longShare: 0.08 }, paragraphs: { count: 4, averageSentences: 3 }, vocabulary: { diversity: 0.64 }, terms: ['التعليم الإلكتروني'], citations: { format: 'author-year', perHundredWords: 1.4 }, voice: 'third', sentenceLength: 'medium' };

test('the measures are shown in plain words before approval', () => {
  const html = renderToStaticMarkup(<StyleMeasures profile={profile} />);
  expect(html).toContain('17.5 كلمة في المتوسط (متوسطة)، و8٪ من الجمل تتجاوز 30 كلمة');
  expect(html).toContain('64٪ من الكلمات غير مكررة');
  expect(html).toContain('المؤلف والسنة بين قوسين، بمعدل 1.4 لكل 100 كلمة');
  expect(html).toContain('الغائب (الباحث، الدراسة)');
});

test('the page states that the sample itself is not kept', () => {
  expect(renderToStaticMarkup(<WritingStyleWorkspace />)).toContain('لا نحفظ العينة نفسها.');
});
