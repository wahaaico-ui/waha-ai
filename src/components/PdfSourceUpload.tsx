'use client';
import { useEffect, useRef, useState } from 'react';
import { isUuid } from '@/lib/research-evidence';
import { PDF_MAX_BYTES } from '@/lib/pdf-evidence';

export default function PdfSourceUpload({ projectId, language, disabled, onSaved }: { projectId: string; language: 'ar' | 'en'; disabled: boolean; onSaved: (source: { sourceId: string; fileName: string }) => void }) {
  const ar = language === 'ar'; const input = useRef<HTMLInputElement>(null), active = useRef(true);
  const [file, setFile] = useState<File | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState('');
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  async function upload() {
    if (!file || busy) return;
    if (file.type !== 'application/pdf' || file.size > PDF_MAX_BYTES || !file.size) { setError(ar ? 'اختر ملف PDF حتى 4 ميجابايت.' : 'Choose a PDF up to 4 MB.'); return; }
    setBusy(true); setError('');
    try {
      const form = new FormData(); form.set('file', file);
      const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/pdfs`, { method: 'POST', body: form, signal: AbortSignal.timeout(90000) });
      const data = await response.json();
      if (!response.ok || data.saved !== true || !isUuid(data.sourceId) || typeof data.fileName !== 'string') throw new Error();
      if (active.current) { setFile(null); if (input.current) input.current.value = ''; onSaved(data); }
    } catch { if (active.current) setError(ar ? 'تعذر تأكيد حفظ الملف. أعد المحاولة بالملف نفسه.' : 'The save could not be confirmed. Retry with the same file.'); }
    finally { if (active.current) setBusy(false); }
  }
  return <div className="mt-4 min-w-0 rounded-xl border border-line bg-slate-50 p-4">
    <label className="block text-sm font-bold">{ar ? 'أضف الدراسة الأصلية إلى مشروعك' : 'Add the original study to your project'}<input ref={input} type="file" accept="application/pdf,.pdf" disabled={disabled || busy} onChange={e => { setFile(e.target.files?.[0] || null); setError(''); }} className="mt-3 block w-full min-w-0 text-sm file:me-3 file:rounded-lg file:border-0 file:bg-white file:px-3 file:py-2" /></label>
    <p className="mt-2 text-xs leading-6 text-slate-600">{ar ? 'PDF حتى 4 ميجابايت و50 صفحة. يحفظ الملف بشكل خاص، ولا يشغّل تحليلًا آليًا أو معالجة خارجية.' : 'PDF up to 4 MB and 50 pages. The file is saved privately, without AI analysis or external processing.'}</p>
    <button type="button" disabled={disabled || busy || !file} onClick={() => void upload()} className="mt-3 min-h-11 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white disabled:opacity-40">{busy ? ar ? 'جارٍ حفظ الملف…' : 'Saving the file…' : ar ? 'احفظ وافتح الدراسة' : 'Save and open study'}</button>
    {error && <p role="alert" className="mt-3 text-sm leading-7">{error}</p>}
  </div>;
}
