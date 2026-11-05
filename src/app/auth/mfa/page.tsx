'use client';

import { useUiTranslation } from '@/lib/use-ui-translation';
import { FormEvent, Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { KeyRound } from 'lucide-react';
import Logo from '@/components/Logo';
import { safeAuthRedirect } from '@/lib/auth/safe-redirect';
import { supabase } from '@/lib/supabase/client';

function MfaChallenge() {
  const { text: ui, direction: uiDirection } = useUiTranslation();

  const router = useRouter();
  const searchParams = useSearchParams();
  const destination = safeAuthRedirect(searchParams.get('next'), '/dashboard');
  const [factorId, setFactorId] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      const [{ data: assurance }, { data: factors, error: factorsError }] = await Promise.all([
        supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
        supabase.auth.mfa.listFactors(),
      ]);
      if (!active) return;
      if (assurance?.currentLevel === 'aal2') return router.replace(destination);
      const factor = factors?.totp.find((item) => item.status === 'verified');
      if (factorsError || !factor) setError("لم نجد وسيلة تحقق مفعّلة لهذا الحساب.");
      else setFactorId(factor.id);
      setLoading(false);
    })();
    return () => { active = false; };
  }, [destination, router]);

  const verify = async (event: FormEvent) => {
    event.preventDefault();
    if (!factorId || !/^\d{6}$/.test(code)) return setError("أدخل الرمز المكوّن من 6 أرقام.");
    setVerifying(true); setError(null);
    const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
    if (verifyError) setError("الرمز غير صحيح أو انتهت صلاحيته. افتح التطبيق وأدخل الرمز الحالي.");
    else { router.replace(destination); router.refresh(); }
    setVerifying(false);
  };

  return <main dir={uiDirection} className="grid min-h-screen place-items-center bg-[#f8fafc] p-4 text-slate-900"><section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-xl shadow-slate-900/5"><Logo variant="monogram" className="mx-auto mb-5 h-12 w-12" /><KeyRound className="mx-auto mb-4 h-10 w-10 text-blue-600" /><h1 className="text-center text-2xl font-black">{ui("التحقق بخطوتين")}</h1><p className="mt-2 text-center text-sm leading-6 text-slate-500">{ui("أدخل الرمز الحالي من تطبيق المصادقة لإكمال تسجيل الدخول.")}</p>{error && <p role="alert" className="mt-5 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{ui(error)}</p>}{loading ? <p className="mt-6 text-center text-sm text-slate-500">{ui("جارٍ التحقق…")}</p> : <form onSubmit={verify} className="mt-6 space-y-4"><label htmlFor="mfa-code" className="block text-sm font-bold text-slate-700">{ui("رمز المصادقة")}</label><input id="mfa-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))} className="w-full rounded-xl border border-slate-300 px-4 py-3 text-center text-2xl tracking-[0.5em] outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" /><button disabled={verifying || !factorId} className="w-full rounded-xl bg-blue-600 py-3 font-bold text-white disabled:opacity-50">{verifying ? ui("جارٍ التحقق…") : ui("تحقق وتابع")}</button></form>}<Link href="/login" className="mt-6 block text-center text-sm font-bold text-blue-600">{ui("العودة لتسجيل الدخول")}</Link></section></main>;
}

export default function MfaPage() {
  return <Suspense fallback={<main className="min-h-screen bg-[#f8fafc]" />}><MfaChallenge /></Suspense>;
}
