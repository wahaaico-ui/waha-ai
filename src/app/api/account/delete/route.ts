import { requireAuthenticatedUser } from '@/lib/supabase/authorization';
import { permanentlyDeleteAccount, verifyAccountDeletion } from '@/lib/account-privacy';

const headers = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' };
const CONFIRMATION = 'حذف حسابي نهائياً';

export async function DELETE(request: Request) {
  const access = await requireAuthenticatedUser();
  if (!access) return Response.json({ error: 'Unauthorized' }, { status: 401, headers });

  let body: { confirmation?: unknown; password?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'طلب غير صالح.' }, { status: 400, headers });
  }
  if (body.confirmation !== CONFIRMATION || (body.password !== undefined && typeof body.password !== 'string')) {
    return Response.json({ error: 'اكتب عبارة التأكيد كما تظهر قبل الحذف.' }, { status: 400, headers });
  }

  try {
    const verified = await verifyAccountDeletion(access.user, body.password, access.supabase);
    if (!verified) {
      return Response.json({
        error: access.user.app_metadata.providers?.includes('email')
          ? 'كلمة المرور غير صحيحة.'
          : 'يلزم تسجيل دخول حديث. سجّل الخروج ثم ادخل بواسطة Google وحاول خلال 10 دقائق.',
      }, { status: 403, headers });
    }

    const { data: { session }, error: sessionError } = await access.supabase.auth.getSession();
    if (sessionError || !session?.access_token) return Response.json({ error: 'انتهت الجلسة. سجّل الدخول مجدداً.' }, { status: 401, headers });
    await permanentlyDeleteAccount(access.user.id, session.access_token);
    return Response.json({ deleted: true }, { status: 200, headers });
  } catch (error) {
    if (error instanceof Error && error.message === 'ACCOUNT_DELETE_ACTIVE_SUBSCRIPTION') {
      return Response.json({ error: 'يوجد اشتراك نشط. ألغِ الاشتراك أولاً حتى لا يستمر احتساب الرسوم.' }, { status: 409, headers });
    }
    return Response.json({ error: 'تعذر حذف الحساب بالكامل، لذلك أوقفنا العملية دون تأكيد حذف ناقص.' }, { status: 500, headers });
  }
}
