'use client';

import { useState } from 'react';
import type { LibrarySource } from './types';
import { EVIDENCE_TYPE_LABELS, evidenceCreateBody, type EvidenceTypeValue } from '@/lib/research-intelligence-ui';

/**
 * Records evidence from a saved source (or a researcher note without one).
 * Only the researcher's text, type, locator and chosen source are sent; the
 * server sets the state, origin and canonical work.
 */
export default function EvidenceForm({ projectId, sources, fixedSourceId, onCreated, onCancel }: {
  projectId: string; sources: LibrarySource[]; fixedSourceId?: string; onCreated: () => void; onCancel?: () => void;
}) {
  const [sourceId, setSourceId] = useState(fixedSourceId || '');
  const [evidenceType, setEvidenceType] = useState<EvidenceTypeValue>('finding');
  const [content, setContent] = useState('');
  const [locator, setLocator] = useState('');
  const [status, setStatus] = useState<'idle' | 'saving'>('idle');
  const [message, setMessage] = useState('');

  const submit = async () => {
    if (!content.trim()) { setMessage('اكتب الدليل كما ورد في المصدر أو كما تفهمه منه.'); return; }
    setStatus('saving'); setMessage('');
    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/evidence`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(evidenceCreateBody({ projectReferenceId: sourceId || null, evidenceType, content, locator })),
      });
      const data = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(response.status === 404 ? 'المصدر غير موجود في هذا المشروع.' : data.error || 'تعذر حفظ الدليل.');
      setContent(''); setLocator(''); setMessage('');
      onCreated();
    } catch (reason) { setMessage(reason instanceof Error ? reason.message : 'تعذر حفظ الدليل.'); }
    finally { setStatus('idle'); }
  };

  const fixedSource = fixedSourceId ? sources.find((source) => source.id === fixedSourceId) : undefined;
  return <div className="space-y-3 rounded-2xl border border-blue-200 bg-blue-50/60 p-4">
    <p className="text-xs leading-6 text-blue-900">المصدر هو العمل العلمي نفسه؛ الدليل هو ما تسجّله أنت منه لهذا المشروع. سيُحفظ الدليل بحالة تعكس مصدره، وتأكيد وروده في المصدر يكون منك لاحقاً.</p>
    {fixedSource ? <p className="text-sm font-bold text-slate-800">من المصدر: {fixedSource.title}</p>
      : <label className="block text-xs font-bold text-slate-700">المصدر
        <select value={sourceId} onChange={(event) => setSourceId(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-2.5 text-sm font-normal">
          <option value="">ملاحظة دون مصدر محفوظ</option>
          {sources.map((source) => <option key={source.id} value={source.id}>{source.title}</option>)}
        </select>
      </label>}
    <label className="block text-xs font-bold text-slate-700">نوع الدليل
      <select value={evidenceType} onChange={(event) => setEvidenceType(event.target.value as EvidenceTypeValue)} className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-2.5 text-sm font-normal">
        {Object.entries(EVIDENCE_TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select>
    </label>
    <label className="block text-xs font-bold text-slate-700">الدليل (نص أو ملخص بكلماتك)
      <textarea value={content} onChange={(event) => setContent(event.target.value)} maxLength={4000} rows={4} className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm font-normal leading-7" placeholder="مثال: وجدت الدراسة أن الطلبة يستخدمون الذكاء الاصطناعي لتبسيط المفاهيم المعقدة." />
    </label>
    <label className="block text-xs font-bold text-slate-700">الموضع في المصدر (اختياري)
      <input value={locator} onChange={(event) => setLocator(event.target.value)} maxLength={200} className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-2.5 text-sm font-normal" placeholder="مثال: ص 12، قسم النتائج" />
    </label>
    {message && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-xs text-rose-800">{message}</p>}
    <div className="flex flex-wrap gap-2">
      <button type="button" onClick={() => void submit()} disabled={status === 'saving'} className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">{status === 'saving' ? 'جارٍ الحفظ…' : 'حفظ الدليل'}</button>
      {onCancel && <button type="button" onClick={onCancel} className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700">إلغاء</button>}
    </div>
  </div>;
}
