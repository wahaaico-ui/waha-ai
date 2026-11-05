import { NextResponse } from 'next/server';
import type { PDFParse } from 'pdf-parse';
import { ownsProject, requireAuthenticatedUser } from '@/lib/supabase/authorization';
import { createServiceClient } from '@/lib/supabase/service';
import { createHash } from 'node:crypto';

export const runtime = 'nodejs';

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_PAGES = 50;
const MAX_TEXT_CHARS = 1_000_000;
const MIN_TEXT_CHARS_BEFORE_OCR_FALLBACK = 50;
const GEMINI_OCR_MODEL = 'gemini-3.6-flash';
const OCR_TIMEOUT_MS = 30_000;
const REPORT_TYPE = 'journey:pdf_extraction';

export async function GET(request: Request) {
  const access = await requireAuthenticatedUser();
  if (!access) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const projectId = new URL(request.url).searchParams.get('projectId');
  if (!projectId || projectId.length > 100) return NextResponse.json({ error: 'projectId required' }, { status: 400 });
  if (!(await ownsProject(projectId, access.user.id, access.supabase))) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  const { data, error } = await access.supabase.from('documents').select('id, content').eq('project_id', projectId).eq('type', REPORT_TYPE).limit(50);
  if (error) return NextResponse.json({ error: 'Unable to restore reading reports' }, { status: 500 });
  const reports = (data || []).flatMap((row) => {
    try {
      const value = JSON.parse(row.content);
      const r = value?.reading;
      if (typeof value.fileName !== 'string' || !r || typeof r.complete !== 'boolean'
        || !['text-layer', 'external-ocr'].includes(r.method)
        || !Number.isInteger(r.totalPages) || r.totalPages < 1 || r.totalPages > MAX_PAGES
        || !Number.isInteger(r.processedPages) || r.processedPages < 0 || r.processedPages > r.totalPages
        || r.maxPages !== MAX_PAGES) return [];
      return [{ id: row.id, fileName: value.fileName.slice(0, 255), reading: { totalPages: r.totalPages, processedPages: r.processedPages, maxPages: MAX_PAGES, method: r.method, complete: r.method === 'external-ocr' ? false : r.complete } }];
    } catch { return []; }
  });
  return NextResponse.json({ reports }, { headers: { 'Cache-Control': 'private, no-store' } });
}

/**
 * Falls back to Gemini's document understanding when pdf-parse extracts
 * little to no text — the usual sign of a scanned PDF with no digital text
 * layer. This sends the full PDF bytes to Google's API, so it only runs
 * when the caller has explicitly opted in (see `allowExternalOcr` below) —
 * never silently. Returns null (never throws) so callers can keep the
 * original (possibly empty) extraction if this fails, times out, or no
 * Gemini key is configured.
 */
async function extractTextWithGeminiOcr(buffer: Buffer): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_OCR_MODEL}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: 'Transcribe all the text content of this PDF document exactly as it appears, preserving reading order. Return only the transcribed text, no commentary.' },
                { inlineData: { mimeType: 'application/pdf', data: buffer.toString('base64') } },
              ],
            },
          ],
        }),
        signal: AbortSignal.timeout(OCR_TIMEOUT_MS),
      }
    );

    if (!response.ok) {
      console.error('Gemini OCR error:', response.status, await response.text());
      return null;
    }

    const data = await response.json();
    const text = (data.candidates?.[0]?.content?.parts?.[0]?.text ?? '').slice(0, MAX_TEXT_CHARS);
    return text.trim().length > 0 ? text : null;
  } catch (error) {
    console.error('Gemini OCR request failed:', error);
    return null;
  }
}

