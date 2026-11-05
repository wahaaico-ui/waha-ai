import { availableAbstract } from '@/lib/research-abstracts';
export const SYNTHESIS_CHARACTER_BUDGET = 80_000;
export type SynthesisPaper = { id: string; title: string; authors: string; year: number | string; abstract: string; source: string };
const cleanText = (value: string) => value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '');

/** Include every selected source; share a bounded context across its abstracts. */
export function buildSynthesisPacket(value: unknown) {
  const selected = Array.isArray(value) ? value.filter((paper): paper is Record<string, unknown> => Boolean(paper && typeof paper === 'object' && typeof paper.id === 'string' && typeof paper.title === 'string')) : [];
  const papers: SynthesisPaper[] = selected.map((paper) => ({
    id: String(paper.id).slice(0, 500), title: cleanText(String(paper.title)).slice(0, 500),
    authors: typeof paper.authors === 'string' ? cleanText(paper.authors).slice(0, 1000) : '',
    year: typeof paper.year === 'number' && Number.isFinite(paper.year) ? paper.year : typeof paper.year === 'string' ? cleanText(paper.year).slice(0, 40) : '',
    abstract: cleanText(availableAbstract(paper.abstract)), source: typeof paper.source === 'string' ? cleanText(paper.source).slice(0, 100) : '',
  }));
  const included = papers.filter((paper) => paper.abstract);
  // Measure the actual JSON sent to the model. A blanket 2× escaping reserve
  // discarded result sections even when all available text fit the budget.
  const sizeAt = (limit: number) => JSON.stringify(included.map((paper) => ({ ...paper, abstract: paper.abstract.slice(0, limit) }))).length;
  if (included.length && sizeAt(200) > SYNTHESIS_CHARACTER_BUDGET) return { ok: false as const, error: 'حزمة الأدلة كبيرة لمسودة واحدة. قسّم المصادر إلى مجموعات موضوعية؛ كل المراجع تبقى محفوظة في المكتبة.' };
  let lower = 200;
  let upper = included.reduce((maximum, paper) => Math.max(maximum, paper.abstract.length), 3000);
  while (lower < upper) {
    const middle = Math.ceil((lower + upper) / 2);
    if (sizeAt(middle) <= SYNTHESIS_CHARACTER_BUDGET) lower = middle;
    else upper = middle - 1;
  }
  const abstractCharacterLimit = lower;
  const packet = papers.map((paper) => ({ ...paper, abstract: paper.abstract.slice(0, Math.max(0, abstractCharacterLimit)) }));
  const characters = JSON.stringify(packet.filter((paper) => paper.abstract)).length;
  if (characters > SYNTHESIS_CHARACTER_BUDGET) return { ok: false as const, error: 'حزمة الأدلة كبيرة لمسودة واحدة. قسّم المصادر إلى مجموعات موضوعية؛ كل المراجع تبقى محفوظة في المكتبة.' };
  return { ok: true as const, papers: packet, abstractCharacterLimit: Math.max(0, abstractCharacterLimit), characters };
}
