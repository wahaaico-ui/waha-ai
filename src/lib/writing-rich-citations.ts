import { writingCitationDisplay, type WritingCitationPlan } from '@/lib/citations/writing-citations';
import { sliceWritingRuns, writingRichBlocks, type WritingRichDocument, type WritingTextRun } from '@/lib/writing-rich-text';

/** Insert CSL display text into the formatted copy only. Stored text, source
 * offsets and original punctuation are never rewritten by a citation style. */
export function richWritingCitationBlocks(doc: WritingRichDocument, plan: WritingCitationPlan) {
  let cursor = 0;
  const inserts = plan.segments.flatMap(segment => {
    const display = writingCitationDisplay(segment);
    const position = cursor + display.text.length; cursor += segment.text.length;
    return display.inText ? [{ position, text: ` ${display.inText}`, citationIds: segment.citationIds }] : [];
  });
  const blocks = writingRichBlocks(doc);
  return blocks.map((block, index) => {
    const runs: WritingTextRun[] = []; let at = block.start;
    for (const insert of inserts) {
      // A legacy claim can end in the paragraph separator. Keep its citation
      // beside that paragraph rather than silently omitting it.
      const boundary = blocks[index + 1]?.start ?? block.end + 1;
      if (insert.position < block.start || insert.position >= boundary) continue;
      const point = Math.min(insert.position, block.end);
      runs.push(...sliceWritingRuns(block, at, point), { text: insert.text, citationIds: insert.citationIds }); at = point;
    }
    runs.push(...sliceWritingRuns(block, at, block.end));
    return { ...block, runs };
  });
}
