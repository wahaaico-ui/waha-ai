'use client';

import { useUiTranslation } from '@/lib/use-ui-translation';
import { useState } from 'react';
import { CITATION_STYLES, WRITING_STYLE_LABELS, type CitationStyle } from '@/lib/citations/types';
import { projectExportEvidenceMessage } from '@/lib/project-export-errors';

type ExportFormat = 'docx' | 'pdf' | 'latex';
const EXPECTED_TYPE: Record<ExportFormat, string> = {
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  pdf: 'application/pdf',
  latex: 'application/x-tex',
};

export default function ProjectExportButton({ projectId, citationStyle: selectedStyle }: { projectId: string; citationStyle?: CitationStyle }) {
  const { text: ui, language } = useUiTranslation();

  const [busy, setBusy] = useState<ExportFormat | ''>('');
  const [error, setError] = useState('');
  const [evidenceErrorCode, setEvidenceErrorCode] = useState<string | null>(null);
  const [localStyle, setCitationStyle] = useState<CitationStyle>('apa-7');
  const citationStyle = selectedStyle || localStyle;
  const errorMessage = projectExportEvidenceMessage(evidenceErrorCode, language) || ui(error);
  async function download(format: ExportFormat) {
    if (busy) return;
    setBusy(format);
    setError('');
    setEvidenceErrorCode(null);
    try {
      const response = await fetch('/api/academic/export', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, format, citationStyle, language }),
        signal: AbortSignal.timeout(125_000),
      });
      if (!response.ok) {
        const details = response.status === 409 ? await response.json().catch(() => null) : null;
        if (projectExportEvidenceMessage(details?.code, language)) setEvidenceErrorCode(details.code);
        else setError(typeof details?.error === 'string' && details.error.length < 300 ? details.error : response.status === 401 ? 'سجّل الدخول مجدداً لتنزيل مشروعك.' : 'تعذر تجهيز ملف المشروع كاملًا. حاول مرة أخرى.');
        return;
      }
      if (!response.headers.get('content-type')?.includes(EXPECTED_TYPE[format])) { setError('تعذر تجهيز ملف المشروع كاملًا. حاول مرة أخرى.'); return; }
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement('a');
      link.href = url;
      link.download = `waha-project.${format === 'latex' ? 'tex' : format}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
    } catch {
      setError('تعذر تجهيز ملف المشروع كاملًا. حاول مرة أخرى.');
    } finally { setBusy(''); }
  }
  return <section className="rounded-2xl border border-slate-200 bg-white p-5">
    <h2 className="text-lg font-bold">{ui("تنزيل المخرجات المحفوظة")}</h2>
    <p className="mt-2 text-sm leading-7 text-slate-600">{ui("ملف Word قابل للتحرير، أو PDF جاهز للمراجعة، أو LaTeX يُبنى بمحرك XeLaTeX، ويجمع آخر نسخة محفوظة من كل مرحلة. راجع المحتوى والمراجع قبل التسليم الأكاديمي.")}</p>
    {!selectedStyle && <label className="mt-4 block text-sm font-bold">{ui("نمط قائمة المراجع في الملف")}<select aria-label={ui("نمط مراجع الملف")} value={citationStyle} disabled={Boolean(busy)} onChange={(event) => setCitationStyle(event.target.value as CitationStyle)} className="ms-3 rounded-xl border bg-white p-2">{CITATION_STYLES.map((style) => <option key={style} value={style}>{ui(WRITING_STYLE_LABELS[style])}</option>)}</select></label>}
    <div className="mt-4 flex flex-wrap gap-3">
      <button type="button" disabled={Boolean(busy)} onClick={() => void download('docx')} className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white disabled:opacity-50">{busy === 'docx' ? ui("جارٍ تجهيز Word…") : ui("تنزيل Word (.docx)")}</button>
      <button type="button" disabled={Boolean(busy)} onClick={() => void download('pdf')} className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-bold text-slate-800 disabled:opacity-50">{busy === 'pdf' ? ui("جارٍ تجهيز PDF…") : ui("تنزيل PDF (.pdf)")}</button>
      <button type="button" disabled={Boolean(busy)} onClick={() => void download('latex')} className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-bold text-slate-800 disabled:opacity-50">{busy === 'latex' ? ui("جارٍ تجهيز LaTeX…") : ui("تنزيل LaTeX (.tex)")}</button>
    </div>
    {errorMessage ? <p role="alert" className="mt-3 text-sm text-red-700">{errorMessage}</p> : null}
  </section>;
}
