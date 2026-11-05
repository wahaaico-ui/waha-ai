import { NextResponse } from 'next/server';
import { authoriseProject, type ProjectRouteContext } from '@/lib/research-project-access';
import { writingSourceFromPdf, writingSourceFromReference, type WritingPdfRow, type WritingReferenceRow } from '@/lib/evidence-writing-server';
import { pdfRecordId } from '@/lib/pdf-evidence-server';
import { PDF_FILE_TYPE, pdfQuotePages, readPdfFileRecord } from '@/lib/pdf-evidence';
import { EXTRACTION_FIELDS, readGroundedWritingAnalysis, sourceSnapshot, WRITING_ANALYSIS_TYPE } from '@/lib/writing-analysis';
import { writingAnalysisId } from '@/lib/writing-analysis-id';
import type { StudyComparisonPage, StudyComparisonRow } from '@/lib/study-comparison';

// A response page is a transport boundary, never a project reference limit.
const PAGE_SIZE = 20;
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } });
export async function GET(request: Request, context: ProjectRouteContext) {
  try {
    const auth = await authoriseProject(context);
    if (!auth.ok) { auth.response.headers.set('Cache-Control', 'private, no-store'); return auth.response; }
    const query = new URL(request.url).searchParams;
    const kind = query.get('kind'); const language = query.get('language');
    const offsetText = query.get('offset') || '0'; const offset = Number(offsetText);
    if ((kind !== 'reference' && kind !== 'pdf') || (language !== 'ar' && language !== 'en') || !/^\d+$/.test(offsetText) || !Number.isSafeInteger(offset) || offset < 0 || offset > 10_000_000) return json({ code: 'invalid_request' }, 400);
    const db = auth.access.supabase;
    const result = kind === 'reference'
      ? await db.from('project_references').select('id, project_id, provider, external_item_key, title, authors, publication_year, publication_title, doi, url, citation_data', { count: 'exact' }).eq('project_id', auth.projectId).eq('user_id', auth.access.user.id).order('created_at', { ascending: true }).order('id', { ascending: true }).range(offset, offset + PAGE_SIZE - 1)
      : await db.from('sources').select('id, project_id, raw_text, parsed_citation_apa', { count: 'exact' }).eq('project_id', auth.projectId).order('created_at', { ascending: true }).order('id', { ascending: true }).range(offset, offset + PAGE_SIZE - 1);
    if (result.error || !Array.isArray(result.data) || !Number.isSafeInteger(result.count) || Number(result.count) < 0) throw new Error('comparison_unavailable');
    const total = Number(result.count);
    if ((!result.data.length && offset < total) || offset + result.data.length > Math.max(total, offset)) throw new Error('comparison_incomplete');
    const manifests = new Map<string, ReturnType<typeof readPdfFileRecord>>();
    if (kind === 'pdf' && result.data.length) {
      const files = await db.from('documents').select('id, content').eq('project_id', auth.projectId).eq('type', PDF_FILE_TYPE).in('id', result.data.map(row => pdfRecordId(auth.projectId, row.id)));
      if (files.error) throw files.error;
      for (const row of files.data || []) {
        const file = readPdfFileRecord(row.content);
        manifests.set(row.id, file?.projectId === auth.projectId && file.ownerId === auth.access.user.id ? file : null);
      }
    }
    const candidates = result.data.map(row => {
      if (kind === 'reference') return { source: writingSourceFromReference(row as WritingReferenceRow), invalid: false };
      const pdfRow = row as WritingPdfRow;
      const manifest = manifests.get(pdfRecordId(auth.projectId, row.id));
      try {
        if (manifest === null) throw new Error('invalid_manifest');
        return { source: writingSourceFromPdf(pdfRow, manifest), invalid: false };
      } catch { return { source: writingSourceFromPdf({ ...pdfRow, raw_text: null }), invalid: true }; }
    });
    const ids = candidates.filter(c => !c.invalid && c.source.text.trim()).flatMap(({ source }) => (['ar', 'en'] as const).map(lang => writingAnalysisId(auth.projectId, 'extraction', lang, source)));
    const saved = new Map<string, unknown>();
    if (ids.length) {
      const records = await db.from('documents').select('id, content', { count: 'exact' }).eq('project_id', auth.projectId).eq('type', WRITING_ANALYSIS_TYPE).in('id', ids);
      if (records.error || records.count !== records.data?.length) throw new Error('comparison_analysis_incomplete');
      for (const row of records.data || []) saved.set(row.id, row.content);
    }
    const items: StudyComparisonRow[] = candidates.map(({ source, invalid }) => {
      const base = { source: sourceSnapshot(source), record: null, locations: {} };
      if (invalid) return { ...base, status: 'needs_review' };
      if (!source.text.trim()) return { ...base, status: 'text_unavailable' };
      let foundInvalid = false;
      for (const lang of [language, language === 'ar' ? 'en' : 'ar'] as const) {
        const id = writingAnalysisId(auth.projectId, 'extraction', lang, source);
        if (!saved.has(id)) continue;
        const record = readGroundedWritingAnalysis(saved.get(id), source);
        if (!record || record.operation !== 'extraction' || record.language !== lang) { foundInvalid = true; continue; }
        const locations: StudyComparisonRow['locations'] = {};
        for (const key of EXTRACTION_FIELDS) {
          const field = record.fields[key]; if (!field) continue;
          const pages = source.pdf && pdfQuotePages(source.pdf, field.quoteStart, field.quoteEnd);
          locations[key] = { firstLine: source.text.slice(0, field.quoteStart).split('\n').length, lastLine: source.text.slice(0, field.quoteEnd).split('\n').length, ...(pages ? { pages: { first: pages.first, last: pages.last } } : {}) };
        }
        return { source: sourceSnapshot(source), status: 'ready', record, locations };
      }
      return { ...base, status: foundInvalid ? 'needs_review' : 'not_extracted' };
    });
    const page: StudyComparisonPage = { items, kind, total, offset, nextOffset: offset + items.length < total ? offset + items.length : null };
    return json(page);
  } catch { return json({ code: 'comparison_unavailable' }, 503); }
}
