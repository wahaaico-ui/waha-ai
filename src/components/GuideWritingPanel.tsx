'use client';

import { useEffect, useMemo, useState } from 'react';
import UniversityPolicyEditor from './UniversityPolicyEditor';
import { auditAcademicText } from '@/lib/academic-text-audit';
import { approvedStyleProfile, GUIDE_RULE_KEYS, guideExportGaps, readSavedGuide, type GuideRuleKey, type RuleApplication } from '@/lib/guide-workflow';

const RULE_LABELS: Record<GuideRuleKey, [string, string]> = {
  university_or_journal_name: ['الجهة', 'Institution'], arabic_font_family: ['الخط العربي', 'Arabic font'], arabic_font_size_body: ['حجم المتن العربي', 'Arabic body size'],
  arabic_font_size_heading_1: ['حجم العنوان العربي', 'Arabic heading size'], english_font_family: ['الخط الإنجليزي', 'English font'], english_font_size_body: ['حجم المتن الإنجليزي', 'English body size'],
  line_spacing: ['تباعد الأسطر', 'Line spacing'], paragraph_indentation: ['المسافة البادئة', 'Paragraph indent'], margin_top: ['الهامش العلوي', 'Top margin'], margin_bottom: ['الهامش السفلي', 'Bottom margin'],
  margin_binding_side: ['هامش التجليد', 'Binding margin'], margin_other_side: ['الهامش المقابل', 'Other margin'], system: ['نظام التوثيق', 'Citation system'], in_text_format: ['توثيق المتن', 'In-text format'],
};
const APPLICATION: Record<RuleApplication, [string, string]> = { applied: ['يُطبَّق', 'applied'], approximate: ['يُطبَّق تقريبيًا', 'approximated'], not_applied: ['لا يُطبَّق', 'not applied'] };

type Props = { projectId: string; draftText: string; language: 'ar' | 'en'; linkedCount: number; citationCount: number; citationStyle: string };

