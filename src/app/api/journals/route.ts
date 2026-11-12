import { NextResponse } from 'next/server';
import { requireAuthenticatedUser } from '@/lib/supabase/authorization';
import { loadJournalAngles, loadJournalMatches } from '@/lib/journal-matching';

const respond = (body: Record<string, unknown>, status: number) =>
  NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } });

/**
 * Journals that publish on a topic ({ query }) or research angles from one
 * journal's own topics ({ journalId }), from OpenAlex (DOC-29-02, DOC-29-03).
 */
export async function POST(request: Request) {
  const access = await requireAuthenticatedUser();
  if (!access) return respond({ error: 'يجب تسجيل الدخول أولاً.' }, 401);
  const body: unknown = await request.json().catch(() => null);
  const fields = body && typeof body === 'object' && !Array.isArray(body) ? body as Record<string, unknown> : {};
  try {
    if (typeof fields.journalId === 'string') {
      if (!/^S\d{1,12}$/.test(fields.journalId)) return respond({ error: 'اختر مجلة من القائمة.' }, 400);
      return respond({ angles: await loadJournalAngles(fields.journalId) }, 200);
    }
    const query = typeof fields.query === 'string' ? fields.query.trim() : '';
    if (query.length < 3 || query.length > 300) return respond({ error: 'اكتب موضوعًا من 3 إلى 300 حرف.' }, 400);
    return respond({ matches: await loadJournalMatches(query) }, 200);
  } catch {
    return respond({ error: 'تعذر الوصول إلى بيانات OpenAlex الآن، فلم نعرض قائمة قد تكون مضللة. أعد المحاولة.' }, 503);
  }
}
