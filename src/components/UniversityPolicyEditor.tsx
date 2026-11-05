'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useUiTranslation } from '@/lib/use-ui-translation';
import { legacyGuideFileName, normalizeUniversityPolicy, UNIVERSITY_GUIDE_MAX_BYTES, UNIVERSITY_GUIDE_MAX_PAGES, UNIVERSITY_POLICY_MAX_CHARS } from '@/lib/university-policy';
import { extractAcademicStyleProfile } from '@/lib/academic-style-profile';
import { guideRuleCandidates, GUIDE_RULE_KEYS, type ReviewedGuideRule } from '@/lib/guide-workflow';

const endpoint = '/api/academic/projects/policy';
type Props = { projectId: string; onComplete?: (policy: string) => void; onSkip?: () => void };

export default function UniversityPolicyEditor({ projectId, onComplete, onSkip }: Props) {
  const { text: ui, direction } = useUiTranslation(); const id = useId();
  const [text, setText] = useState(''); const [base, setBase] = useState<string | null>(null);
  const [loading, setLoading] = useState(true); const [loadError, setLoadError] = useState(false); const [retry, setRetry] = useState(0);
  const [busy, setBusy] = useState<'read' | 'save' | null>(null); const [error, setError] = useState(''); const [status, setStatus] = useState('');
  const [reviewed, setReviewed] = useState(false); const [legacy, setLegacy] = useState(false);
  const [file, setFile] = useState<File | null>(null); const [reading, setReading] = useState<{ totalPages: number; emptyPages: number[] } | null>(null);
  const [rules, setRules] = useState<ReviewedGuideRule[]>([]);
  const styleProfile = useMemo(() => extractAcademicStyleProfile(text), [text]);
  const extractedRules = [
    ['الجهة', styleProfile.university_or_journal_name],
    ['الخط العربي', styleProfile.language_rules.arabic_font_family],
    ['حجم المتن العربي', styleProfile.language_rules.arabic_font_size_body],
    ['حجم العنوان العربي', styleProfile.language_rules.arabic_font_size_heading_1],
    ['الخط الإنجليزي', styleProfile.language_rules.english_font_family],
    ['حجم المتن الإنجليزي', styleProfile.language_rules.english_font_size_body],
    ['تباعد الأسطر', styleProfile.language_rules.line_spacing],
    ['المسافة البادئة', styleProfile.language_rules.paragraph_indentation],
    ['الهامش العلوي', styleProfile.page_layout.margin_top],
    ['الهامش السفلي', styleProfile.page_layout.margin_bottom],
    ['هامش التجليد', styleProfile.page_layout.margin_binding_side],
    ['الهامش المقابل', styleProfile.page_layout.margin_other_side],
    ['نظام التوثيق', styleProfile.citation_style.system],
    ['توثيق المتن', styleProfile.citation_style.in_text_format],
  ] as const;
  const operation = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true); setLoadError(false); setError(''); setStatus(''); setText(''); setBase(null); setReviewed(false); setLegacy(false); setReading(null); setFile(null);
      try {
        const response = await fetch(`${endpoint}?projectId=${encodeURIComponent(projectId)}`, { cache: 'no-store', signal: controller.signal });
        const data = await response.json();
        if (!response.ok || data.projectId !== projectId || !(data.universityPolicy === null || typeof data.universityPolicy === 'string')) throw new Error();
        if (controller.signal.aborted) return;
        setBase(typeof data.storedPolicy === 'string' ? data.storedPolicy : data.universityPolicy); setLegacy(Boolean(legacyGuideFileName(data.universityPolicy)));
        setRules(Array.isArray(data.rules) ? data.rules : guideRuleCandidates(data.universityPolicy || ''));
        setText(legacyGuideFileName(data.universityPolicy) ? '' : data.universityPolicy || '');
      } catch {
        if (!controller.signal.aborted) setLoadError(true);
      } finally { if (!controller.signal.aborted) setLoading(false); }
    }
    void load();
    return () => { controller.abort(); operation.current?.abort(); };
  }, [projectId, retry]);

  async function readGuide() {
    if (!file || busy || loading || loadError) return;
    setError(''); setStatus('');
    if (file.type !== 'application/pdf' || !file.size || file.size > UNIVERSITY_GUIDE_MAX_BYTES) { setError('اختر دليل PDF نصيًا حتى 4 ميجابايت.'); return; }
    const controller = new AbortController(); operation.current = controller; setBusy('read');
    try {
      const body = new FormData(); body.set('projectId', projectId); body.set('file', file);
      const response = await fetch(endpoint, { method: 'POST', body, signal: controller.signal }); const data = await response.json();
      if (!response.ok && data?.code === 'no_text_layer') { if (!controller.signal.aborted) setError('لم نجد نصًا قابلًا للقراءة في الملف؛ يبدو أنه صور ممسوحة ضوئيًا. الواحة لا تقرأ الصور (OCR) حاليًا، فالصق نص التعليمات هنا أو ارفع نسخة PDF نصية.'); return; }
      if (!response.ok || data.saved !== false || data.projectId !== projectId || !normalizeUniversityPolicy(data.text)
        || !Number.isInteger(data.totalPages) || data.totalPages < 1 || data.totalPages > UNIVERSITY_GUIDE_MAX_PAGES
        || !Array.isArray(data.emptyPages) || data.emptyPages.some((page: unknown) => !Number.isInteger(page) || Number(page) < 1 || Number(page) > data.totalPages)) throw new Error();
      if (controller.signal.aborted) return;
      setText(normalizeUniversityPolicy(data.text)!); setRules(guideRuleCandidates(data.text)); setReading({ totalPages: data.totalPages, emptyPages: data.emptyPages }); setReviewed(false);
      setStatus('النص جاهز للمراجعة. قارنه بالدليل، ثم احفظ التعليمات التي ستعتمدها.');
    } catch { if (!controller.signal.aborted) setError('تعذر قراءة الدليل كاملًا. اختر ملفًا نصيًا حتى 50 صفحة أو الصق التعليمات المطلوبة.'); }
    finally { if (!controller.signal.aborted) setBusy(null); }
  }

  async function save(event: React.FormEvent) {
    event.preventDefault(); if (busy || loading || loadError || !reviewed) return;
    const policy = normalizeUniversityPolicy(text); if (!policy) { setError('أضف نص التعليمات الفعلي وراجعه قبل الحفظ.'); return; }
    const controller = new AbortController(); operation.current = controller; setBusy('save'); setError(''); setStatus('');
    try {
      const response = await fetch(endpoint, { method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, universityPolicy: policy, expectedPolicy: base, rules }), signal: controller.signal });
      const data = await response.json();
      if (controller.signal.aborted) return;
      if (response.status === 409) { setError('تغيّرت تعليمات المشروع في نافذة أخرى. انسخ تعديلاتك ثم استرجع النسخة الأحدث.'); return; }
      if (!response.ok || data.saved !== true || data.projectId !== projectId || data.universityPolicy !== policy) throw new Error();
      setBase(data.storedPolicy); setText(policy); setLegacy(false); setStatus('حُفظت القواعد المعتمدة ومصدر كل قاعدة في مشروعك.'); onComplete?.(policy);
    } catch { if (!controller.signal.aborted) setError('تعذر تأكيد الحفظ. النص باقٍ أمامك؛ أعد المحاولة.'); }
    finally { if (!controller.signal.aborted) setBusy(null); }
  }

  return <section dir={direction} aria-labelledby={`${id}-title`} className="min-w-0 space-y-5 rounded-2xl border border-slate-200 bg-white p-5 text-slate-900 shadow-sm sm:p-7">
    <header><h2 id={`${id}-title`} className="text-xl font-bold leading-8">{ui('تعليمات الجامعة في مشروعك')}</h2>
      <p className="mt-2 text-sm leading-7 text-slate-600">{ui('أضف متطلبات جامعتك أو ملاحظات التنسيق لتراجعها بجانب بحثك وتضمّنها في ملف المشروع.')}</p>
      <p className="mt-1 text-sm leading-7 text-slate-600">{ui('اضبط نمط التوثيق من المحرر. تُحفظ التعليمات هنا للمراجعة، وتحتاج بقية متطلبات الدليل إلى تطبيقك ومراجعتك.')}</p></header>
    {loading && <p role="status">{ui('جارٍ استرجاع تعليمات الجامعة…')}</p>}
    {loadError && <div role="alert" className="space-y-3 rounded-xl bg-rose-50 p-4 text-sm leading-7 text-rose-900"><p>{ui('تعذر استرجاع تعليمات الجامعة. أعد المحاولة.')}</p><button type="button" onClick={() => setRetry(value => value + 1)} className="rounded-lg border border-rose-200 px-4 py-2 font-bold">{ui('إعادة المحاولة')}</button></div>}
    {legacy && <p role="status" className="rounded-xl bg-blue-50 p-4 text-sm leading-7">{ui('المحفوظ سابقًا اسم الملف فقط. أضف نص الدليل لتتمكن من مراجعته وحفظه.')}</p>}
    <form onSubmit={save} className="space-y-5">
      <fieldset disabled={loading || loadError || Boolean(busy)} className="min-w-0 space-y-5 disabled:opacity-60">
        <div className="min-w-0 rounded-xl border border-slate-200 p-4">
          <label htmlFor={`${id}-file`} className="block text-sm font-bold leading-7">{ui('استخرج التعليمات من دليل الجامعة (PDF)')}</label>
          <p id={`${id}-file-help`} className="mt-1 text-sm leading-7 text-slate-600">{ui('ملف نصي حتى 4 ميجابايت و50 صفحة. راجع ترتيب النص العربي والأرقام مع الأصل؛ الملفات المصورة تحتاج إلى نص تلصقه هنا.')}</p>
          <input id={`${id}-file`} type="file" accept="application/pdf,.pdf" aria-describedby={`${id}-file-help`} onChange={event => { setFile(event.target.files?.[0] || null); setError(''); }} className="mt-3 block w-full min-w-0 max-w-full text-sm leading-7 file:me-3 file:rounded-lg file:border-0 file:bg-blue-50 file:px-3 file:py-2 file:text-blue-800" />
          <button type="button" disabled={!file} onClick={() => void readGuide()} className="mt-3 rounded-xl border border-blue-200 px-4 py-3 text-sm font-bold text-blue-800 disabled:opacity-50">{ui(busy === 'read' ? 'جارٍ قراءة الدليل…' : text.trim() ? 'استبدال النص بنص الدليل' : 'قراءة الدليل ومراجعة نصه')}</button>
        </div>
        {reading && <p role="status" className="text-sm leading-7 text-slate-700">{ui('صفحات الملف المقروءة: {0}.', [reading.totalPages])} {reading.emptyPages.length > 0 && ui('صفحات بلا نص مستخرج: {0}. راجعها في الأصل وأضف تعليماتها يدويًا.', [reading.emptyPages.join(', ')])}</p>}
        <div><label htmlFor={`${id}-text`} className="block text-sm font-bold leading-7">{ui('نص التعليمات الذي ستحفظه')}</label>
          <textarea id={`${id}-text`} dir="auto" rows={12} maxLength={UNIVERSITY_POLICY_MAX_CHARS} value={text} onChange={event => { setText(event.target.value); setRules(guideRuleCandidates(event.target.value)); setReviewed(false); setError(''); setStatus(''); }} aria-describedby={`${id}-text-help`} className="mt-2 block w-full min-w-0 rounded-xl border border-slate-300 p-4 text-base leading-8 focus:border-blue-600 focus:outline-2 focus:outline-blue-600" />
          <p id={`${id}-text-help`} className="mt-2 text-sm leading-7 text-slate-600">{ui('يمكنك لصق التعليمات مباشرة أو تعديل النص المستخرج. يُحفظ النص الذي تراجعه؛ احتفظ بملف الدليل الأصلي للمقارنة.')}</p></div>
        {text.trim() && <section aria-label={ui('القواعد المكتشفة من نص الدليل')} className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-7">
          <h3 className="font-bold">{ui('القواعد المكتشفة من نص الدليل')}</h3>
          <p className="text-slate-600">{ui('تظهر القاعدة فقط إذا وُجدت قيمة صريحة في النص. راجع الدليل الأصلي؛ القواعد غير المكتشفة لا تُطبّق تلقائيًا.')}</p>
          <p className="text-slate-600">{ui('اعتمد القواعد التي طابقتها مع الدليل. غير المكتشف لا يُطبق، والخطوط غير المتاحة في PDF تحتاج مراجعة مستقلة.')}</p>
          <p role="status" className="mt-2 font-semibold">{rules.length} {ui('قواعد مستخرجة')} · {rules.filter(rule => rule.status === 'review').length} {ui('تحتاج تأكيدك')} · {GUIDE_RULE_KEYS.length - rules.length} {ui('لم تُحدد في النص المقروء')}</p>
          <dl className="mt-3 grid gap-3 sm:grid-cols-2">{extractedRules.map(([label, rule], index) => { const selected = rules.find(item => item.key === GUIDE_RULE_KEYS[index]); return <div key={label} className="rounded-lg bg-white p-3"><dt className="font-bold">{ui(label)}</dt>{selected ? <><dd><input aria-label={`${ui(label)} — ${ui('القيمة')}`} value={selected.value} onChange={event => { const value = event.target.value; setRules(current => current.map(item => item.key === selected.key ? { ...item, value, status: 'review' } : item)); setReviewed(false); }} maxLength={120} className="mt-1 w-full rounded-lg border p-2" /></dd><dd className="mt-1 break-words text-xs text-slate-600">{selected.evidence}</dd><dd><label className="mt-2 flex items-center gap-2"><input type="checkbox" checked={selected.status === 'approved'} onChange={event => { setRules(current => current.map(item => item.key === selected.key ? { ...item, status: event.target.checked ? 'approved' : 'review' } : item)); setReviewed(false); }} />{ui('اعتمدت هذه القاعدة')}</label></dd></> : <dd>{rule ? String(rule.value) : ui('غير محدد في النص')}</dd>}</div>; })}</dl>
        </section>}
        <label className="flex items-start gap-3 text-sm leading-7"><input type="checkbox" checked={reviewed} onChange={event => setReviewed(event.target.checked)} required className="mt-1.5 size-5 shrink-0 accent-blue-600" /><span>{ui('راجعت النص مع الدليل، وهذه هي التعليمات التي أريد حفظها في مشروعي.')}</span></label>
        <button type="submit" disabled={!reviewed || !text.trim()} className="w-full rounded-xl bg-blue-600 px-5 py-3 font-bold leading-7 text-white hover:bg-blue-700 disabled:opacity-50 sm:w-auto">{ui(busy === 'save' ? 'جارٍ حفظ التعليمات…' : onComplete ? 'حفظ والانتقال إلى الكتابة' : 'حفظ تعليمات الجامعة')}</button>
      </fieldset>
    </form>
    {error && <p role="alert" className="rounded-xl bg-rose-50 p-4 text-sm leading-7 text-rose-900">{ui(error)}</p>}
    {status && <p role="status" className="rounded-xl bg-blue-50 p-4 text-sm leading-7 text-blue-900">{ui(status)}</p>}
    {onSkip && <button type="button" disabled={Boolean(busy)} onClick={onSkip} className="text-sm font-bold leading-7 text-blue-800 underline underline-offset-4 disabled:opacity-50">{ui('ابدأ الكتابة وأضف التعليمات لاحقًا')}</button>}
  </section>;
}
