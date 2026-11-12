const requireAuthenticatedUser = jest.fn();
const loadCareer = jest.fn();
const buildProjectPdf = jest.fn();
const buildProjectDocx = jest.fn();

jest.mock('@/lib/supabase/authorization', () => ({ requireAuthenticatedUser: (...args: unknown[]) => requireAuthenticatedUser(...args) }));
jest.mock('@/lib/scholarly-career', () => ({ ...jest.requireActual('@/lib/scholarly-career'), loadCareer: (...args: unknown[]) => loadCareer(...args) }));
jest.mock('@/lib/project-document-export', () => ({
  buildProjectPdf: (...args: unknown[]) => buildProjectPdf(...args),
  buildProjectDocx: (...args: unknown[]) => buildProjectDocx(...args),
}));

import { GET, POST } from './route';
import type { Career } from '@/lib/scholarly-career';

const career: Career = {
  orcid: '0000-0003-1613-5981', author: { name: 'Heather Piwowar', works: 71, citations: 4000, hIndex: 20 },
  timeline: [], citations: [], directions: [], checkedAt: '2026-11-12T10:00:00.000Z', source: 'openalex',
};
const signedIn = (orcid?: string) => requireAuthenticatedUser.mockResolvedValue({ user: { id: 'user-1', user_metadata: orcid ? { orcid } : {} }, supabase: {} });
const post = (body: unknown) => POST(new Request('https://waha.systems/api/career', { method: 'POST', body: JSON.stringify(body) }));

beforeEach(() => jest.clearAllMocks());

describe('career route (DOC-30-01..03)', () => {
  test('a signed-out visitor gets nothing', async () => {
    requireAuthenticatedUser.mockResolvedValue(null);
    expect((await GET()).status).toBe(401);
    expect((await post({ format: 'pdf' })).status).toBe(401);
    expect(loadCareer).not.toHaveBeenCalled();
  });

  test('without a saved ORCID iD there is no career and no OpenAlex call', async () => {
    signedIn();
    const response = await GET();
    expect(await response.json()).toEqual({ orcid: null, career: null });
    expect(loadCareer).not.toHaveBeenCalled();
  });

  test('reads only the iD saved in the signed-in account', async () => {
    signedIn('https://orcid.org/0000-0003-1613-5981');
    loadCareer.mockResolvedValue(career);
    const response = await GET();
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(await response.json()).toEqual({ orcid: '0000-0003-1613-5981', career });
    expect(loadCareer).toHaveBeenCalledWith('0000-0003-1613-5981');
  });

  test('an OpenAlex failure is a clear 503, never a partial career', async () => {
    signedIn('0000-0003-1613-5981');
    loadCareer.mockRejectedValue(new Error('429'));
    const response = await GET();
    expect(response.status).toBe(503);
    expect((await response.json()).career).toBeUndefined();
  });

  test('export needs a known format and a saved iD', async () => {
    signedIn('0000-0003-1613-5981');
    expect((await post({ format: 'exe' })).status).toBe(400);
    signedIn();
    expect((await post({ format: 'pdf' })).status).toBe(409);
    expect(buildProjectPdf).not.toHaveBeenCalled();
  });

  test('exports the career as a file built from the same data', async () => {
    signedIn('0000-0003-1613-5981');
    loadCareer.mockResolvedValue(career);
    buildProjectDocx.mockResolvedValue(Buffer.from('docx'));
    const response = await post({ format: 'docx', language: 'en' });
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Disposition')).toBe('attachment; filename="waha-career.docx"');
    expect(buildProjectDocx.mock.calls[0][0]).toMatchObject({ language: 'en', title: 'Research career' });
  });
});
