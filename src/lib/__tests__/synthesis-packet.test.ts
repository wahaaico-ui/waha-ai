jest.mock('@/lib/supabase/authorization', () => ({ requireAuthenticatedUser: jest.fn(), ownsProject: jest.fn() }));
jest.mock('@/lib/ai/geminiClient', () => ({ generateStructured: jest.fn() }));
jest.mock('@/lib/research-search-results', () => ({ resolveLibrarySelection: jest.fn() }));
import { buildSynthesisPacket, SYNTHESIS_CHARACTER_BUDGET } from '@/lib/synthesis-packet';
import { POST } from '@/app/api/research/analysis/route';
import { requireAuthenticatedUser, ownsProject } from '@/lib/supabase/authorization';
import { generateStructured } from '@/lib/ai/geminiClient';
import { resolveLibrarySelection } from '@/lib/research-search-results';
import { createTableFake } from '@/lib/test-support/table-fake';
import { normaliseResearchAnalysis } from '@/lib/research-analysis';
const papers = Array.from({ length: 50 }, (_, index) => ({ id: `study-${index}`, referenceId: `ref-${index}`, title: `Declared source ${index}`, authors: 'Test researcher', year: 2025, source: 'fixture', abstract: 'Declared fixture abstract. '.repeat(200) }));

test('retains 20–50 and 120 selected papers inside a shared context budget, never silently dropping the tail', () => {
  for (const count of [20, 50, 120]) {
    const selected = Array.from({ length: count }, (_, index) => ({ ...papers[0], id: `study-${index}` }));
    const packet = buildSynthesisPacket(selected);
    expect(packet.ok).toBe(true); if (!packet.ok) return;
    expect(packet.papers).toHaveLength(count); expect(packet.papers.at(-1)?.id).toBe(`study-${count - 1}`);
    expect(packet.characters).toBeLessThanOrEqual(SYNTHESIS_CHARACTER_BUDGET); expect(packet.papers.every((paper) => paper.abstract.length >= 200)).toBe(true);
  }
});
test('an oversized context asks for thematic groups instead of pretending to analyze selected studies', () => {
  const packet = buildSynthesisPacket(Array.from({ length: 1000 }, (_, index) => ({ ...papers[0], id: `study-${index}`, title: 'Very long metadata '.repeat(25) })));
  expect(packet.ok).toBe(false);
});
test('escaped metadata and abstracts cannot overflow the actual JSON context budget', () => {
  const selected = Array.from({ length: 50 }, (_, index) => ({ ...papers[0], id: `study-${index}`, year: '2025'.repeat(10_000), abstract: 'Declared abstract \\"\n\u0001'.repeat(500) }));
  const packet = buildSynthesisPacket(selected);
  expect(packet.ok).toBe(true); if (!packet.ok) return;
  expect(packet.characters).toBeLessThanOrEqual(SYNTHESIS_CHARACTER_BUDGET);
  expect(packet.papers).toHaveLength(50); expect(packet.papers[0].abstract).not.toContain('\u0001');
});
test('50-source route sends every available abstract, validates citations and keeps its limitations exportable without paid calls', async () => {
  const db = createTableFake(); db.seed('documents', { project_id: 'owned', type: 'journey:title', content: JSON.stringify({ title: 'Declared synthesis fixture project' }) });
  db.seed('research_stage_drafts', { project_id: 'owned', stage: 'literature', content: { referenceIds: papers.map((paper) => paper.referenceId) } });
  (requireAuthenticatedUser as jest.Mock).mockResolvedValue({ user: { id: 'owner' }, supabase: db.session }); (ownsProject as jest.Mock).mockResolvedValue(true);
  (resolveLibrarySelection as jest.Mock).mockResolvedValue(papers);
  (generateStructured as jest.Mock).mockResolvedValue({ output: JSON.stringify({ introduction: 'هذه مقدمة اختبار معلنة لا تثبت نتيجة علمية.', thematicSynthesis: 'هذا تخليق اختباري من مستخلصات المصادر المعلنة فقط مع الحفاظ على حدود التفسير.', themes: [{ title: 'محور اختبار', synthesis: 'يربط المحور مصدري الاختبار الأول والأخير دون اختراع مصدر جديد.', supportingPaperIds: [papers[0].id, papers[49].id] }], researchGapsIdentified: [], conclusion: 'لا تكفي هذه المحاكاة لإثبات فجوة أو نتيجة بحثية حقيقية.', limitations: Array.from({ length: 6 }, (_, index) => `قيد اختباري معلن للمراجعة فقط ${index}`) }) });
  const response = await POST(new Request('http://localhost', { method: 'POST', body: JSON.stringify({ projectId: 'owned', mode: 'preliminary' }) }));
  expect(response.status).toBe(200); const data = await response.json(); expect(data.sources).toHaveLength(50); expect(data.referenceIds).toHaveLength(50);
  const prompt = (generateStructured as jest.Mock).mock.calls[0][0].prompt;
  const packet = JSON.parse(prompt.split('DATA_START\n').at(-1).split('\nDATA_END')[0]);
  expect(packet).toHaveLength(50); expect(packet.at(-1).id).toBe(papers[49].id);
  expect(normaliseResearchAnalysis(data.analysis, papers.map((paper) => paper.id))).not.toBeNull();
});
