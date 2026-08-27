import { NextResponse } from 'next/server';
import type { PDFParse } from 'pdf-parse';
import { requireAuthenticatedUser } from '@/lib/supabase/authorization';

export const runtime = 'nodejs';

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_PAGES = 50;
const MAX_TEXT_CHARS = 1_000_000;
const MIN_TEXT_CHARS_BEFORE_OCR_FALLBACK = 50;
const GEMINI_OCR_MODEL = 'gemini-3.6-flash';
const OCR_TIMEOUT_MS = 30_000;

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
    if (!(await requireAuthenticatedUser())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const formData = await request.formData();
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

    if (result.text.trim().length < MIN_TEXT_CHARS_BEFORE_OCR_FALLBACK) {
      if (!allowExternalOcr) {
        return NextResponse.json({
          text: result.text,
          ocrAvailable: true,
          message: 'يبدو أن هذا الملف ممسوح ضوئياً بدون طبقة نص. يمكن استخراج نصه عبر معالجة خارجية (Google Gemini) بموافقتك.',
        });
      }
      const ocrText = await extractTextWithGeminiOcr(buffer);
      if (ocrText) return NextResponse.json({ text: ocrText, extractedViaOcr: true });
    }

    return NextResponse.json({ text: result.text });
  } catch {
    return NextResponse.json({ error: 'Unable to parse PDF.' }, { status: 400 });
  } finally { await parser?.destroy(); }
}
