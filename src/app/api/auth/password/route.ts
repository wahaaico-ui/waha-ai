import { NextResponse } from 'next/server';
import { requireAuthenticatedUser } from '@/lib/supabase/authorization';
import { passwordStrength } from '@/lib/password-policy';

export async function POST(request: Request) {
  try {
    const access = await requireAuthenticatedUser();
    if (!access) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await request.json() as { password?: unknown };
    const password = typeof body.password === 'string' ? body.password : '';
    if (!passwordStrength(password).isStrong) return NextResponse.json({ error: 'كلمة المرور لا تحقق متطلبات الأمان.' }, { status: 400 });
    const { error } = await access.supabase.auth.updateUser({ password });
    if (error) return NextResponse.json({ error: 'تعذر تحديث كلمة المرور. أعد فتح رابط الاستعادة وحاول مجدداً.' }, { status: 400 });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'تعذر تحديث كلمة المرور.' }, { status: 500 });
  }
}
