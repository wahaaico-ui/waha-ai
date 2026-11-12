import { NextResponse } from 'next/server';
import { requireAuthenticatedUser } from '@/lib/supabase/authorization';
import { normalizeOrcid } from '@/lib/orcid';
import { isMissingTable, newShareToken, parseShareSections, type CareerShareLink, type ShareSection } from '@/lib/career-share';

export const runtime = 'nodejs';
const headers = { 'Cache-Control': 'private, no-store' };
const unavailable = () => NextResponse.json({ error: 'رابط المشاركة غير مفعّل بعد على الموقع.' }, { status: 503, headers });
type Row = { token: string; orcid: string; sections: ShareSection[]; created_at: string };
const toLink = (row: Row): CareerShareLink => ({ token: row.token, orcid: row.orcid, sections: row.sections, createdAt: row.created_at });

/** The signed-in researcher's active share link, read under their own row-level policy. */
export async function GET() {
  const access = await requireAuthenticatedUser();
  if (!access) return NextResponse.json({ error: 'يجب تسجيل الدخول أولاً.' }, { status: 401, headers });
  const { data, error } = await access.supabase.from('career_share_links').select('token, orcid, sections, created_at')
    .eq('user_id', access.user.id).is('revoked_at', null).maybeSingle<Row>();
  if (error) return isMissingTable(error) ? unavailable() : NextResponse.json({ error: 'تعذر قراءة رابط المشاركة. أعد المحاولة.' }, { status: 500, headers });
  return NextResponse.json({ link: data ? toLink(data) : null }, { headers });
}

async function revoke(access: NonNullable<Awaited<ReturnType<typeof requireAuthenticatedUser>>>) {
  return access.supabase.from('career_share_links').update({ revoked_at: new Date().toISOString() })
    .eq('user_id', access.user.id).is('revoked_at', null);
}

/** A new link for the chosen sections; any earlier link stops working first. */
export async function POST(request: Request) {
  const access = await requireAuthenticatedUser();
  if (!access) return NextResponse.json({ error: 'يجب تسجيل الدخول أولاً.' }, { status: 401, headers });
  const body = await request.json().catch(() => null) as { sections?: unknown } | null;
  const sections = parseShareSections(body?.sections);
  if (!sections) return NextResponse.json({ error: 'اختر قسمًا واحدًا على الأقل لمشاركته.' }, { status: 400, headers });
  const orcid = normalizeOrcid(access.user.user_metadata?.orcid);
  if (!orcid) return NextResponse.json({ error: 'أضف معرّف ORCID أولاً.' }, { status: 409, headers });

  const revoked = await revoke(access);
  if (revoked.error) return isMissingTable(revoked.error) ? unavailable() : NextResponse.json({ error: 'تعذر إنشاء رابط المشاركة. أعد المحاولة.' }, { status: 500, headers });
  const { data, error } = await access.supabase.from('career_share_links')
    .insert({ user_id: access.user.id, token: newShareToken(), orcid, sections })
    .select('token, orcid, sections, created_at').single<Row>();
  if (error || !data) return isMissingTable(error) ? unavailable() : NextResponse.json({ error: 'تعذر إنشاء رابط المشاركة. أعد المحاولة.' }, { status: 500, headers });
  return NextResponse.json({ link: toLink(data) }, { status: 201, headers });
}

/** Revokes the active link; the public page answers "not found" from then on. */
export async function DELETE() {
  const access = await requireAuthenticatedUser();
  if (!access) return NextResponse.json({ error: 'يجب تسجيل الدخول أولاً.' }, { status: 401, headers });
  const { error } = await revoke(access);
  if (error) return isMissingTable(error) ? unavailable() : NextResponse.json({ error: 'تعذر إلغاء رابط المشاركة. أعد المحاولة.' }, { status: 500, headers });
  return NextResponse.json({ link: null }, { headers });
}
