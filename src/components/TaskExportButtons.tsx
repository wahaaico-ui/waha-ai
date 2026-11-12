'use client';
import { useUiTranslation } from '@/lib/use-ui-translation';
import { useState } from 'react';

export default function TaskExportButtons({ projectId, task, documentId }: { projectId: string; task: 'analysis' | 'language' | 'supervisor' | 'originality' | 'journal_summary' | 'decision_summary'; documentId?: string }) {
  const { text: ui, language } = useUiTranslation();

  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const download = async (format: string) => {
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/academic/export', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectId, task, documentId, format, language }) });
      if (!response.ok) { const data = await response.json(); throw new Error(data.error || 'تعذر التصدير.'); }
      const url = URL.createObjectURL(await response.blob());
      const anchor = document.createElement('a'); anchor.href = url; anchor.download = `waha-${task}.${format === 'markdown' ? 'md' : format === 'latex' ? 'tex' : format}`; anchor.click(); URL.revokeObjectURL(url);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'تعذر التصدير.'); }
    finally { setBusy(false); }
  };
  return <section aria-label={ui("تصدير النتيجة المحفوظة")} className="mt-4 rounded-xl border border-blue-200 p-4"><p className="text-sm font-bold">{ui("تصدير النتيجة المحفوظة نفسها")}</p><div className="mt-3 flex flex-wrap gap-2">{['docx', 'pdf', 'latex', 'markdown'].map((format) => <button key={format} type="button" disabled={busy} onClick={() => void download(format)} className="rounded-lg border border-blue-300 px-4 py-2 text-sm font-bold text-blue-800 disabled:opacity-40">{format.toUpperCase()}</button>)}</div>{error && <p role="alert" className="mt-2 text-sm text-rose-800">{ui(error)}</p>}</section>;
}
