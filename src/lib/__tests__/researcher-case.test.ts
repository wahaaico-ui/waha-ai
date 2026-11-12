import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildSynthesisPacket, SYNTHESIS_CHARACTER_BUDGET } from '@/lib/synthesis-packet';

// Actual cached public-index metadata. No claim of peer review, full-text
// verification, live application authentication or AI-provider evaluation.
type Paper = { id: string; title: string; abstract: string; authors: string[]; year: number; source: string };
const dataset: { papers: Paper[] } = JSON.parse(readFileSync(join(__dirname, 'fixtures', 'nursing-simulation.json'), 'utf8'));
const papers = dataset.papers.map((paper) => ({ ...paper, authors: paper.authors.join(', ') }));

test('all available abstract text fitting the budget survives a 50-record researcher selection', () => {
  expect(papers).toHaveLength(50);
  const packet = buildSynthesisPacket(papers);
  expect(packet.ok).toBe(true);
  if (!packet.ok) throw new Error(packet.error);
  expect(packet.characters).toBeLessThanOrEqual(SYNTHESIS_CHARACTER_BUDGET);
  expect(packet.papers.map((paper) => paper.id)).toEqual(papers.map((paper) => paper.id));
  for (const paper of packet.papers) {
    expect(paper.abstract).toBe(papers.find((source) => source.id === paper.id)!.abstract);
  }
});

test('the actual first study negative finding is retained, rather than discarded after its introduction', () => {
  const packet = buildSynthesisPacket(papers);
  expect(packet.ok).toBe(true);
  if (!packet.ok) throw new Error(packet.error);
  const finding = 'simulation did not significantly enhance';
  expect(papers[0].abstract).toContain(finding);
  expect(packet.papers[0].abstract).toContain(finding);
});
