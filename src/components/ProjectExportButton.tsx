'use client';

import { useState } from 'react';

export default function ProjectExportButton({ projectId }: { projectId: string }) {
  const [busy, setBusy] = useState<'docx' | 'pdf' | ''>('');
  const [error, setError] = useState('');
  async function download(format: 'docx' | 'pdf') {
    if (busy) return;
    setBusy(format);
    setError('');
    try {
      const response = await fetch('/api/academic/export', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, format }),
      });
      if (!response.ok) throw new Error(response.status === 401 ? 'سجّل الدخول مجدداً لتنزيل مشروعك.' : 'تعذر تنزيل المشروع. حاول مجدداً.');
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement('a');
      link.href = url;
      link.download = `waha-project.${format}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'تعذر تنزيل المشروع.');
    } finally { setBusy(''); }
  }
  return <section className="rounded-2xl border border-slate-200 bg-white p-5">
    <h2 className="text-lg font-bold">تنزيل المخرجات المحفوظة</h2>
    <p className="mt-2 text-sm leading-7 text-slate-600">ملف Word قابل للتحرير أو PDF جاهز للمراجعة، ويجمع آخر نسخة محفوظة من كل مرحلة. راجع المحتوى والمراجع قبل التسليم الأكاديمي.</p>
    <div className="mt-4 flex flex-wrap gap-3">
      <button type="button" disabled={Boolean(busy)} onClick={() => void download('docx')} className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white disabled:opacity-50">{busy === 'docx' ? 'جارٍ تجهيز Word…' : 'تنزيل Word (.docx)'}</button>
      <button type="button" disabled={Boolean(busy)} onClick={() => void download('pdf')} className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-bold text-slate-800 disabled:opacity-50">{busy === 'pdf' ? 'جارٍ تجهيز PDF…' : 'تنزيل PDF (.pdf)'}</button>
    </div>
    {error ? <p role="alert" className="mt-3 text-sm text-red-700">{error}</p> : null}
  </section>;
}
