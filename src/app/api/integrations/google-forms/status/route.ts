import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { isGoogleFormsOAuthConfigured } from '@/lib/integrations/configuration';
import { GOOGLE_FORMS_RECEIPT_COOKIE, readGoogleFormsReceipt } from '@/lib/integrations/google-forms/receipt';
import { ownsProject, requireAuthenticatedUser } from '@/lib/supabase/authorization';

const headers = { 'Cache-Control': 'private, no-store' };
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(request: Request) {
  try {
    const access = await requireAuthenticatedUser();
    if (!access) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers });
    const projectId = new URL(request.url).searchParams.get('projectId')?.trim() || '';
    if (!UUID_PATTERN.test(projectId) || !(await ownsProject(projectId, access.user.id, access.supabase))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403, headers });
    }
    const cookieStore = await cookies();
    const form = readGoogleFormsReceipt(cookieStore.get(GOOGLE_FORMS_RECEIPT_COOKIE)?.value, access.user.id, projectId);
    return NextResponse.json({ configured: isGoogleFormsOAuthConfigured(), form }, { headers });
  } catch {
    return NextResponse.json({ error: 'تعذر تحميل حالة Google Forms.' }, { status: 503, headers });
  }
}