export async function POST(request: Request) {
  let parser: PDFParse | undefined;
  try {
    const access = await requireAuthenticatedUser();
    if (!access) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const formData = await request.formData();
    const projectId = formData.get('projectId');
    // Legacy extraction-only callers remain supported. Project writes require
    // explicit ownership before parsing or sending bytes to an OCR provider.
    if (projectId !== null && (typeof projectId !== 'string' || !projectId || projectId.length > 100)) return NextResponse.json({ error: 'Invalid projectId' }, { status: 400 });
    if (typeof projectId === 'string' && !(await ownsProject(projectId, access.user.id, access.supabase))) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    const file = formData.get('file');
    // OCR sends the full PDF to a third-party API (Google Gemini) — only ever
    // attempted when the caller explicitly opts in, never as a silent default.
    const allowExternalOcr = formData.get('allowExternalOcr') === 'true';
    if (!(file instanceof File)) return NextResponse.json({ error: 'No PDF file provided.' }, { status: 400 });
    if (file.type !== 'application/pdf' || file.size === 0 || file.size > MAX_FILE_BYTES) return NextResponse.json({ error: 'Only PDF files up to 10 MB are allowed.' }, { status: 400 });
    const buffer = Buffer.from(await file.arrayBuffer());
    if (buffer.subarray(0, 5).toString() !== '%PDF-') return NextResponse.json({ error: 'Invalid PDF file.' }, { status: 400 });

    // pdf-parse loads PDF.js worker assets at module evaluation time. Loading it only
    // after authentication makes unauthenticated requests reliably return 401 rather
    // than failing during route initialization.
    const { PDFParse } = await import('pdf-parse');
    parser = new PDFParse({ data: buffer });
    const info = await parser.getInfo();
    if (info.total > MAX_PAGES) return NextResponse.json({ error: 'PDF exceeds the 50-page limit.' }, { status: 400 });
    const result = await parser.getText();
    if (result.text.length > MAX_TEXT_CHARS) return NextResponse.json({ error: 'Extracted document text is too large.' }, { status: 400 });
    const reading = { totalPages: info.total, processedPages: result.pages.length, maxPages: MAX_PAGES, textCharacters: result.text.length, method: 'text-layer', complete: result.pages.length === info.total && result.pages.every((page) => page.text.trim().length > 0) && result.text.trim().length >= MIN_TEXT_CHARS_BEFORE_OCR_FALLBACK };
    const respond = async (payload: { text: string; reading: typeof reading; message?: string; ocrAvailable?: boolean; extractedViaOcr?: boolean }) => {
      if (typeof projectId !== 'string') return NextResponse.json(payload);
      // Metadata only: never an abstract, canonical work, evidence or AI verdict.
      // Different OCR/text-layer readings remain distinct; retries are idempotent.
      const digest = createHash('sha256').update(projectId).update(buffer).update(payload.reading.method).digest('hex');
      const id = `${digest.slice(0, 8)}-${digest.slice(8, 12)}-5${digest.slice(13, 16)}-a${digest.slice(17, 20)}-${digest.slice(20, 32)}`;
      try {
        const { error } = await createServiceClient().from('documents').upsert({ id, project_id: projectId, type: REPORT_TYPE, version: 1, content: JSON.stringify({ fileName: file.name.slice(0, 255), reading: payload.reading }) }, { onConflict: 'id' });
        if (error) throw new Error('storage unavailable');
        return NextResponse.json({ ...payload, reportSaved: true });
      } catch {
        return NextResponse.json({ ...payload, error: 'اكتمل الاستخراج لكن تعذر حفظ تقرير القراءة؛ أعد المحاولة.' }, { status: 503 });
      }
    };

    if (result.text.trim().length < MIN_TEXT_CHARS_BEFORE_OCR_FALLBACK) {
      if (!allowExternalOcr) {
        return await respond({
          text: result.text,
          reading: { ...reading, complete: false },
          ocrAvailable: true,
          message: 'يبدو أن هذا الملف ممسوح ضوئياً بدون طبقة نص. يمكن استخراج نصه عبر معالجة خارجية (Google Gemini) بموافقتك.',
        });
      }
      const ocrText = await extractTextWithGeminiOcr(buffer);
      if (ocrText) return await respond({ text: ocrText, extractedViaOcr: true, reading: { ...reading, textCharacters: ocrText.length, method: 'external-ocr', complete: false }, message: 'نص من معالجة خارجية؛ اكتمال النسخ ودقته يحتاجان مراجعتك.' });
    }

    return await respond({ text: result.text, reading });
  } catch {
    return NextResponse.json({ error: 'Unable to parse PDF.' }, { status: 400 });
  } finally { await parser?.destroy(); }
}
