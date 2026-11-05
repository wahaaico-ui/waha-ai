jest.mock('@/lib/supabase/authorization', () => ({ requireAuthenticatedUser: jest.fn(), ownsProject: jest.fn() }));
jest.mock('@/lib/billing/entitlements', () => ({ hasEntitlement: jest.fn() }));
jest.mock('@/lib/ai/geminiClient', () => ({ generateStructured: jest.fn() }));
jest.mock('@/lib/supabase/service', () => ({ createServiceClient: jest.fn() }));
jest.mock('@/lib/language/DeepLService', () => ({ DeepLService: { configured: jest.fn(() => false) } }));
jest.mock('@/lib/language/MicrosoftTranslatorService', () => ({ MicrosoftTranslatorService: { configured: jest.fn(() => false) } }));
jest.mock('@/lib/language/LanguageToolService', () => ({ LanguageToolService: { configured: jest.fn(() => false) } }));

import { requireAuthenticatedUser, ownsProject } from '@/lib/supabase/authorization';
import { hasEntitlement } from '@/lib/billing/entitlements';
import { generateStructured } from '@/lib/ai/geminiClient';
import { createServiceClient } from '@/lib/supabase/service';
import { POST } from './route';

const auth = requireAuthenticatedUser as jest.Mock;
const owns = ownsProject as jest.Mock;
const entitlement = hasEntitlement as jest.Mock;
const ai = generateStructured as jest.Mock;
const service = createServiceClient as jest.Mock;
const input = 'On unconditional CIFAR10, the Inception Score is 9.46 and FID is 3.17.';
const badOutput = 'على مجموعة CIFAR10 غير المشروطة، درجة الانبثاق هي 9.46 و FID هو 3.17.';
const goodOutput = 'على مجموعة CIFAR10 غير المشروطة، قيمة Inception Score هي 9.46 و FID هي 3.17.';
const projectId = 'd37aeadc-2ae5-47be-a02d-0fd5558d376c';
const request = (overrides: Record<string, unknown> = {}) => new Request('http://localhost/api/academic/language-tools', {
  method: 'POST',
  body: JSON.stringify({ operation: 'translate', text: input, targetLanguage: 'ar', ...overrides }),
});

beforeEach(() => {
  jest.clearAllMocks();
  auth.mockResolvedValue({ user: { id: 'synthetic-user' }, supabase: { from: jest.fn() } });
  owns.mockResolvedValue(true);
  entitlement.mockResolvedValue(true);
  ai.mockResolvedValue({ output: JSON.stringify({ text: goodOutput }) });
});

test('blocks unauthenticated and unentitled requests before provider use', async () => {
  auth.mockResolvedValueOnce(null);
  expect((await POST(request())).status).toBe(401);
  entitlement.mockResolvedValueOnce(false);
  expect((await POST(request())).status).toBe(402);
  expect(ai).not.toHaveBeenCalled();
});

test('the observed false translation returns an actionable rejection and never reports success', async () => {
  ai.mockResolvedValue({ output: JSON.stringify({ text: badOutput }) });
  const response = await POST(request());
  expect(response.status).toBe(422);
  expect(await response.json()).toMatchObject({ code: 'METRIC_NAME_CHANGED' });
  expect(service).not.toHaveBeenCalled();
  expect(ai.mock.calls[0][0].prompt).toContain('Inception Score, FID');
});

test('a translation preserving the original metric names remains usable', async () => {
  const response = await POST(request());
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ output: goodOutput });
  expect(service).not.toHaveBeenCalled();
});

test('a completed but defective project translation is not returned from cache', async () => {
  const maybeSingle = jest.fn().mockResolvedValue({ data: { content: JSON.stringify({
    operation: 'translate', targetLanguage: 'ar', text: input, output: badOutput, status: 'completed',
  }) }, error: null });
  const query = { select: jest.fn(), eq: jest.fn(), maybeSingle };
  query.select.mockReturnValue(query); query.eq.mockReturnValue(query);
  auth.mockResolvedValue({ user: { id: 'synthetic-user' }, supabase: { from: jest.fn(() => query) } });
  const response = await POST(request({ projectId }));
  expect(response.status).toBe(422);
  expect(await response.json()).toMatchObject({ code: 'METRIC_NAME_CHANGED' });
  expect(owns).toHaveBeenCalled();
  expect(ai).not.toHaveBeenCalled();
  expect(service).not.toHaveBeenCalled();
});
