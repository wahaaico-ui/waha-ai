import { renderToStaticMarkup } from 'react-dom/server';
import { evaluateConsistencyMap } from '@/lib/research-objects/consistency-map';
import type { JourneyDocumentSnapshot } from '@/lib/research-objects/types';

let mockLanguage: 'ar' | 'en' = 'ar';
jest.mock('@/lib/use-ui-translation', () => {
  const { translateUiText } = jest.requireActual('@/lib/i18n/ui-text');
  return { useUiTranslation: () => ({ language: mockLanguage, direction: mockLanguage === 'ar' ? 'rtl' : 'ltr', text: (message: string, values?: readonly unknown[]) => translateUiText(message, mockLanguage, values) }) };
});
jest.mock('@/components/SiteHeader', () => ({ __esModule: true, default: () => null }));

import { ConsistencyMapView } from './ConsistencyMapWorkspace';

const projectId = 'project-map-view';
const base = { project_id: projectId, version: 1, created_at: '2026-11-11T12:00:00.000Z' };
const statements = {
  problem: 'يعاني طلبة التمريض في الجامعات المحلية من ضعف التحصيل الأكاديمي عند استخدام منصات التعلم الإلكتروني.',
  objectives: ['قياس أثر منصات التعلم الإلكتروني على التحصيل الأكاديمي لدى طلبة التمريض.', 'تحليل أسعار الطاقة المتجددة وأثرها في الصادرات الزراعية الأوروبية.'],
  questions: ['ما أثر منصات التعلم الإلكتروني على التحصيل الأكاديمي لدى طلبة التمريض؟', 'ما أثر أسعار الطاقة المتجددة في الصادرات الزراعية الأوروبية؟'],
  hypotheses: ['توجد علاقة ذات دلالة إحصائية بين استخدام منصات التعلم الإلكتروني والتحصيل الأكاديمي لدى طلبة التمريض.', 'يوجد أثر دال إحصائيًا لأسعار الطاقة المتجددة في الصادرات الزراعية الأوروبية.'],
};
const documents: JourneyDocumentSnapshot[] = [
  { ...base, id: 'problem-v1', type: 'journey:problem', content: { problemStatement: statements.problem, researchGap: 'فجوة محلية.' } },
  { ...base, id: 'objectives-v1', type: 'journey:objectives', content: { objectives: statements.objectives } },
  { ...base, id: 'questions-v1', type: 'journey:questions', content: { questions: statements.questions } },
  { ...base, id: 'hypotheses-v1', type: 'journey:hypotheses', content: { mode: 'required', hypotheses: statements.hypotheses, rationale: '' } },
  { ...base, id: 'methodology-v1', type: 'journey:methodology', content: { approach: 'quantitative', population: 'طلبة التمريض في الجامعات المحلية.', sample: 'عينة طبقية عشوائية يحدد حجمها بتحليل القدرة الإحصائية.', instrument: 'استبانة محكمة ومقياس للتحصيل.' } },
];
const map = evaluateConsistencyMap(projectId, documents, { checkedAt: '2026-11-11T12:00:00.000Z' });
const unrelated = map.chains[1].objective!;
const render = (selected: string | null) => renderToStaticMarkup(<ConsistencyMapView map={map} selected={selected} onSelect={() => undefined} />);
/** Research text stays as the researcher wrote it; only interface text is translated. */
const withoutResearchText = (html: string) => [statements.problem, ...statements.objectives, ...statements.questions, ...statements.hypotheses, map.methodology!.statement]
  .reduce((text, statement) => text.replaceAll(statement, ''), html)
  // Suggested actions quote the problem's own concepts, which stay as written.
  .replace(/concepts: [^<]*\./g, 'concepts: .');
const count = (html: string, text: string) => html.split(text).length - 1;

afterEach(() => { mockLanguage = 'ar'; });

test.each(['ar', 'en'] as const)('choosing an objective that conflicts with the problem highlights every relationship it affects (DOC-26-01), in %s', language => {
  mockLanguage = language;
  const html = render(unrelated.id);
  expect(count(html, language === 'ar' ? 'متأثرة بما اخترته' : 'Affected by your choice')).toBe(map.affected[unrelated.id].length);
  expect(html).toContain(language === 'ar' ? 'لا يظهر ارتباط مفاهيمي مباشر بين الهدف ومشكلة البحث.' : 'The objective shows no direct conceptual link to the research problem.');
  expect(html).toContain(language === 'ar' ? 'يستحق المراجعة' : 'Needs review');
  expect(html).toContain('aria-pressed="true"');
  if (language === 'en') expect(withoutResearchText(html)).not.toMatch(/\p{Script=Arabic}/u);
});

test('before a choice nothing is marked as affected, and no score is shown', () => {
  const html = render(null);
  expect(html).not.toContain('متأثرة بما اخترته');
  expect(html).not.toMatch(/\/100|\d+%/);
  for (const label of ['سليمة', 'مشكلة البحث', 'الهدف 2', 'السؤال 2', 'الفرضية 2', 'المنهج']) expect(html).toContain(label);
});
