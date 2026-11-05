'use client';

import { useEffect, useState } from 'react';
import { Download, ExternalLink, FilePlus2 } from 'lucide-react';
import { useUiTranslation } from '@/lib/use-ui-translation';

type FormsStatus = {
  configured: boolean;
  form: null | { formId: string; editUrl: string; responderUri: string | null };
};

async function loadStatus(projectId: string, signal?: AbortSignal): Promise<FormsStatus> {
  const response = await fetch(`/api/integrations/google-forms/status?projectId=${encodeURIComponent(projectId)}`, { cache: 'no-store', signal });
  if (!response.ok) throw new Error('تعذر تحميل حالة Google Forms.');
  const result = await response.json() as FormsStatus;
  if (typeof result.configured !== 'boolean') throw new Error('تعذر تحميل حالة Google Forms.');
  return result;
}

function callbackFeedback() {
  return new URLSearchParams(window.location.search).get('googleForm');
}

export default function GoogleFormsExportPanel({ projectId, onDownload }: { projectId: string; onDownload: () => void }) {
  const { text: ui } = useUiTranslation();
  const [status, setStatus] = useState<FormsStatus | null>(null);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    loadStatus(projectId, controller.signal).then((result) => {
      if (controller.signal.aborted) return;
      setStatus(result); setError(''); setFeedback(callbackFeedback());
    }).catch(() => { if (!controller.signal.aborted) setError('تعذر تحميل حالة Google Forms.'); });
    return () => controller.abort();
  }, [projectId]);

  async function retry() {
    setBusy(true); setError('');
    try { setStatus(await loadStatus(projectId)); setFeedback(callbackFeedback()); }
    catch { setError('تعذر تحميل حالة Google Forms.'); }
    finally { setBusy(false); }
  }

  const form = feedback === 'created' ? status?.form : null;
  return <section aria-label="Google Forms" className="space-y-3">
    {form && <div role="status" className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-950">
      <p className="font-black">{ui('تم إنشاء الاستبانة داخل حساب Google الذي اخترته.')}</p>
      <div className="mt-3 flex flex-wrap gap-3">
        <a href={form.editUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2 font-bold text-white">{ui('فتح وتعديل النموذج')}<ExternalLink className="h-4 w-4" /></a>
        {form.responderUri && <a href={form.responderUri} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-emerald-300 bg-white px-4 py-2 font-bold">{ui('فتح رابط المشاركين')}<ExternalLink className="h-4 w-4" /></a>}
      </div>
    </div>}
    {status?.configured === false && <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">{ui('الربط المباشر مع Google Forms غير مفعّل بعد في إعدادات المنصة. يمكنك استخدام ملف الإنشاء الاحتياطي أدناه.')}</p>}
    {feedback === 'created' && status?.configured && !form && <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">{ui('لا يوجد تأكيد حديث لإنشاء النموذج. تحقق من حساب Google Forms قبل إنشاء نموذج آخر.')}</p>}
    {feedback === 'error' && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">{ui('تعذر تأكيد اكتمال إنشاء النموذج. تحقق من حساب Google Forms قبل إعادة المحاولة.')}</p>}
    {feedback === 'not-ready' && <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">{ui('احفظ الاستبانة واجتز فحص الجودة قبل إنشاء نموذج Google.')}</p>}
    {feedback === 'forbidden' && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">{ui('المشروع غير موجود أو لا تملك صلاحية الوصول إليه.')}</p>}
    {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900"><p>{ui(error)}</p><button type="button" disabled={busy} onClick={() => void retry()} className="mt-3 rounded-xl border border-blue-200 bg-white px-4 py-2 font-bold text-blue-700 disabled:opacity-50">{ui('إعادة تحميل حالة الربط')}</button></div>}
    {!status && !error && <p role="status" className="text-sm text-slate-600">{ui('جارٍ تحميل حالة الربط…')}</p>}
    {status?.configured && <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-4 text-xs leading-6 text-slate-700"><strong className="text-slate-950">{ui('الإنشاء المباشر:')}</strong>{' '}{ui('تختار حساب Google وتوافق على صلاحيات Google Forms المعروضة. تستخدم WAHA الإذن لإنشاء هذه الاستبانة، ولا تحتفظ برمز الوصول بعد العملية.')}</div>}
    <div className="grid gap-3 sm:grid-cols-2">
      {status?.configured && !error && <a href={`/api/integrations/google-forms/connect?projectId=${encodeURIComponent(projectId)}`} className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 p-4 text-center text-sm font-bold text-white"><FilePlus2 className="h-4 w-4" />{ui('إنشاء Google Form في حسابي')}</a>}
      <button type="button" onClick={onDownload} className="inline-flex items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm font-bold text-blue-800"><Download className="h-4 w-4" />{ui('تنزيل ملف احتياطي')}</button>
    </div>
  </section>;
}
