'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import JourneyProgress from '@/components/JourneyProgress';
import SiteHeader from '@/components/SiteHeader';
import { loadJourney, saveJourneyStage } from '@/lib/research-journey';
import type { TitleComparison } from '@/lib/title-comparison';
import { useProjectId } from '@/lib/use-project-id';

type ComparisonResponse = {
  success: boolean;
  topic: string | null;
  comparisons: TitleComparison[];
  recommendedId: string | null;
  sourceStatus: { source: string; availableForAllTitles: boolean; checkedAt: string; note: string };
};

type VerifyOutput = {
  topic?: string;
  decision?: string;
  acceptanceScore?: number;
  selectedResearchPath?: { id?: string; title?: string };
  researcherInput?: { scenario?: string; candidateTitles?: string[]; rejectionFeedback?: string | null };
};

function ScoreCell({ label, value }: { label: string; value: number }) {
  const color = value >= 75 ? 'text-emerald-700 bg-emerald-50' : value >= 50 ? 'text-amber-700 bg-amber-50' : 'text-rose-700 bg-rose-50';
  return <div className={`rounded-xl p-3 text-center ${color}`}><div className="text-lg font-black">{value}</div><div className="mt-1 text-[11px] font-bold">{label}</div></div>;
}

export default function ResearchTitlePage() {
  const projectId = useProjectId();
  const [verifyOutput, setVerifyOutput] = useState<VerifyOutput | null>(null);
  const [savedTitle, setSavedTitle] = useState('');
  const [loadingJourney, setLoadingJourney] = useState(() => Boolean(projectId));
  const [journeyError, setJourneyError] = useState('');
  const [comparison, setComparison] = useState<ComparisonResponse | null>(null);
  const [comparisonLoading, setComparisonLoading] = useState(false);
  const [comparisonError, setComparisonError] = useState('');
  const [ownTitles, setOwnTitles] = useState(['', '']);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState('');

  useEffect(() => {
    if (!projectId) return;
    loadJourney(projectId)
      .then((journey) => {
        const verify = journey.outputs.verify as VerifyOutput | undefined;
        setVerifyOutput(verify || null);
        const candidateTitles = verify?.researcherInput?.candidateTitles?.filter((title) => typeof title === 'string' && title.trim().length >= 10) || [];
        if (candidateTitles.length >= 2) setOwnTitles(candidateTitles.slice(0, 4));
        const title = journey.outputs.title?.title;
        if (typeof title === 'string') setSavedTitle(title);
      })
      .catch((reason) => setJourneyError(reason instanceof Error ? reason.message : 'تعذر تحميل المشروع.'))
      .finally(() => setLoadingJourney(false));
  }, [projectId]);

  const runComparison = async (candidateTitles?: string[]) => {
    if (!projectId) return;
    setComparisonLoading(true); setComparisonError(''); setSaveMessage('');
    try {
      const response = await fetch('/api/research/titles', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectId, candidateTitles }) });
      const data = await response.json() as ComparisonResponse & { error?: string };
      if (!response.ok) throw new Error(data.error || 'تعذر إكمال المقارنة.');
      setComparison(data);
    } catch (reason) { setComparisonError(reason instanceof Error ? reason.message : 'تعذر إكمال المقارنة.'); }
    finally { setComparisonLoading(false); }
  };

  const compareOwnTitles = () => {
    const titles = ownTitles.map((title) => title.trim()).filter(Boolean);
    if (titles.length < 2 || titles.some((title) => title.length < 10)) { setComparisonError('اكتب عنوانين واضحين على الأقل، لا يقل كل عنوان عن 10 أحرف.'); return; }
    void runComparison(titles);
  };

  const adoptTitle = async (candidate: TitleComparison) => {
    if (!projectId) return;
    setSavingId(candidate.id); setComparisonError(''); setSaveMessage('');
    try {
      await saveJourneyStage(projectId, 'title', { title: candidate.title, comparison: candidate, comparedAt: comparison?.sourceStatus.checkedAt || new Date().toISOString(), evidenceSource: comparison?.sourceStatus.source || 'OpenAlex' });
      setSavedTitle(candidate.title);
      setSaveMessage('تم اعتماد العنوان وحفظ المقارنة داخل مشروعك. فُتحت الآن مرحلة مشكلة البحث.');
    } catch (reason) { setComparisonError(reason instanceof Error ? reason.message : 'تعذر حفظ العنوان.'); }
    finally { setSavingId(null); }
  };

  const canEnter = verifyOutput?.decision === 'proceed' && Boolean(verifyOutput.selectedResearchPath?.id);
  const scenario = verifyOutput?.researcherInput?.scenario || 'idea';
  const comparingProvidedTitles = scenario === 'compare_titles';
  const repairingRejectedTitle = scenario === 'rejected_title';
  const pageCopy = comparingProvidedTitles
    ? {
        title: 'قارن عناوينك بالأدلة قبل اعتماد أحدها',
        description: 'نعرض العناوين التي أدخلتها في الاستكشاف، ثم نقارن الوضوح وقابلية التنفيذ وغنى الأدلة دون تغييرها نيابة عنك.',
      }
    : repairingRejectedTitle
      ? {
          title: 'عالج سبب رفض العنوان ثم اختر بديلاً أقوى',
          description: 'نبني بدائل من الفكرة وملاحظة الرفض والاتجاه الذي اعتمدته، ثم نتحقق من وضوح كل بديل وتوفر الأدلة حوله.',
        }
      : {
          title: 'صغ عنواناً أكاديمياً من اتجاهك المعتمد',
          description: 'نحوّل الفكرة والاتجاه الذي اخترته إلى عناوين محددة، ثم نراجع الأدلة وقابلية التنفيذ قبل أن تعتمد أحدها.',
        };

  return (
    <div dir="rtl" className="min-h-screen bg-[#F8FAFC] pb-20 text-slate-950">
      <SiteHeader />
      {!projectId && <aside className="border-b border-amber-200 bg-amber-50 px-4 py-4 text-center text-sm leading-7 text-amber-950"><strong>قبل بدء بناء البحث:</strong> أنشئ حساباً أو سجّل الدخول حتى نحفظ مشروعك ونحمي مراحله. <Link href="/signup" className="font-black text-blue-700 underline">إنشاء حساب</Link> أو <Link href="/login" className="font-black text-blue-700 underline">تسجيل الدخول</Link>.</aside>}
      {projectId && <JourneyProgress current="title" lang="ar" />}
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6 lg:py-12">
        <header className="rounded-3xl border border-blue-100 bg-white p-6 shadow-sm sm:p-8">
          <div className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">المرحلة 2 · صياغة العنوان</div>
          <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">{pageCopy.title}</h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600 sm:text-base">{pageCopy.description}</p>
        </header>

        {loadingJourney ? <section className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">جارٍ تحميل مشروعك والتحقق من بوابة الفكرة…</section>
        : !projectId ? <section className="rounded-2xl border border-amber-200 bg-amber-50 p-7 text-center"><h2 className="text-xl font-black text-amber-950">الرحلة البحثية تحتاج مشروعاً محفوظاً</h2><p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-amber-900">استكشاف الفكرة متاح مجاناً، لكن مقارنة العناوين واعتمادها وحماية المراحل التالية تتطلب حساباً ومشروعاً مرتبطاً بك.</p><div className="mt-5 flex flex-wrap justify-center gap-3"><Link href="/signup" className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white">إنشاء حساب</Link><Link href="/login" className="rounded-xl border border-amber-300 bg-white px-5 py-3 text-sm font-bold text-amber-900">تسجيل الدخول</Link></div></section>
        : journeyError ? <section className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800">{journeyError} <Link href="/login" className="font-bold underline">سجّل الدخول بالحساب المالك للمشروع</Link>.</section>
        : !canEnter ? <section className="rounded-2xl border border-amber-200 bg-amber-50 p-7 text-center"><h2 className="text-xl font-black text-amber-950">بوابة العنوان ما زالت مغلقة</h2><p className="mt-3 text-sm leading-7 text-amber-900">أكمل تقرير الاستكشاف المدعوم بالأدلة واعتمده أولاً. لا تفتح الدرجة الرقمية وحدها هذه المرحلة.</p><Link href="/verify-idea" className="mt-5 inline-flex rounded-xl bg-amber-300 px-5 py-3 text-sm font-bold text-amber-950">العودة إلى استكشاف الفكرة</Link></section>
        : <>
          <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5"><div className="text-xs font-bold text-emerald-700">بوابة الفكرة مفتوحة من سجل المشروع</div><p className="mt-2 text-sm leading-7 text-emerald-950"><strong>الفكرة التي جرى استكشافها:</strong> {verifyOutput?.topic}</p><p className="mt-2 text-sm leading-7 text-emerald-950"><strong>المسار الذي اعتمدته:</strong> {verifyOutput?.selectedResearchPath?.title}</p>{savedTitle && <p className="mt-2 rounded-xl border border-emerald-200 bg-white p-3 text-sm text-emerald-900"><strong>العنوان المحفوظ حالياً:</strong> {savedTitle}</p>}</section>

          {comparingProvidedTitles ? (
            <section className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-black">العناوين التي أدخلتها</h2>
              <p className="mt-2 text-sm leading-7 text-slate-600">راجعها كما هي، ثم ابدأ المقارنة. يمكنك تصحيح خطأ كتابي قبل الفحص، لكننا لن نستبدل قرارك بعنوان جديد.</p>
              <div className="mt-4 space-y-3">{ownTitles.map((title, index) => <textarea key={index} value={title} onChange={(event) => setOwnTitles((current) => current.map((item, itemIndex) => itemIndex === index ? event.target.value : item))} className="min-h-20 w-full resize-none rounded-xl border border-slate-300 p-3 text-sm leading-6 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" placeholder={`العنوان ${index + 1}`} />)}</div>
              <button type="button" onClick={compareOwnTitles} disabled={comparisonLoading} className="mt-4 w-full rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white disabled:opacity-50">{comparisonLoading ? 'جارٍ فحص العناوين…' : 'قارن عناويني بالأدلة'}</button>
            </section>
          ) : (
            <section className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-black">{repairingRejectedTitle ? 'بدائل تعالج ملاحظة الرفض' : 'عناوين مبنية على اتجاهك المعتمد'}</h2>
              <p className="mt-2 text-sm leading-7 text-slate-600">{repairingRejectedTitle ? `ملاحظة الرفض المحفوظة: ${verifyOutput?.researcherInput?.rejectionFeedback || 'لم تُحفظ ملاحظة تفصيلية.'}` : 'سنقترح ثلاثة عناوين من الفكرة والاتجاه المحفوظ، ثم نتحقق من الأدلة المتاحة لكل عنوان.'}</p>
              <button type="button" onClick={() => void runComparison()} disabled={comparisonLoading} className="mt-5 w-full rounded-xl bg-blue-600 px-5 py-3.5 text-sm font-bold text-white shadow-lg shadow-blue-600/15 disabled:opacity-50">{comparisonLoading ? 'جارٍ إعداد العناوين وفحصها…' : repairingRejectedTitle ? 'اقترح بدائل تعالج سبب الرفض' : 'اقترح 3 عناوين أكاديمية'}</button>
            </section>
          )}

          {comparisonError && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{comparisonError}</div>}
          {comparison && <section className="space-y-5">
            <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-black text-blue-950">{comparingProvidedTitles ? 'نتيجة مقارنة عناوينك' : 'العناوين المقترحة بعد فحص الأدلة'}</h2><span className="rounded-full border border-blue-200 bg-white px-3 py-1 text-xs font-bold text-blue-700">قراءة مدعومة بأدلة أكاديمية</span></div><p className="mt-2 text-xs leading-6 text-blue-900">تعكس الأعداد نطاق الفحص الحالي وليست حصراً نهائياً لكل ما نُشر.</p>{!comparison.sourceStatus.availableForAllTitles && <p className="mt-2 text-xs font-bold text-amber-800">التغطية غير مكتملة لأحد العناوين؛ أعد الفحص قبل اعتماد الفروق العددية.</p>}</div>
            <div className="grid gap-5 lg:grid-cols-3">{comparison.comparisons.map((candidate) => { const recommended = candidate.id === comparison.recommendedId; return <article key={candidate.id} className={`rounded-2xl border bg-white p-5 shadow-sm ${recommended ? 'border-blue-400 ring-4 ring-blue-100' : 'border-slate-200'}`}><div className="flex items-center justify-between gap-3">{recommended ? <span className="rounded-full bg-blue-600 px-3 py-1 text-xs font-bold text-white">الأقوى في الفحص الحالي</span> : <span className="text-xs font-bold text-slate-400">خيار بحثي</span>}<span className="text-2xl font-black text-slate-950">{candidate.overallScore}</span></div><h3 className="mt-4 text-base font-black leading-8 text-slate-950">{candidate.title}</h3><p className="mt-3 text-sm leading-7 text-slate-600">{candidate.rationale}</p><div className="mt-4 grid grid-cols-2 gap-2"><ScoreCell label="الوضوح" value={candidate.clarityScore} /><ScoreCell label="قابلية التنفيذ" value={candidate.feasibilityScore} /><ScoreCell label="غنى الأدلة" value={candidate.evidenceScore} /><ScoreCell label="حداثة الأدلة" value={candidate.recencyScore} /><ScoreCell label="ملاءمة السياق" value={candidate.contextScore} /><div className="rounded-xl bg-slate-100 p-3 text-center"><div className="text-lg font-black">{candidate.relevantStudies}</div><div className="mt-1 text-[11px] font-bold text-slate-600">نتيجة ذات صلة</div></div></div>{candidate.references.length > 0 && <div className="mt-4 border-t border-slate-200 pt-4"><div className="text-xs font-bold text-slate-500">أمثلة من الأدلة المسترجعة</div><ul className="mt-2 space-y-2 text-xs leading-5 text-slate-600">{candidate.references.slice(0, 3).map((reference) => <li key={`${candidate.id}-${reference.title}`}>{reference.url ? <a href={reference.url} target="_blank" rel="noopener noreferrer" className="text-blue-700 hover:underline">{reference.title}</a> : reference.title} {reference.year > 0 && `(${reference.year})`}</li>)}</ul></div>}<button type="button" onClick={() => void adoptTitle(candidate)} disabled={Boolean(savingId)} className={`mt-5 w-full rounded-xl px-4 py-3 text-sm font-bold disabled:opacity-50 ${recommended ? 'bg-blue-600 text-white' : 'border border-slate-300 bg-white text-slate-800'}`}>{savingId === candidate.id ? 'جارٍ الحفظ…' : 'اعتماد هذا العنوان'}</button></article>; })}</div>
          </section>}
          {saveMessage && <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5"><p className="text-sm font-bold leading-7 text-emerald-900">{saveMessage}</p><Link href={`/research/problem?projectId=${encodeURIComponent(projectId)}`} className="mt-3 inline-flex rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white">انتقل إلى مشكلة البحث والفجوة ←</Link></section>}
        </>}
      </main>
    </div>
  );
}
