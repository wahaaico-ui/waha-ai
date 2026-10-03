import { NextResponse } from 'next/server';
import { requireAuthenticatedUser } from '@/lib/supabase/authorization';
import { checkReferenceList, MAX_INPUT_CHARS } from '@/lib/reference-check';
import { REFERENCE_PROVIDERS } from '@/lib/reference-check-providers';

export const runtime = 'nodejs';
export const maxDuration = 60;

const PRIVATE = { 'Cache-Control': 'private, no-store, max-age=0' };

/**
 * Checks a pasted reference list (or document text) against Crossref and
 * OpenAlex. Signed-in researchers only, because each check queries external
 * indexes. The text is processed in memory and nothing is stored.
 */
export async function POST(request: Request) {
  if (!(await requireAuthenticatedUser())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: PRIVATE });
  const body = await request.json().catch(() => null) as { text?: unknown } | null;
  const text = typeof body?.text === 'string' ? body.text : '';
  if (text.trim().length < 20) return NextResponse.json({ error: 'الصق قائمة المراجع أو نص المستند أولاً.' }, { status: 400, headers: PRIVATE });
  if (text.length > MAX_INPUT_CHARS) return NextResponse.json({ error: 'النص طويل جداً. الصق قسم المراجع وحده.' }, { status: 413, headers: PRIVATE });
  const report = await checkReferenceList(text, REFERENCE_PROVIDERS);
  if (!report.results.length) return NextResponse.json({ error: 'لم نتمكن من التعرف على مراجع في هذا النص. الصق قائمة المراجع بحيث يكون كل مرجع في سطر أو فقرة مستقلة.' }, { status: 422, headers: PRIVATE });
  return NextResponse.json({ success: true, report }, { headers: PRIVATE });
}
