'use client';

import { CheckCircle2, LockKeyhole } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import PasswordField from '@/components/PasswordField';
import { passwordStrength } from '@/lib/password-policy';

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [ready, setReady] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [complete, setComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { supabase.auth.getUser().then(({ data }) => setReady(Boolean(data.user))); }, []);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setError(null);
    if (!passwordStrength(password).isStrong) return setError('اختر كلمة مرور تحقق جميع المتطلبات.');
    if (password !== confirmation) return setError('كلمتا المرور غير متطابقتين.');
    setSaving(true);
    try { const response = await fetch('/api/auth/password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) }); const result = await response.json() as { error?: string }; if (!response.ok) throw new Error(result.error || 'تعذر التحديث.'); setComplete(true); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'تعذر تحديث كلمة المرور.'); }
    finally { setSaving(false); }
  };
  return <main dir="rtl" className="grid min-h-screen place-items-center bg-[#f8fafc] p-4 text-slate-900"><section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-7 shadow-xl shadow-slate-900/5 sm:p-9">{complete ? <div className="py-5 text-center"><CheckCircle2 className="mx-auto mb-4 h-16 w-16 text-emerald-500" /><h1 className="text-2xl font-black">تم تحديث كلمة المرور</h1><p className="mt-3 text-slate-600">يمكنك الآن تسجيل الدخول بأمان باستخدام كلمة المرور الجديدة.</p><Link href="/login" className="mt-6 inline-flex rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white">تسجيل الدخول</Link></div> : ready === false ? <div className="py-5 text-center"><LockKeyhole className="mx-auto mb-4 h-14 w-14 text-amber-500" /><h1 className="text-2xl font-black">رابط الاستعادة غير صالح</h1><p className="mt-3 leading-7 text-slate-600">قد يكون الرابط منتهياً أو استُخدم مسبقاً. اطلب رابطاً جديداً لإكمال العملية بأمان.</p><Link href="/forgot-password" className="mt-6 inline-flex rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white">طلب رابط جديد</Link></div> : <><header className="mb-6 text-center"><span className="mx-auto mb-4 grid h-11 w-11 place-items-center rounded-xl bg-blue-600 font-bold text-white">W</span><h1 className="text-2xl font-black">أنشئ كلمة مرور جديدة</h1><p className="mt-2 text-sm text-slate-500">نطلب كلمة قوية لحماية أبحاثك وملفاتك.</p></header>{ready === null ? <p className="text-center text-sm text-slate-500">جارٍ التحقق من رابط الاستعادة…</p> : <form onSubmit={submit} className="space-y-4">{error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}<PasswordField value={password} onChange={setPassword} autoComplete="new-password" /><PasswordField value={confirmation} onChange={setConfirmation} id="confirmation" label="تأكيد كلمة المرور" autoComplete="new-password" showRequirements={false} showGuardian={false} /><button disabled={saving} className="w-full rounded-xl bg-blue-600 py-3 font-bold text-white shadow-lg shadow-blue-600/20 disabled:opacity-50">{saving ? 'جارٍ الحفظ…' : 'حفظ كلمة المرور الجديدة'}</button></form>}</>}</section></main>;
}
