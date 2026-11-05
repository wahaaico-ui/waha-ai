'use client';

import { useUiTranslation } from '@/lib/use-ui-translation';
import Image from 'next/image';
import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { CheckCircle2, KeyRound, ShieldCheck, Trash2 } from 'lucide-react';
import Logo from '@/components/Logo';
import { supabase } from '@/lib/supabase/client';

type VerifiedFactor = { id: string; friendly_name?: string };

export default function SecuritySettingsPage() {
  const { text: ui, direction: uiDirection } = useUiTranslation();

  const [factor, setFactor] = useState<VerifiedFactor | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (error) setMessage("تعذر قراءة إعدادات التحقق الثنائي.");
    else setFactor(data.totp.find((item) => item.status === 'verified') ?? null);
    setBusy(false);
  }, []);
  useEffect(() => {
    let active = true;
    void supabase.auth.mfa.listFactors().then(({ data, error }) => {
      if (!active) return;
      if (error) setMessage("تعذر قراءة إعدادات التحقق الثنائي.");
      else setFactor(data.totp.find((item) => item.status === 'verified') ?? null);
      setBusy(false);
    });
    return () => { active = false; };
  }, []);

  const beginEnrollment = async () => {
    setBusy(true); setMessage(null);
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'WAHA Authenticator' });
    if (error) setMessage("تعذر بدء التفعيل. حاول مجدداً.");
    else { setPendingId(data.id); setQrCode(data.totp.qr_code); setSecret(data.totp.secret); }
    setBusy(false);
  };

  const verifyEnrollment = async (event: FormEvent) => {
    event.preventDefault();
    if (!pendingId || !/^\d{6}$/.test(code)) return setMessage("أدخل الرمز المكوّن من 6 أرقام.");
    setBusy(true); setMessage(null);
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: pendingId, code });
    if (error) setMessage("الرمز غير صحيح أو انتهت صلاحيته. استخدم الرمز الحالي.");
    else { setPendingId(null); setQrCode(null); setSecret(null); setCode(''); setMessage("تم تفعيل التحقق الثنائي بنجاح."); await load(); }
    setBusy(false);
  };

  const removeFactor = async () => {
    if (!factor || !window.confirm('هل تريد إيقاف التحقق الثنائي لهذا الحساب؟')) return;
    setBusy(true); setMessage(null);
    const { error } = await supabase.auth.mfa.unenroll({ factorId: factor.id });
    if (error) setMessage("أكمل التحقق الثنائي في جلستك الحالية أولاً، ثم حاول الإيقاف.");
    else { setFactor(null); setMessage("تم إيقاف التحقق الثنائي."); }
    setBusy(false);
  };

  return <main dir={uiDirection} className="min-h-screen bg-[#f8fafc] px-4 py-10 text-slate-900"><div className="mx-auto max-w-xl"><Link href="/dashboard" className="mb-7 flex items-center gap-3"><Logo variant="full" className="h-9 w-auto" /></Link><section className="rounded-3xl border border-slate-200 bg-white p-7 shadow-xl shadow-slate-900/5"><KeyRound className="mb-4 h-11 w-11 text-blue-600" /><h1 className="text-2xl font-black">{ui("أمان الحساب")}</h1><p className="mt-2 leading-7 text-slate-600">{ui("استخدم تطبيق Google Authenticator أو Microsoft Authenticator لإضافة طبقة حماية ثانية.")}</p>{message && <p role="status" className="mt-5 rounded-xl bg-blue-50 p-3 text-sm text-blue-800">{ui(message)}</p>}{factor ? <div className="mt-7 rounded-2xl border border-emerald-200 bg-emerald-50 p-5"><div className="flex items-center gap-3 text-emerald-800"><ShieldCheck className="h-6 w-6" /><strong>{ui("التحقق الثنائي مفعّل")}</strong></div><p className="mt-2 text-sm text-emerald-700">{ui("سيُطلب رمز التطبيق بعد كل تسجيل دخول جديد.")}</p><button onClick={removeFactor} disabled={busy} className="mt-5 inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-white px-4 py-2 text-sm font-bold text-rose-700 disabled:opacity-50"><Trash2 className="h-4 w-4" />{ui("إيقاف التحقق الثنائي")}</button></div> : qrCode && pendingId ? <form onSubmit={verifyEnrollment} className="mt-7 space-y-5"><div className="rounded-2xl border border-slate-200 p-5 text-center"><Image src={qrCode} alt={ui("رمز QR لإضافة WAHA إلى تطبيق المصادقة")} width={220} height={220} unoptimized className="mx-auto" /><p className="mt-3 text-sm text-slate-600">{ui("امسح الرمز بالتطبيق، أو أدخل المفتاح يدوياً:")}</p><code dir="ltr" className="mt-2 block break-all rounded-lg bg-slate-100 p-2 text-xs">{secret}</code></div><div><label htmlFor="setup-code" className="mb-2 block text-sm font-bold">{ui("رمز التطبيق")}</label><input id="setup-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))} className="w-full rounded-xl border border-slate-300 px-4 py-3 text-center text-xl tracking-[0.45em] outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" /></div><button disabled={busy} className="w-full rounded-xl bg-blue-600 py-3 font-bold text-white disabled:opacity-50">{ui("تأكيد التفعيل")}</button></form> : <button onClick={beginEnrollment} disabled={busy} className="mt-7 w-full rounded-xl bg-blue-600 py-3 font-bold text-white disabled:opacity-50">{busy ? ui("جارٍ التحميل…") : ui("تفعيل التحقق الثنائي")}</button>}<div className="mt-7 flex items-start gap-3 rounded-xl bg-amber-50 p-4 text-sm leading-6 text-amber-900"><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" /><p>{ui("قبل التفعيل تأكد أن تطبيق المصادقة محفوظ على جهاز يمكنك الوصول إليه. يمكنك إضافة عامل ثانٍ لاحقاً كنسخة احتياطية.")}</p></div></section></div></main>;
}
