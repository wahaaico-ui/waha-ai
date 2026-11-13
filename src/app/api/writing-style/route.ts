import { NextResponse } from 'next/server';
import { requireAuthenticatedUser } from '@/lib/supabase/authorization';
import { analyseWritingStyle, approveStyleProfile, readStyleProfile, STYLE_MAX_CHARS, type SentenceLength } from '@/lib/writing-style';

const headers = { 'Cache-Control': 'private, no-store' };
const signIn = () => NextResponse.json({ error: 'يجب تسجيل الدخول أولاً.' }, { status: 401, headers });
const sampleOf = (body: unknown) => {
  const value = body && typeof body === 'object' ? (body as { sample?: unknown }).sample : undefined;
  return typeof value === 'string' && value.length <= STYLE_MAX_CHARS ? value : null;
};
const tooShort = (words: number, minimum: number) => NextResponse.json({ error: 'العينة قصيرة: فيها {0} كلمة، والمطلوب {1} على الأقل من كتابتك أنت.', values: [words, minimum], code: 'SAMPLE_TOO_SHORT' }, { status: 422, headers });

/** The account's approved style profile, or null before the style test (DOC-13-06). */
export async function GET() {
  const access = await requireAuthenticatedUser();
  if (!access) return signIn();
  return NextResponse.json({ profile: readStyleProfile(access.user.user_metadata?.writingStyle) }, { headers });
}

/** Measures a sample without saving anything, so the researcher can review the result. */
export async function POST(request: Request) {
  const access = await requireAuthenticatedUser();
  if (!access) return signIn();
  const sample = sampleOf(await request.json().catch(() => null));
  if (sample === null) return NextResponse.json({ error: 'الصق عينة من كتابتك لا تتجاوز {0} حرف.', values: [STYLE_MAX_CHARS] }, { status: 400, headers });
  const result = analyseWritingStyle(sample);
  return result.ok ? NextResponse.json({ profile: result.profile }, { headers }) : tooShort(result.words, result.minimum);
}

/** Re-measures the same sample on the server, applies the researcher's edits and saves the approved profile; the sample is not kept. */
export async function PUT(request: Request) {
  const access = await requireAuthenticatedUser();
  if (!access) return signIn();
  const body = await request.json().catch(() => null) as { sample?: unknown; terms?: unknown; voice?: unknown; sentenceLength?: unknown } | null;
  const sample = sampleOf(body);
  const voice = body?.voice === 'first' || body?.voice === 'third' ? body.voice : null;
  const sentenceLength = ['short', 'medium', 'long'].includes(body?.sentenceLength as string) ? body?.sentenceLength as SentenceLength : null;
  const terms = Array.isArray(body?.terms) && body.terms.every(term => typeof term === 'string') ? body.terms as string[] : null;
  if (sample === null || !voice || !sentenceLength || !terms) return NextResponse.json({ error: 'راجع العينة والاختيارات ثم اعتمد الملف.' }, { status: 400, headers });
  const result = analyseWritingStyle(sample);
  if (!result.ok) return tooShort(result.words, result.minimum);
  const profile = approveStyleProfile(result.profile, { terms, voice, sentenceLength }, new Date());
  const { error } = await access.supabase.auth.updateUser({ data: { writingStyle: profile } });
  if (error) return NextResponse.json({ error: 'تعذر حفظ ملف الأسلوب. أعد المحاولة.' }, { status: 503, headers });
  return NextResponse.json({ profile }, { headers });
}
