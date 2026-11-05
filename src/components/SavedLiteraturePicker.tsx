'use client';

import { useUiTranslation } from '@/lib/use-ui-translation';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { loadJourney, saveJourneyDraft, saveJourneyStage } from '@/lib/research-journey';
import { loadProjectLibrary } from '@/lib/project-library-client';

type Source = { id: string; title: string; canonicalLinked: boolean; literaturePaper?: { abstract?: string } };

type Props = { projectId: string; canApprove: boolean; onSaved?: () => void; revision?: number };
export default function SavedLiteraturePicker(props: Props) {
  return <ProjectLiteraturePicker key={props.projectId} {...props} />;
}
function ProjectLiteraturePicker({ projectId, canApprove, onSaved, revision = 0 }: Props) {
  const { text: ui } = useUiTranslation();

  const [sources, setSources] = useState<Source[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [approved, setApproved] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [visible, setVisible] = useState(50);
  const hydrated = useRef(false);
  const changedAt = useRef('');
  const notified = useRef(onSaved);
  useEffect(() => { notified.current = onSaved; }, [onSaved]);
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    Promise.all([
      loadProjectLibrary(projectId, { signal: controller.signal }), loadJourney(projectId),
    ]).then(([items, journey]) => {
      if (!active) return;
      setSources(items);
      setLoading(false);
      const ids = journey.drafts.literature?.content.referenceIds;
      if (!hydrated.current) setSelected(Array.isArray(ids) ? ids.filter((id): id is string => typeof id === 'string' && items.some((item) => item.id === id)) : []);
      hydrated.current = true;
    }).catch((reason) => { if (active) { setLoading(false); setError(reason instanceof Error ? reason.message : 'تعذر تحميل المصادر.'); } });
    return () => { active = false; controller.abort(); };
  }, [projectId, revision]);
  useEffect(() => {
    if (!changedAt.current || !hydrated.current) return;
    const timestamp = changedAt.current;
    const timer = setTimeout(() => {
      void loadJourney(projectId).then(async (journey) => {
        const result = await saveJourneyDraft(projectId, 'literature', { ...journey.drafts.literature?.content, referenceIds: selected }, timestamp);
        if (!result.success) throw new Error("توجد مسودة أحدث؛ أعد تحميل الاختيار.");
        if (timestamp === changedAt.current) { setSaved(true); notified.current?.(); }
      }).catch((reason) => setError(reason.message));
    }, 0);
    return () => clearTimeout(timer);
  }, [selected, projectId]);
  const save = async (approve: boolean) => {
    setBusy(true); setError('');
    try {
      if (approve) await saveJourneyStage(projectId, 'literature', { referenceIds: selected });
      else {
        const journey = await loadJourney(projectId);
        const result = await saveJourneyDraft(projectId, 'literature', { ...journey.drafts.literature?.content, referenceIds: selected });
        if (!result.success) throw new Error("توجد مسودة أحدث؛ أعد تحميل الصفحة قبل الحفظ.");
      }
      setSaved(true);
      setApproved(approve); onSaved?.();
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'تعذر الحفظ.'); }
    finally { setBusy(false); }
  };
  return <section className="space-y-4 rounded-2xl border border-blue-200 bg-white p-5" aria-label={ui("اختيار مصادر المكتبة للأدبيات")}>
    <h2 className="text-lg font-black">{ui("اختر من مصادر مشروعك المحفوظة")}</h2>
    <p className="text-sm leading-7 text-slate-600">{ui("لا تحتاج إعادة البحث. حفظ الاختيار مسودة لجمع الأدبيات، وليس اعتمادًا رسميًا أو تأكيدًا لنتائج الدراسات.")}</p>
    <p className="text-xs leading-6 text-slate-600">{ui("يمكنك اختيار جميع المراجع المناسبة. التخليق يوزّع ميزانية السياق على المستخلصات المتاحة، ويطلب تقسيمها إلى مجموعات إذا كانت الحزمة كبيرة. المصادر بلا مستخلص لا تُستخدم لتوليد النتائج.")}</p>
    {loading && <p role="status" className="text-sm text-slate-600">{ui("جارٍ تحميل مكتبة المشروع…")}</p>}
    {sources.slice(0, visible).map((source) => <label key={source.id} className="flex items-start gap-3 rounded-xl border border-slate-200 p-3 text-sm">
      <input type="checkbox" disabled={loading} checked={selected.includes(source.id)} onChange={() => { changedAt.current = new Date().toISOString(); setSaved(false); setSelected((ids) => ids.includes(source.id) ? ids.filter((id) => id !== source.id) : [...ids, source.id]); }} className="mt-1 h-5 w-5 shrink-0" />
      <span className="min-w-0 break-words">{source.title}<span className="mt-1 block text-xs text-slate-500">{source.literaturePaper?.abstract ? ui("المستخلص متاح") : ui("المستخلص غير متاح؛ لن نستنتج نتائجها")} · {source.canonicalLinked ? ui("مرتبطة بسجل معياري؛ ليست تحققًا من النتائج") : ui("لا رابط معياري مؤكد")}</span></span>
    </label>)}
    {sources.length > visible && <button type="button" onClick={() => setVisible(value => value + 50)} className="rounded-xl border border-blue-200 px-4 py-3 text-sm font-bold text-blue-700">{ui("عرض المزيد من المصادر ({0} من {1})", [visible, sources.length])}</button>}
    {!loading && !error && !sources.length && <Link href={`/research/sources?projectId=${encodeURIComponent(projectId)}`} className="block font-bold text-blue-700 underline">{ui("الخطوة التالية: ابحث واحفظ مصدرًا في المكتبة")}</Link>}
    {error && <p role="alert" className="text-sm text-rose-700">{ui(error)}</p>}
    <div className="flex flex-wrap gap-3">
      <button type="button" disabled={loading || busy || !selected.length} onClick={() => void save(false)} className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-40">{ui("احفظ اختيار الأدبيات كمسودة (")}{' '}{selected.length})</button>
      {canApprove && <button type="button" disabled={loading || busy || selected.length < 3} onClick={() => void save(true)} className="rounded-xl border border-blue-300 px-4 py-3 text-sm font-bold disabled:opacity-40">{ui("تثبيت اختيار 3 مراجع أو أكثر")}</button>}
    </div>
    {!canApprove && <p className="text-xs leading-6 text-slate-600">{ui("الاعتماد الرسمي يحتاج استكمال المراحل السابقة؛ يمكنك الآن جمع المصادر وتخليق مستخلصاتها أوليًا.")}</p>}
    {saved && <p role="status" className="text-sm text-emerald-800">{approved ? ui("ثُبّت اختيار المراجع في مرحلة الأدبيات؛ راجع نوع كل مصدر قبل الاستنتاج.") : ui("حُفظ الاختيار كمسودة.")} <Link href={`/research/analysis?projectId=${encodeURIComponent(projectId)}${approved ? '' : '&mode=preliminary'}`} className="font-bold underline">{ui("الخطوة التالية: تخليق المستخلصات المتاحة ←")}</Link></p>}
  </section>;
}
