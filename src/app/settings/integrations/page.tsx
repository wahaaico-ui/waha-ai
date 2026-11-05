'use client';

import { useUiTranslation } from '@/lib/use-ui-translation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BookOpen, CheckCircle2, ExternalLink, Loader2, LockKeyhole, Unplug } from 'lucide-react';

type IntegrationStatus = {
  entitled: boolean;
  configured?: boolean;
  integration: null | { status: string; external_user_id: string; connected_at: string };
};

export default function IntegrationsPage() {
  const { text: ui, direction: uiDirection } = useUiTranslation();

  const [status, setStatus] = useState<IntegrationStatus | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    setError('');
    const response = await fetch('/api/integrations/zotero/status', { cache: 'no-store' });
    if (response.status === 401) {
      window.location.replace('/login');
      return;
    }
    if (!response.ok) throw new Error("تعذر تحميل حالة التكامل");
    setStatus(await response.json());
  }

  useEffect(() => {
    let active = true;
    fetch('/api/integrations/zotero/status', { cache: 'no-store' })
      .then(async (response) => {
        if (response.status === 401) {
          window.location.replace('/login');
          return null;
        }
        if (!response.ok) throw new Error("تعذر تحميل حالة التكامل");
        return response.json() as Promise<IntegrationStatus>;
      })
      .then((result) => {
        if (active && result) {
          setStatus(result);
          const feedback = new URLSearchParams(window.location.search).get('zotero');
          if (feedback === 'error') setError('لم يكتمل ربط Zotero. أعد المحاولة؛ مراجعك المحفوظة لم تتغير.');
          if (feedback === 'connected' && result.integration?.status === 'connected') setNotice('تم ربط حساب Zotero. يمكنك استيراد مراجعك إلى المشروع.');
        }
      })
      .catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : 'حدث خطأ'); });
    return () => { active = false; };
  }, []);

  async function disconnect() {
    if (!window.confirm(ui('هل تريد فصل Zotero؟ ستبقى المراجع المستوردة داخل مشاريعك.'))) return;
    setBusy(true);
    setError(''); setNotice('');
    try {
      const response = await fetch('/api/integrations/zotero/disconnect', { method: 'DELETE' });
      if (!response.ok) throw new Error('تعذر فصل الحساب');
      await load();
    } catch { setError('تعذر فصل الحساب'); }
    finally { setBusy(false); }
  }

  async function retry() {
    setBusy(true);
    try { await load(); }
    catch { setError('تعذر تحميل حالة التكامل'); }
    finally { setBusy(false); }
  }

  const connected = status?.integration?.status === 'connected';

  return (
    <main dir={uiDirection} className="min-h-screen bg-bg px-4 py-12 text-ink">
      <div className="mx-auto max-w-3xl">
        <Link href="/dashboard/profile" className="text-sm text-primary-dark hover:underline">{ui("← العودة إلى الحساب")}</Link>
        <div className="mt-8">
          <h1 className="text-3xl font-black">{ui("التكاملات")}</h1>
          <p className="mt-3 text-sm leading-7 text-slate-600">{ui("اربط أدواتك البحثية بـWAHA مع أقل صلاحيات لازمة.")}</p>
        </div>

        <section className="mt-8 rounded-3xl border border-line bg-white shadow-sm p-6 sm:p-8">
          <div className="flex items-start gap-4">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-red-500/10 text-rose-700"><BookOpen /></span>
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-bold">Zotero</h2>
                {connected && <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-bold text-success"><CheckCircle2 className="h-3.5 w-3.5" />{ui("متصل")}</span>}
              </div>
              <p className="mt-2 text-sm leading-7 text-slate-600">{ui("استورد مجموعاتك ومراجعك إلى مشاريع WAHA. لا ننسخ ملفات PDF، ومفتاح الربط مشفّر على السيرفر.")}</p>
              <div className="mt-4 flex items-center gap-2 text-xs text-slate-500"><LockKeyhole className="h-4 w-4" />{ui("قراءة المكتبة والمجموعات فقط في الإصدار الأول.")}</div>

              {notice && <p role="status" className="mt-4 text-sm text-emerald-700">{ui(notice)}</p>}
              {error && <div role="alert" className="mt-4 text-sm text-rose-700"><p>{ui(error)}</p><button type="button" onClick={() => void retry()} disabled={busy} className="mt-3 rounded-xl border border-blue-200 px-4 py-2 font-bold text-blue-700 disabled:opacity-50">{ui('إعادة تحميل حالة الربط')}</button></div>}
              {!status ? !error && <Loader2 aria-label={ui('جارٍ تحميل حالة الربط…')} className="mt-6 animate-spin text-slate-500" /> : (
                <div className="mt-6 flex flex-wrap gap-3">
                  {connected ? (
                    <button onClick={disconnect} disabled={busy} className="inline-flex items-center gap-2 rounded-xl border border-rose-200 px-4 py-2.5 text-sm font-bold text-rose-700 hover:bg-red-500/10 disabled:opacity-50"><Unplug className="h-4 w-4" />{ui("فصل الحساب")}</button>
                  ) : status.configured === false ? (
                    <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-7 text-amber-950">{ui('ربط Zotero غير متاح حالياً. يمكنك متابعة البحث وحفظ المراجع في مكتبة مشروعك.')}</p>
                  ) : status.entitled ? (
                    <a href="/api/integrations/zotero/connect" className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-white hover:bg-blue-500">{ui("ربط Zotero")}<ExternalLink className="h-4 w-4" /></a>
                  ) : (
                    <Link href="/pricing" className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-white hover:bg-blue-500">{ui("الترقية إلى خطة الباحث")}</Link>
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
