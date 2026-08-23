import { NextResponse } from 'next/server';
import type { PDFParse } from 'pdf-parse';
import { requireAuthenticatedUser } from '@/lib/supabase/authorization';

export const runtime = 'nodejs';

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_PAGES = 50;
const MAX_TEXT_CHARS = 1_000_000;

export async function POST(request: Request) {
  let parser: PDFParse | undefined;
  try {
    if (!(await requireAuthenticatedUser())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const file = (await request.formData()).get('file');
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
    return NextResponse.json({ text: result.text });
  } catch {
    return NextResponse.json({ error: 'Unable to parse PDF.' }, { status: 400 });
  } finally { await parser?.destroy(); }
}
