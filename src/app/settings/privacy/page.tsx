'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { Download, LockKeyhole, ShieldCheck, Trash2 } from 'lucide-react';
import Logo from '@/components/Logo';
import { supabase } from '@/lib/supabase/client';

const CONFIRMATION = 'حذف حسابي نهائياً';

export default function PrivacySettingsPage() {
  const [downloading, setDownloading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState<{ kind: 'error' | 'success'; text: string } | null>(null);

  const downloadData = async () => {
    setDownloading(true); setMessage(null);
    try {
      const response = await fetch('/api/account/export', { credentials: 'same-origin', cache: 'no-store' });
      if (!response.ok) throw new Error('download_failed');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `waha-account-data-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(anchor); anchor.click(); anchor.remove(); URL.revokeObjectURL(url);
      setMessage({ kind: 'success', text: 'تم تجهيز وتنزيل نسخة بيانات حسابك.' });
    } catch {
      setMessage({ kind: 'error', text: 'تعذر تجهيز نسخة كاملة من البيانات. حاول مجدداً.' });
    } finally { setDownloading(false); }
  };

  const deleteAccount = async (event: FormEvent) => {
    event.preventDefault();
    if (confirmation !== CONFIRMATION) return setMessage({ kind: 'error', text: 'اكتب عبارة التأكيد كما هي.' });
    setDeleting(true); setMessage(null);
    try {
      const response = await fetch('/api/account/delete', {
        method: 'DELETE', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmation, password: password || undefined }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || 'delete_failed');
      await supabase.auth.signOut({ scope: 'local' });
      window.location.assign('/?accountDeleted=1');
    } catch (error) {
      setMessage({ kind: 'error', text: error instanceof Error && error.message !== 'delete_failed' ? error.message : 'تعذر حذف الحساب.' });
      setDeleting(false);
    }
  };

  return (
    <main dir="rtl" className="min-h-screen bg-slate-50 px-4 py-10 text-slate-950">
      <div className="mx-auto max-w-2xl">
        <Link href="/dashboard" className="mb-7 inline-flex"><Logo variant="full" className="h-9 w-auto" /></Link>
        <div className="mb-6">
          <h1 className="text-3xl font-black">الخصوصية وبيانات الحساب</h1>
          <p className="mt-2 leading-7 text-slate-600">أنت تملك بياناتك: نزّل نسخة منها أو احذف الحساب نهائياً.</p>
        </div>
        {message && <p role="status" className={`mb-5 rounded-2xl border p-4 text-sm ${message.kind === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-rose-200 bg-rose-50 text-rose-800'}`}>{message.text}</p>}

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <Download className="h-9 w-9 text-blue-600" />
          <h2 className="mt-4 text-xl font-black">تنزيل بياناتي</h2>
          <p className="mt-2 leading-7 text-slate-600">ملف JSON يشمل الحساب والمشاريع والمستندات والمصادر والمراجع ومخرجات الرحلة. لا يشمل كلمات المرور أو رموز الجلسات أو مفاتيح التكامل.</p>
          <button type="button" onClick={downloadData} disabled={downloading} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 font-bold text-white disabled:opacity-50"><Download className="h-5 w-5" />{downloading ? 'جارٍ التجهيز…' : 'تنزيل نسخة كاملة'}</button>
        </section>

        <section className="mt-6 rounded-3xl border border-rose-200 bg-white p-6 shadow-sm sm:p-8">
          <Trash2 className="h-9 w-9 text-rose-600" />
          <h2 className="mt-4 text-xl font-black">حذف الحساب نهائياً</h2>
          <div className="mt-3 flex gap-3 rounded-2xl bg-rose-50 p-4 text-sm leading-7 text-rose-900"><LockKeyhole className="mt-1 h-5 w-5 shrink-0" /><p>هذا الإجراء غير قابل للتراجع ويحذف المشاريع ومحتواها. حساب البريد يتطلب كلمة المرور؛ حساب Google يتطلب تسجيل دخول حديثاً.</p></div>
          <form onSubmit={deleteAccount} className="mt-5 space-y-4">
            <div><label htmlFor="delete-password" className="mb-2 block text-sm font-bold">كلمة المرور (لحساب البريد فقط)</label><input id="delete-password" type="password" autoComplete="current-password" maxLength={1024} value={password} onChange={(event) => setPassword(event.target.value)} className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-rose-500 focus:ring-4 focus:ring-rose-100" /></div>
            <div><label htmlFor="delete-confirmation" className="mb-2 block text-sm font-bold">اكتب: <span className="text-rose-700">{CONFIRMATION}</span></label><input id="delete-confirmation" value={confirmation} autoComplete="off" onChange={(event) => setConfirmation(event.target.value)} className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-rose-500 focus:ring-4 focus:ring-rose-100" /></div>
            <button disabled={deleting || confirmation !== CONFIRMATION} className="inline-flex items-center gap-2 rounded-xl bg-rose-700 px-5 py-3 font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"><Trash2 className="h-5 w-5" />{deleting ? 'جارٍ الحذف الآمن…' : 'حذف حسابي وكل بياناتي'}</button>
          </form>
        </section>

        <div className="mt-6 flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm leading-7 text-emerald-900"><ShieldCheck className="mt-1 h-5 w-5 shrink-0" /><p>لا نُعلن نجاح الحذف إذا تعذّر حذف أي جزء أساسي. بيانات النسخ الاحتياطية لدى مزود البنية تخضع لدورة الاحتفاظ التشغيلية ولا تعود متاحة داخل المنتج.</p></div>
      </div>
    </main>
  );
}
