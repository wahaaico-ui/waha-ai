'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BookOpen, CheckCircle2, ExternalLink, Loader2, LockKeyhole, Unplug } from 'lucide-react';

type IntegrationStatus = {
  entitled: boolean;
  integration: null | { status: string; external_user_id: string; connected_at: string };
};

export default function IntegrationsPage() {
  const [status, setStatus] = useState<IntegrationStatus | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    const response = await fetch('/api/integrations/zotero/status', { cache: 'no-store' });
    if (response.status === 401) {
      window.location.assign('/login');
      return;
    }
    if (!response.ok) throw new Error('تعذر تحميل حالة التكامل');
    setStatus(await response.json());
  }

  useEffect(() => {
    let active = true;
    fetch('/api/integrations/zotero/status', { cache: 'no-store' })
      .then(async (response) => {
        if (response.status === 401) {
          window.location.assign('/login');
          return null;
        }
        if (!response.ok) throw new Error('تعذر تحميل حالة التكامل');
        return response.json() as Promise<IntegrationStatus>;
      })
      .then((result) => { if (active && result) setStatus(result); })
      .catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : 'حدث خطأ'); });
    return () => { active = false; };
  }, []);

  async function disconnect() {
    if (!window.confirm('هل تريد فصل Zotero؟ ستبقى المراجع المستوردة داخل مشاريعك.')) return;
    setBusy(true);
    const response = await fetch('/api/integrations/zotero/disconnect', { method: 'DELETE' });
    setBusy(false);
    if (!response.ok) return setError('تعذر فصل الحساب');
    await load();
  }

  const connected = status?.integration?.status === 'connected';

  return (
    <main dir="rtl" className="min-h-screen bg-slate-950 px-4 py-12 text-white">
      <div className="mx-auto max-w-3xl">
        <Link href="/dashboard/profile" className="text-sm text-slate-400 hover:text-white">← العودة إلى الحساب</Link>
        <div className="mt-8">
          <h1 className="text-3xl font-black">التكاملات</h1>
          <p className="mt-3 text-sm leading-7 text-slate-400">اربط أدواتك البحثية بـWAHA مع أقل صلاحيات لازمة.</p>
        </div>

        <section className="mt-8 rounded-3xl border border-white/10 bg-white/[0.04] p-6 sm:p-8">
          <div className="flex items-start gap-4">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-red-500/10 text-red-400"><BookOpen /></span>
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-bold">Zotero</h2>
                {connected && <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-400"><CheckCircle2 className="h-3.5 w-3.5" />متصل</span>}
              </div>
              <p className="mt-2 text-sm leading-7 text-slate-400">استورد مجموعاتك ومراجعك إلى مشاريع WAHA. لا ننسخ ملفات PDF، ومفتاح الربط مشفّر على السيرفر.</p>
              <div className="mt-4 flex items-center gap-2 text-xs text-slate-500"><LockKeyhole className="h-4 w-4" />قراءة المكتبة والمجموعات فقط في الإصدار الأول.</div>

              {error && <p className="mt-4 text-sm text-red-400">{error}</p>}
              {!status ? <Loader2 className="mt-6 animate-spin text-slate-500" /> : (
                <div className="mt-6 flex flex-wrap gap-3">
                  {connected ? (
                    <button onClick={disconnect} disabled={busy} className="inline-flex items-center gap-2 rounded-xl border border-red-400/30 px-4 py-2.5 text-sm font-bold text-red-300 hover:bg-red-500/10 disabled:opacity-50"><Unplug className="h-4 w-4" />فصل الحساب</button>
                  ) : status.entitled ? (
                    <a href="/api/integrations/zotero/connect" className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold hover:bg-blue-500">ربط Zotero <ExternalLink className="h-4 w-4" /></a>
                  ) : (
                    <Link href="/pricing" className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold hover:bg-blue-500">الترقية إلى خطة الباحث</Link>
                  )}
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
