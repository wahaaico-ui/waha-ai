import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { passwordStrength } from '@/lib/password-policy';
import { PROFILE_LIMITS, isSupportedCountry, optionalText } from '@/lib/researcher-profile';
import { safeAuthRedirect } from '@/lib/auth/safe-redirect';
import { isCompromisedPassword } from '@/lib/pwned-password';

type SignupPayload = {
  email?: unknown;
  password?: unknown;
  fullName?: unknown;
  specialty?: unknown;
  specialtyDetail?: unknown;
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
    try {
      if (await isCompromisedPassword(password)) {
        return NextResponse.json({ error: 'كلمة المرور ظهرت في تسريبات معروفة. اختر كلمة فريدة لم تستخدمها في موقع آخر.' }, { status: 400 });
      }
    } catch {
      return NextResponse.json({ error: 'تعذر إكمال فحص أمان كلمة المرور الآن. حاول مجدداً أو تابع باستخدام Google.' }, { status: 503 });
    }
    if (!isText(body.fullName, PROFILE_LIMITS.fullName) || !isText(body.specialty, PROFILE_LIMITS.specialty) || !isText(body.university, PROFILE_LIMITS.university) || !isText(body.level, PROFILE_LIMITS.level) || !isSupportedCountry(body.country)) {
      return NextResponse.json({ error: 'أكمل بيانات الحساب والملف الأكاديمي.' }, { status: 400 });
    }
    const specialtyDetail = optionalText(body.specialtyDetail, PROFILE_LIMITS.specialtyDetail);
    if (specialtyDetail === undefined) {
      return NextResponse.json({ error: `اكتب التخصص الدقيق في ${PROFILE_LIMITS.specialtyDetail} حرفًا على الأكثر.` }, { status: 400 });
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
        data: { full_name: fullName, specialty, ...(specialtyDetail ? { specialty_detail: specialtyDetail } : {}), university, level, country },
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
