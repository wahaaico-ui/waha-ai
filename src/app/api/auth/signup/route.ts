import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { passwordStrength } from '@/lib/password-policy';
import { isSupportedCountry } from '@/lib/researcher-profile';
import { safeAuthRedirect } from '@/lib/auth/safe-redirect';

type SignupPayload = {
  email?: unknown;
  password?: unknown;
  fullName?: unknown;
  specialty?: unknown;
  university?: unknown;
  level?: unknown;
  country?: unknown;
  redirectTo?: unknown;
};

const isText = (value: unknown, maximum: number): value is string => typeof value === 'string' && value.trim().length > 0 && value.trim().length <= maximum;

export async function POST(request: Request) {
  try {
    const body = await request.json() as SignupPayload;
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = typeof body.password === 'string' ? body.password : '';

    if (!/^\S+@\S+\.\S+$/.test(email)) return NextResponse.json({ error: 'أدخل بريداً إلكترونياً صالحاً.' }, { status: 400 });
    if (!passwordStrength(password).isStrong) return NextResponse.json({ error: 'كلمة المرور لا تحقق متطلبات الأمان.' }, { status: 400 });
    if (!isText(body.fullName, 120) || !isText(body.specialty, 160) || !isText(body.university, 160) || !isText(body.level, 80) || !isSupportedCountry(body.country)) {
      return NextResponse.json({ error: 'أكمل بيانات الحساب والملف الأكاديمي.' }, { status: 400 });
    }
    const fullName = body.fullName.trim();
    const specialty = body.specialty.trim();
    const university = body.university.trim();
    const level = body.level.trim();
    const country = body.country;
    const destination = safeAuthRedirect(
      typeof body.redirectTo === 'string' ? body.redirectTo : null,
      '/verify-idea',
    );
    const confirmationDestination = `/email-confirmed?next=${encodeURIComponent(destination)}`;

    const supabase = await createClient();
    const origin = new URL(request.url).origin;
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, specialty, university, level, country },
        emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(confirmationDestination)}`,
      },
    });

    if (error) return NextResponse.json({ error: 'تعذر إنشاء الحساب. تحقق من البيانات أو حاول لاحقاً.' }, { status: 400 });
    return NextResponse.json({
      needsEmailConfirmation: Boolean(data.user && !data.session),
      redirectTo: destination,
    });
  } catch {
    return NextResponse.json({ error: 'تعذر معالجة طلب إنشاء الحساب.' }, { status: 400 });
  }
}
