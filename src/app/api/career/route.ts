import { NextResponse } from 'next/server';
import { requireAuthenticatedUser } from '@/lib/supabase/authorization';
import { careerExportModel, loadCareer, normalizeOrcid } from '@/lib/scholarly-career';
import { buildProjectDocx, buildProjectPdf } from '@/lib/project-document-export';
import { hasPaidPlan } from '@/lib/billing/entitlements';

export const runtime = 'nodejs';
const headers = { 'Cache-Control': 'private, no-store' };

/** The signed-in researcher's career from the ORCID iD saved in their profile (DOC-30-01..03). */
export async function GET() {
  const access = await requireAuthenticatedUser();
  if (!access) return NextResponse.json({ error: 'يجب تسجيل الدخول أولاً.' }, { status: 401, headers });
  const orcid = normalizeOrcid(access.user.user_metadata?.orcid);
  if (!orcid) return NextResponse.json({ orcid: null, career: null }, { headers });
  try {
    return NextResponse.json({ orcid, career: await loadCareer(orcid) }, { headers });
  } catch {
    return NextResponse.json({ error: 'تعذر الوصول إلى بيانات OpenAlex الآن، فلم نعرض مسيرة قد تكون ناقصة. أعد المحاولة.' }, { status: 503, headers });
  }
}

/** The career as a Word or PDF file. */
export async function POST(request: Request) {
  const access = await requireAuthenticatedUser();
  if (!access) return NextResponse.json({ error: 'يجب تسجيل الدخول أولاً.' }, { status: 401, headers });
  const body = await request.json().catch(() => null) as { format?: unknown; language?: unknown } | null;
  const format = body?.format === 'pdf' ? 'pdf' : body?.format === 'docx' ? 'docx' : null;
  if (!format) return NextResponse.json({ error: 'اختر صيغة الملف.' }, { status: 400, headers });
  const orcid = normalizeOrcid(access.user.user_metadata?.orcid);
  if (!orcid) return NextResponse.json({ error: 'أضف معرّف ORCID أولاً.' }, { status: 409, headers });
  try {
    const model = careerExportModel(await loadCareer(orcid), body?.language === 'en' ? 'en' : 'ar');
    model.watermark = (await hasPaidPlan(access.user.id)) ? 'none' : 'free';
    const file = format === 'pdf' ? await buildProjectPdf(model) : await buildProjectDocx(model);
    return new NextResponse(Uint8Array.from(file).buffer, { headers: { ...headers, 'X-Content-Type-Options': 'nosniff',
      'Content-Type': format === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="waha-career.${format}"` } });
  } catch {
    return NextResponse.json({ error: 'تعذر إعداد ملف المسيرة الآن. أعد المحاولة.' }, { status: 503, headers });
  }
}
