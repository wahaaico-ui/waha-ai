import { createHash } from 'node:crypto';

export const PDF_ANALYSIS_TYPE = 'journey:pdf_analysis';
export function pdfAnalysisId(projectId: string, sourceId: string) {
  const hash = createHash('sha256').update(JSON.stringify([PDF_ANALYSIS_TYPE, projectId, sourceId])).digest('hex');
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-5${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}
export function readPdfAnalysis(content: unknown): { sourceId: string; output: string; generatedAt: string } | null {
  try {
    const value = typeof content === 'string' ? JSON.parse(content) : content;
    if (!value || typeof value.sourceId !== 'string' || typeof value.output !== 'string' || !value.output.trim()
      || value.output.length > 100_000 || typeof value.generatedAt !== 'string') return null;
    return { sourceId: value.sourceId, output: value.output, generatedAt: value.generatedAt };
  } catch { return null; }
}
