'use client';

import { useUiTranslation } from '@/lib/use-ui-translation';
import { useEffect, useRef, useState } from 'react';
import TaskExportButtons from '@/components/TaskExportButtons';
import { parseSupervisorReview, type ReviewNote, type SupervisorReview } from '@/lib/supervisor-review';

type SavedReview = SupervisorReview & { documentId: string; savedAt: string };
const empty: SupervisorReview = { originalText: '', revisedText: '', notes: [] };

export default function SupervisorReviewWorkspace({ projectId }: { projectId: string }) {
  const { text: ui, language } = useUiTranslation();

  const [form, setForm] = useState(empty); const [history, setHistory] = useState<SavedReview[]>([]);
  const [documentId, setDocumentId] = useState(''); const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  const [revision, setRevision] = useState(0); const [saved, setSaved] = useState(false);
  const dirty = useRef(false);
  const endpoint = `/api/projects/${encodeURIComponent(projectId)}/supervisor-review`;
  useEffect(() => {
    const controller = new AbortController(); let active = true;
    const timeout = window.setTimeout(() => controller.abort(), 20_000);
    fetch(endpoint, { cache: 'no-store', signal: controller.signal }).then(async (response) => {
      const data = await response.json(); if (!response.ok) throw new Error("تعذر استرجاع المراجعات. أعد المحاولة.");
      if (active) { setHistory(data.reviews || []); if (!dirty.current && data.reviews?.[0]) { setForm(data.reviews[0]); setDocumentId(data.reviews[0].documentId); setSaved(true); } setError(''); }
    }).catch(() => { if (active) setError("تعذر استرجاع المراجعات. أعد المحاولة؛ لا يعني هذا فقدانها."); })
      .finally(() => { window.clearTimeout(timeout); if (active) setLoading(false); });
    return () => { active = false; controller.abort(); window.clearTimeout(timeout); };
  }, [endpoint, revision]);
  const edit = (next: SupervisorReview) => { dirty.current = true; setForm(next); setSaved(false); setDocumentId(''); };
  const updateNote = (id: string, patch: Partial<ReviewNote>) => edit({ ...form, notes: form.notes.map((note) => note.id === id ? { ...note, ...patch } : note) });
  async function save() {
    setBusy(true); setError('');
    try {
      const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form), signal: AbortSignal.timeout(20_000) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || 'تعذر حفظ المراجعة.');
      const item = { ...form, documentId: data.documentId, savedAt: new Date().toISOString() };
      dirty.current = false; setDocumentId(data.documentId); setSaved(true); setHistory((items) => [item, ...items.filter((previous) => previous.documentId !== item.documentId)].slice(0, 20));
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'تعذر الحفظ. النص باقٍ في المحرر؛ أعد المحاولة.'); }
    finally { setBusy(false); }
  }
  if (loading) return <p role="status">{ui("جارٍ استرجاع ملاحظات المشرف…")}</p>;
  return <section aria-label={ui("مراجعة ملاحظات المشرف")} className="space-y-5">
    <header className="rounded-2xl border bg-white p-5"><h2 className="text-xl font-black">{ui("النص وملاحظات المشرف في مكان واحد")}</h2><p className="mt-2 text-sm leading-7">{ui("الصق النص وملاحظات المشرف، عدّل النص وسجّل كيف عالجت كل ملاحظة. الحفظ يحتفظ بنسخة مستقلة؛ الحالة تعبّر عن قرارك وتحتاج مراجعة المشرف.")}</p></header>
    {error && <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm">{ui(error)}<button type="button" disabled={busy} onClick={() => setRevision((value) => value + 1)} className="ms-3 underline">{ui("إعادة استرجاع المراجعات")}</button></div>}
    {history.length > 0 && <label className="block text-sm font-bold">{ui("آخر 20 نسخة محفوظة")}<select aria-label={ui("نسخ مراجعة المشرف")} value={documentId} disabled={busy} onChange={(event) => { const item = history.find((review) => review.documentId === event.target.value); if (item) { dirty.current = false; setForm(item); setDocumentId(item.documentId); setSaved(true); } }} className="mt-2 w-full rounded-xl border bg-white p-3"><option value="">{ui("تعديل غير محفوظ")}</option>{history.map((item) => <option key={item.documentId} value={item.documentId}>{new Date(item.savedAt).toLocaleString(language)} — {item.notes.length} {ui("ملاحظة")}</option>)}</select></label>}
    <div className="grid gap-4 lg:grid-cols-2"><label className="block rounded-2xl border bg-white p-5 text-sm font-bold">{ui("النص قبل المراجعة")}<textarea dir="auto" disabled={busy} rows={12} maxLength={12000} value={form.originalText} onChange={(event) => edit({ ...form, originalText: event.target.value, revisedText: form.revisedText === form.originalText ? event.target.value : form.revisedText })} className="mt-3 w-full rounded-xl border p-3 font-normal leading-7" /></label><label className="block rounded-2xl border bg-white p-5 text-sm font-bold">{ui("النص المعدّل")}<textarea dir="auto" disabled={busy} rows={12} maxLength={12000} value={form.revisedText} onChange={(event) => edit({ ...form, revisedText: event.target.value })} className="mt-3 w-full rounded-xl border p-3 font-normal leading-7" /></label></div>
    {form.notes.map((note, index) => <fieldset key={note.id} disabled={busy} className="space-y-3 rounded-2xl border bg-white p-5"><legend className="px-2 text-sm font-black">{ui("ملاحظة")}{' '}{index + 1}</legend><label className="block text-sm">{ui("ملاحظة المشرف")}<textarea aria-label={ui("ملاحظة المشرف {0}", [index + 1])} dir="auto" rows={3} maxLength={2000} value={note.comment} onChange={(event) => updateNote(note.id, { comment: event.target.value })} className="mt-1 w-full rounded-xl border p-3" /></label><label className="block text-sm">{ui("الموضع أو الفقرة")}<input aria-label={ui("موضع الملاحظة {0}", [index + 1])} maxLength={500} value={note.location} onChange={(event) => updateNote(note.id, { location: event.target.value })} className="mt-1 w-full rounded-xl border p-3" /></label><label className="block text-sm">{ui("ردك وما عدّلته")}<textarea aria-label={ui("رد الباحث {0}", [index + 1])} dir="auto" rows={3} maxLength={2000} value={note.response} onChange={(event) => updateNote(note.id, { response: event.target.value })} className="mt-1 w-full rounded-xl border p-3" /></label><label className="block text-sm">{ui("الحالة")}<select aria-label={ui("حالة الملاحظة {0}", [index + 1])} value={note.status} onChange={(event) => updateNote(note.id, { status: event.target.value as ReviewNote['status'] })} className="ms-3 rounded-xl border p-2"><option value="open">{ui("مفتوحة")}</option><option value="addressed">{ui("عدّلتها وسجلت الرد")}</option><option value="deferred">{ui("مؤجلة مع مبرر")}</option></select></label><button type="button" onClick={() => edit({ ...form, notes: form.notes.filter((item) => item.id !== note.id) })} className="text-sm text-rose-700 underline">{ui("إزالة هذه الملاحظة من المسودة")}</button></fieldset>)}
    <div className="flex flex-wrap gap-3"><button type="button" disabled={busy || form.notes.length >= 100} onClick={() => edit({ ...form, notes: [...form.notes, { id: crypto.randomUUID(), comment: '', location: '', response: '', status: 'open' }] })} className="rounded-xl border bg-white px-4 py-3 font-bold">{ui("إضافة ملاحظة المشرف")}</button><button type="button" disabled={busy || !parseSupervisorReview(form)} onClick={() => void save()} className="rounded-xl bg-blue-600 px-5 py-3 font-bold text-white disabled:opacity-40">{busy ? ui("جارٍ الحفظ…") : ui("حفظ نسخة المراجعة")}</button></div>
    {form.notes.some((note) => note.status !== 'open' && !note.response.trim()) && <p role="status" className="text-sm text-amber-900">{ui("سجّل ردًا أو مبررًا لكل ملاحظة عدّلتها أو أجّلتها.")}</p>}
    {saved && <p role="status" className="text-sm font-bold text-emerald-800">{ui("حُفظت نسخة النص وملاحظاتك وردودك.")}</p>}
    {saved && documentId && <TaskExportButtons projectId={projectId} task="supervisor" documentId={documentId} />}
  </section>;
}
