import { attachWritingSource, claimIsAnchored, quoteMatchesSource, type SavedWritingCitation, type WritingSource } from '@/lib/evidence-writing';
import { writingSourceFromPdf, writingSourceFromReference, type WritingPdfRow, type WritingReferenceRow } from '@/lib/evidence-writing-server';
import { latestWritingExportDraft, selectWritingExportAnalyses, type ExportDocument } from '@/lib/project-export';
import { ProjectExportEvidenceError } from '@/lib/project-export-errors';
import { readGroundedWritingAnalysis, writingSourceSnapshotMatches, type WritingAnalysis } from '@/lib/writing-analysis';
import { PDF_FILE_TYPE, readPdfFileRecord } from '@/lib/pdf-evidence';
import { pdfRecordId } from '@/lib/pdf-evidence-server';

/** Validate the exact rows captured for this export, without a second network
 * snapshot or any mutation. Missing or inconsistent evidence aborts the file. */
export function verifyProjectExportEvidence(projectId: string, documents: ExportDocument[], pdfs: Array<WritingPdfRow & { project_id: string }>, references: WritingReferenceRow[], language: 'ar' | 'en') {
  let draft;
  try { draft = latestWritingExportDraft(documents); }
  catch { throw new ProjectExportEvidenceError('export_writing_invalid'); }
  let analyses: WritingAnalysis[];
  try { analyses = selectWritingExportAnalyses(documents, language); }
  catch { throw new ProjectExportEvidenceError('export_analysis_invalid'); }
  const groups = new Map<string, { kind: 'pdf' | 'reference'; id: string; citations: SavedWritingCitation[]; analyses: WritingAnalysis[] }>();
  function group(kind: 'pdf' | 'reference', id: string) {
    const key = `${kind}:${id}`;
    let value = groups.get(key);
    if (!value) { value = { kind, id, citations: [], analyses: [] }; groups.set(key, value); }
    return value;
  }
  for (const citation of draft?.citations || []) {
    if (!claimIsAnchored(draft!.text, citation)) throw new ProjectExportEvidenceError('export_claim_changed');
    group(citation.sourceKind, citation.sourceId).citations.push(citation);
  }
  for (const record of analyses) group(record.source.kind, record.source.id).analyses.push(record);
  if (!groups.size) return;
  const referenceRows = new Map(references.map(row => [row.id, row]));
  const pdfRows = new Map(pdfs.map(row => [row.id, row]));
  const documentRows = new Map(documents.filter(row => row.id).map(row => [row.id, row]));
  const citations = new Map(draft?.citations.map(citation => [citation.id, citation]) || []);
  for (const selected of groups.values()) {
    let source: WritingSource;
    if (selected.kind === 'reference') {
      const row = referenceRows.get(selected.id);
      if (!row || row.project_id !== projectId) throw new ProjectExportEvidenceError('export_source_missing');
      source = writingSourceFromReference(row);
    } else {
      const row = pdfRows.get(selected.id);
      if (!row || row.project_id !== projectId) throw new ProjectExportEvidenceError('export_source_missing');
      const manifest = documentRows.get(pdfRecordId(projectId, row.id));
      const record = manifest ? readPdfFileRecord(manifest.content) : null;
      if (manifest && (manifest.type !== PDF_FILE_TYPE || !record || record.projectId !== projectId || record.sourceId !== row.id)) throw new ProjectExportEvidenceError('export_source_changed');
      try { source = writingSourceFromPdf(row, record); }
      catch { throw new ProjectExportEvidenceError('export_source_changed'); }
    }
    for (const citation of selected.citations) {
      if (!quoteMatchesSource(citation, source) || !writingSourceSnapshotMatches(citation.source, source)) throw new ProjectExportEvidenceError('export_source_changed');
      const anchored = attachWritingSource(citation, source);
      if (anchored.firstLine !== citation.firstLine || anchored.lastLine !== citation.lastLine
        || (citation.pdfPages && JSON.stringify(citation.pdfPages) !== JSON.stringify(anchored.pdfPages))) throw new ProjectExportEvidenceError('export_source_changed');
    }
    for (const record of selected.analyses) {
      const citation = record.operation === 'citation' ? citations.get(record.citationId) : undefined;
      if (!readGroundedWritingAnalysis(record, source, citation)) throw new ProjectExportEvidenceError('export_analysis_invalid');
    }
  }
}