export default function GuideWritingPanel({ projectId, draftText, language, linkedCount, citationCount, citationStyle }: Props) {
  const [stored, setStored] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/academic/projects/policy?projectId=${encodeURIComponent(projectId)}`, { cache: 'no-store', signal: controller.signal })
      .then(async response => { if (!response.ok) throw new Error('Guide unavailable'); return response.json(); })
      .then(data => { if (!controller.signal.aborted) { setStored(data.storedPolicy || data.universityPolicy || null); setLoadError(false); } })
      .catch(() => { if (!controller.signal.aborted) setLoadError(true); });
    return () => controller.abort();
  }, [projectId, revision]);
  const guide = useMemo(() => {
    try { return readSavedGuide(stored); } catch { return null; }
  }, [stored]);
  const profile = useMemo(() => guide ? approvedStyleProfile(guide) : null, [guide]);
  const issues = useMemo(() => auditAcademicText(draftText.slice(0, 12_000), language), [draftText, language]);
  const approved = guide?.rules.filter(rule => rule.status === 'approved') || [];
  const review = guide?.rules.filter(rule => rule.status === 'review') || [];
  const label = (ar: string, en: string) => language === 'ar' ? ar : en;
  const relevantIssues = issues;
  const fontRule = profile?.language_rules[language === 'ar' ? 'arabic_font_family' : 'english_font_family'];
  const exportGaps = useMemo(() => guide ? guideExportGaps(guide) : [], [guide]);
  const pick = (pair: [string, string]) => language === 'ar' ? pair[0] : pair[1];
  const legacyGuide = Boolean(stored && !stored.startsWith('WAHA_GUIDE_V1:'));
  const guideCitationStyle = profile?.citation_style.system?.value;
  const citationMismatch = Boolean(guideCitationStyle && guideCitationStyle.toLowerCase().replace(/\s+/gu, '-') !== citationStyle);
  return <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5" aria-label={label('اكتب وفق دليل جهتك', 'Write to your institution guidelines')}>
    <div><h3 className="text-lg font-bold">{label('اكتب وفق دليل جهتك', 'Write to your institution guidelines')}</h3>
      <p className="mt-1 text-sm leading-7 text-slate-600">{label('راجع القواعد مع نصها الأصلي أثناء الكتابة، ثم افحصها قبل التصدير.', 'Review each rule against its original passage while writing, then check before export.')}</p></div>
    <details><summary className="cursor-pointer font-semibold text-blue-700">{label('إضافة الدليل أو تعديل القواعد', 'Add a guide or edit rules')}</summary>
      <div className="mt-3"><UniversityPolicyEditor projectId={projectId} onComplete={() => setRevision(value => value + 1)} /></div></details>
    {loadError || !guide ? <p role="alert" className="text-sm text-red-700">{label('تعذر قراءة الدليل المحفوظ؛ أعد فتح الصفحة قبل التصدير.', 'Could not read the saved guide; reload before export.')}</p> : <>
      {legacyGuide && <p role="status" className="rounded-xl bg-amber-50 p-3 text-sm leading-7">{label('هذه تعليمات محفوظة بالنظام السابق. افتحها واعتمد كل قاعدة قبل الاعتماد على مراجعة الدليل؛ قد يبقى تنسيق التصدير السابق مفعلًا حتى تحفظ النسخة المراجَعة.', 'These instructions were saved in the earlier format. Open and approve each rule before relying on the guide review; earlier export formatting may still apply until you save the reviewed version.')}</p>}
      <p className="text-sm font-semibold">{approved.length} {label('قواعد معتمدة', 'approved rules')} · {review.length} {label('تحتاج مراجعة', 'need review')} · {GUIDE_RULE_KEYS.length - guide.rules.length} {label('غير محددة', 'not specified')}</p>
      {relevantIssues.length > 0 && <div className="space-y-2"><h4 className="font-semibold">{label('ملاحظات بجانب المسودة', 'Notes beside your draft')}</h4>
        <ul className="space-y-2">{relevantIssues.slice(0, 12).map((issue, index) => <li key={`${issue.code}-${index}`} className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm leading-7">{issue.paragraphIndex && <p className="font-semibold">{label('الفقرة', 'Paragraph')} {issue.paragraphIndex}</p>}<span dir="auto" className="font-semibold">{issue.excerpt}</span><p>{issue.message}</p><p className="text-slate-600">{label('اقتراح مراجعة؛ القرار والتعديل لك.', 'Review suggestion; you decide whether to edit.')}</p></li>)}</ul></div>}
      <div className="rounded-xl bg-slate-50 p-4 text-sm leading-7"><h4 className="font-semibold">{label('المراجعة قبل التصدير', 'Review before export')}</h4>
        <p>{label('قواعد اعتمدتها: ', 'Rules you approved: ')}{approved.length}. {label('الاعتماد يعني أنك راجعت القيمة مع الدليل، ولا يثبت أن النص أو الملف مطابق للدليل كله.', 'Approval means you checked the value against the guide; it does not prove the draft or file meets the whole guide.')}</p>
        <p>{label('يحتاج مراجعة: ', 'Needs review: ')}{review.length + relevantIssues.length + Math.max(0, citationCount - linkedCount) + Number(citationMismatch)}.</p>
        <p>{label('غير قابل للتحقق: ', 'Cannot verify: ')}{GUIDE_RULE_KEYS.length - guide.rules.length}{draftText.length > 12_000 ? ` · ${label('فُحص أول ١٢ ألف حرف فقط', 'Only the first 12,000 characters were checked')}` : ''}.</p>
        {citationCount > linkedCount && <p>{label('توجد إحالات فقدت ارتباطها بموضع النص؛ راجعها.', 'Some citations lost their anchor in the draft; review them.')}</p>}
        {citationMismatch && <p className="text-amber-800">{label(`الدليل يطلب ${guideCitationStyle}، بينما المسودة مضبوطة على ${citationStyle}. راجع النمط قبل التصدير.`, `The guide asks for ${guideCitationStyle}, while the draft uses ${citationStyle}. Review the style before export.`)}<br />{profile?.citation_style.system?.evidence}</p>}
        {exportGaps.length > 0 && <div role="note" className="mt-2 rounded-xl bg-amber-50 p-3 text-amber-950"><p className="font-semibold">{label('قبل التنزيل: قواعد معتمدة لا يطبّقها الملف كاملًا', 'Before download: approved rules a file does not fully apply')}</p>
          <ul className="mt-1 list-disc space-y-1 ps-5">{exportGaps.map(gap => <li key={gap.key}><span className="font-semibold">{pick(RULE_LABELS[gap.key])}</span> <bdi dir="auto">({gap.value})</bdi>: Word {pick(APPLICATION[gap.word])} · PDF {pick(APPLICATION[gap.pdf])}</li>)}</ul>
          <p className="mt-1">{label('عدّل ما لا يُطبَّق يدويًا في ملف Word، أو راجع ملف PDF قبل التسليم.', 'Adjust what is not applied in the Word file, or review the PDF before submission.')}</p></div>}
        {fontRule && <p className="text-slate-600">{label('مصدر قاعدة الخط: ', 'Font rule source: ')}{fontRule.evidence}</p>}
      </div>
    </>}
  </section>;
}
