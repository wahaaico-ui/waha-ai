import { createHash } from 'node:crypto';
import { WRITING_ANALYSIS_TYPE } from '@/lib/writing-analysis';
import type { WritingCitation, WritingSource } from '@/lib/evidence-writing';

/** Shared by generation and collection reads; never infer a cached record's
 * identity from a client-supplied document ID. */
export function writingAnalysisId(projectId: string, operation: 'extraction' | 'citation', language: 'ar' | 'en', source: Pick<WritingSource, 'id' | 'kind' | 'hash'>, citation?: WritingCitation) {
  const digest = createHash('sha256').update(JSON.stringify([WRITING_ANALYSIS_TYPE, projectId, operation, language, source.id, source.kind, source.hash, citation ? [citation.id, citation.claimText, citation.quoteText] : null])).digest('hex');
  return `${digest.slice(0, 8)}-${digest.slice(8, 12)}-5${digest.slice(13, 16)}-a${digest.slice(17, 20)}-${digest.slice(20, 32)}`;
}
