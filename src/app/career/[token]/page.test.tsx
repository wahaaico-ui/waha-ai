const rpc = jest.fn();
const loadCareer = jest.fn();
jest.mock('@/lib/supabase/server', () => ({ createClient: async () => ({ rpc: (...args: unknown[]) => rpc(...args) }) }));
jest.mock('@/lib/scholarly-career', () => ({ ...jest.requireActual('@/lib/scholarly-career'), loadCareer: (...args: unknown[]) => loadCareer(...args) }));
jest.mock('@/lib/supabase/client', () => ({ supabase: {} }));
jest.mock('next/navigation', () => ({ notFound: () => { throw new Error('NOT_FOUND'); } }));

import { renderToStaticMarkup } from 'react-dom/server';
import SharedCareerPage from './page';

const token = 'A'.repeat(32);
const career = {
  orcid: '0000-0003-1613-5981', author: { name: 'Heather Piwowar', works: 71, citations: 4120, hIndex: 22 }, checkedAt: '2026-11-12T10:00:00.000Z', source: 'openalex',
  timeline: [{ id: 'W1', title: 'The state of OA', year: 2018, doi: null, venue: 'PeerJ', citations: 1510, topic: null }], citations: [], directions: [],
};
const open = (value: string) => SharedCareerPage({ params: Promise.resolve({ token: value }) });

beforeEach(() => jest.clearAllMocks());

test('a malformed token is not found without touching the database', async () => {
  await expect(open('../x')).rejects.toThrow('NOT_FOUND');
  expect(rpc).not.toHaveBeenCalled();
});

test('a revoked or unknown link is not found and reveals nothing', async () => {
  rpc.mockResolvedValue({ data: [], error: null });
  await expect(open(token)).rejects.toThrow('NOT_FOUND');
  expect(loadCareer).not.toHaveBeenCalled();
});

test('an active link shows only the sections its owner chose', async () => {
  rpc.mockResolvedValue({ data: [{ orcid: '0000-0003-1613-5981', sections: ['timeline', 'citations'], created_at: '2026-11-12T10:00:00.000Z' }], error: null });
  loadCareer.mockResolvedValue(career);
  const html = renderToStaticMarkup(await open(token));
  expect(rpc).toHaveBeenCalledWith('shared_career', { p_token: token });
  expect(html).toContain('Heather Piwowar');
  expect(html).toContain('الأعمال المنشورة');
  expect(html).toContain('لا توجد استشهادات مسجلة لأعمال الباحث بعد.');
  expect(html).not.toContain('اتجاهات تالية مقترحة');
  expect(html).not.toContain('أعمالك');
});

test('the page is never indexed', async () => {
  const { metadata } = await import('./page');
  expect(metadata.robots).toEqual({ index: false, follow: false });
});
