'use client';

import { useState } from 'react';

export default function ProjectExportButton({ projectId }: { projectId: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function download() {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/academic/export', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, format: 'markdown' }),
      });
      if (!response.ok) throw new Error(response.status === 401 ? 'سجّل الدخول مجدداً لتنزيل مشروعك.' : 'تعذر تنزيل المشروع. حاول مجدداً.');
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement('a');
      link.href = url;
      link.download = 'waha-project.md';
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'تعذر تنزيل المشروع.');
    } finally { setBusy(false); }
  }
  return <section className="rounded-2xl border border-slate-200 bg-white p-5">
    <h2 className="text-lg font-bold">تنزيل المخرجات المحفوظة</h2>
    <p className="mt-2 text-sm leading-7 text-slate-600">ملف Markdown نصي قابل للتحرير، يجمع آخر نسخة محفوظة من كل مرحلة. احفظ تعديلاتك قبل التنزيل؛ هذا ليس ملف Word أو PDF.</p>
    <button type="button" disabled={busy} onClick={() => void download()} className="mt-4 rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white disabled:opacity-50">{busy ? 'جارٍ تجهيز الملف…' : 'تنزيل المشروع (.md)'}</button>
    {error ? <p role="alert" className="mt-3 text-sm text-red-700">{error}</p> : null}
  </section>;
}
