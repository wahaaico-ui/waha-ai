jest.mock('@/lib/supabase/client', () => ({ supabase: { auth: { updateUser: jest.fn() } } }));

import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import CareerWorkspace, { CareerView } from './CareerWorkspace';
import type { Career } from '@/lib/scholarly-career';

const empty: Career = { orcid: '0000-0003-1613-5981', author: null, timeline: [], citations: [], directions: [], checkedAt: '2026-11-12T10:00:00.000Z', source: 'openalex' };

test('an empty career says what is missing in every section', () => {
  const html = renderToStaticMarkup(<CareerView career={empty} />);
  expect(html).toContain('لم يُعثر على ملف باحث بهذا المعرّف في OpenAlex.');
  expect(html).toContain('لا توجد استشهادات مسجلة لأعمالك بعد.');
  expect(html).toContain('لا تكفي الاستشهادات الحالية لاقتراح اتجاه.');
  expect(html).toContain('لا توجد أعمال مرتبطة بهذا المعرّف في OpenAlex.');
});

test('a tracked work shows its citations by year, journal and country, with contexts unavailable', () => {
  const html = renderToStaticMarkup(<CareerView career={{
    ...empty,
    author: { name: 'Heather Piwowar', works: 71, citations: 4000, hIndex: 20 },
    citations: [{ workId: 'W1', title: 'The state of OA', citations: 1510, byYear: [{ year: 2025, count: 188 }], journals: [{ name: 'Scientometrics', count: 63 }], countries: [{ name: 'United States', count: 328 }], contexts: null }],
    directions: [{ topicId: 'T9', topic: 'Library Science', citingWorks: 107, fromWorks: [{ id: 'W1', title: 'The state of OA' }] }],
    timeline: [{ id: 'W1', title: 'The state of OA', year: 2018, doi: 'https://doi.org/10.7717/peerj.4375', venue: 'PeerJ', citations: 1510, topic: null }],
  }} />);
  expect(html).toContain('Heather Piwowar');
  expect(html).toContain('2025: 188');
  expect(html).toContain('Scientometrics (63)');
  expect(html).toContain('United States (328)');
  expect(html).toContain('غير متاحة؛ لا تنشرها OpenAlex');
  expect(html).toContain('href="https://doi.org/10.7717/peerj.4375"');
});

test('the workspace starts by loading and offers the ORCID field', () => {
  const html = renderToStaticMarkup(<CareerWorkspace />);
  expect(html).toContain('id="career-orcid"');
  expect(html).toContain('جارٍ قراءة أعمالك من OpenAlex…');
});

test('the iD is saved in the account and the page is linked from the profile', () => {
  const source = readFileSync(join(process.cwd(), 'src/components/CareerWorkspace.tsx'), 'utf8');
  expect(source).toContain('supabase.auth.updateUser({ data: { orcid } })');
  expect(readFileSync(join(process.cwd(), 'src/app/dashboard/profile/page.tsx'), 'utf8')).toContain('href="/dashboard/career"');
});
