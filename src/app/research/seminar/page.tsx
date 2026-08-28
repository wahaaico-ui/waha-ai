'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Download, ShieldCheck } from 'lucide-react';
import SiteHeader from '@/components/SiteHeader';
import { JOURNEY_STAGES, loadJourney } from '@/lib/research-journey';
import { stageComplete } from '@/lib/research-workflow';
import type { ResearchAnalysis } from '@/lib/research-analysis';
import { useProjectId } from '@/lib/use-project-id';

type JourneyData = Awaited<ReturnType<typeof loadJourney>>;
type Paper = { id: string; title: string; authors?: string; year?: number | string; citationCount?: number; source?: string; pdfUrl?: string | null };

const strings = (value: unknown) => Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0) : [];
const text = (value: unknown) => typeof value === 'string' ? value : '';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="break-inside-avoid rounded-2xl border border-slate-200 bg-white p-5 shadow-sm print:rounded-none print:border-slate-300 print:shadow-none sm:p-7"><h2 className="border-b border-blue-100 pb-3 text-lg font-black text-blue-950">{title}</h2><div className="mt-4 text-sm leading-8 text-slate-700">{children}</div></section>;
}

export default function ResearchSeminarPage() {
  const projectId = useProjectId();
  const [journey, setJourney] = useState<JourneyData | null>(null);
  const [loading, setLoading] = useState(() => Boolean(projectId));
  const [error, setError] = useState('');

  useEffect(() => {
    if (!projectId) return;
    loadJourney(projectId).then(setJourney).catch((reason) => setError(reason instanceof Error ? reason.message : 'تعذر تحميل التقرير.')).finally(() => setLoading(false));
  }, [projectId]);

  const ready = useMemo(() => journey ? JOURNEY_STAGES.every((stage) => stageComplete(stage.id, journey.outputs[stage.id])) : false, [journey]);
  const title = text(journey?.outputs.title?.title);
  const verify = journey?.outputs.verify;
  const problem = journey?.outputs.problem;
  const objectives = strings(journey?.outputs.objectives?.objectives);
  const questions = strings(journey?.outputs.questions?.questions);
  const methodology = journey?.outputs.methodology;
  const papers = Array.isArray(journey?.outputs.literature?.papers) ? journey.outputs.literature.papers.filter((paper): paper is Paper => Boolean(paper && typeof paper === 'object' && typeof paper.id === 'string' && typeof paper.title === 'string')) : [];
  const analysis = journey?.outputs.analysis as ResearchAnalysis | undefined;
  const generatedAt = new Date().toLocaleString('ar');

  return <div dir="rtl" className="min-h-screen bg-[#F8FAFC] pb-20 text-slate-950 print:bg-white print:pb-0"><div className="print:hidden"><SiteHeader /></div><main className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6 print:max-w-none print:px-0 print:py-0">
    {loading ? <section className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">جارٍ بناء التقرير من النسخة المحفوظة…</section>
    : !projectId ? <section className="rounded-2xl border border-amber-200 bg-amber-50 p-8 text-center"><h1 className="text-2xl font-black text-amber-950">افتح التقرير من مشروعك</h1><Link href="/dashboard" className="mt-5 inline-flex rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white">مشاريعي</Link></section>
    : error ? <section className="rounded-2xl border border-rose-200 bg-rose-50 p-8 text-center text-rose-900">{error}</section>
    : !ready ? <section className="rounded-2xl border border-amber-200 bg-amber-50 p-8 text-center"><h1 className="text-2xl font-black text-amber-950">تقرير السيمنار غير جاهز بعد</h1><p className="mt-3 text-sm leading-7 text-amber-900">لا نصدّر تقريراً ناقصاً. أكمل واعتمد كل بوابات الرحلة الثماني أولاً.</p><Link href={`/research/journey?projectId=${encodeURIComponent(projectId)}`} className="mt-5 inline-flex rounded-xl bg-amber-300 px-5 py-3 text-sm font-bold text-amber-950">عرض المرحلة الناقصة</Link></section>
    : journey && <><header className="break-inside-avoid rounded-3xl bg-gradient-to-l from-[#0B2551] to-[#1D5FE9] p-7 text-white print:rounded-none print:border print:border-blue-900 print:bg-blue-900 print:p-6 sm:p-10"><div className="flex items-center justify-between gap-4"><div><p className="text-xs font-bold text-blue-100">WAHA · تقرير سيمنار بحثي</p><h1 className="mt-3 text-2xl font-black leading-10 sm:text-3xl">{title}</h1></div><ShieldCheck className="h-10 w-10 shrink-0 text-blue-100" /></div><div className="mt-6 grid gap-3 border-t border-white/20 pt-5 text-xs text-blue-100 sm:grid-cols-3"><p><strong className="text-white">الباحث:</strong> {journey.researcher.displayName}</p><p><strong className="text-white">التخصص:</strong> {journey.researcher.specialty || 'غير مسجل'}</p><p><strong className="text-white">تاريخ إنشاء النسخة:</strong> {generatedAt}</p></div></header>

      <div className="flex flex-wrap gap-3 print:hidden"><button type="button" onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white"><Download className="h-4 w-4" />طباعة أو حفظ PDF</button><Link href={`/research/journey?projectId=${encodeURIComponent(projectId)}`} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-bold text-slate-700"><ArrowRight className="h-4 w-4" />العودة إلى الرحلة</Link></div>

      <Section title="1. خلفية الاستكشاف ونطاق البحث"><p>{text(verify?.topic)}</p><div className="mt-4 grid gap-3 sm:grid-cols-3"><div className="rounded-xl bg-blue-50 p-4"><strong className="block text-blue-800">النتائج ذات الصلة</strong><span className="mt-1 block text-xl font-black">{typeof verify?.searchCoverage === 'object' && verify.searchCoverage ? text((verify.searchCoverage as Record<string, unknown>).uniqueStudies) || String((verify.searchCoverage as Record<string, unknown>).uniqueStudies || '—') : '—'}</span></div><div className="rounded-xl bg-blue-50 p-4"><strong className="block text-blue-800">قرار المرحلة</strong><span className="mt-1 block">قابل للمتابعة وفق البوابات الحالية</span></div><div className="rounded-xl bg-blue-50 p-4"><strong className="block text-blue-800">حد التغطية</strong><span className="mt-1 block">فهارس أكاديمية موثوقة ضمن الفحص المحفوظ</span></div></div></Section>

      <Section title="2. مشكلة البحث والفجوة"><div className="space-y-4"><div><strong>مشكلة البحث:</strong><p>{text(problem?.problemStatement)}</p></div><div><strong>الفجوة المحتملة:</strong><p>{text(problem?.researchGap)}</p></div><div className="rounded-xl border border-blue-100 bg-blue-50 p-4"><strong>صوت الباحث وسبب الاختيار:</strong><p>{text(problem?.researcherNote)}</p></div></div></Section>

      <Section title="3. الأهداف وأسئلة البحث"><div className="overflow-x-auto"><table className="w-full min-w-[620px] border-collapse text-right"><thead><tr className="bg-slate-100"><th className="border border-slate-300 p-3">#</th><th className="border border-slate-300 p-3">الهدف المعتمد</th><th className="border border-slate-300 p-3">السؤال المقابل</th></tr></thead><tbody>{objectives.map((objective, index) => <tr key={`${index}-${objective}`}><td className="border border-slate-300 p-3 font-bold">{index + 1}</td><td className="border border-slate-300 p-3">{objective}</td><td className="border border-slate-300 p-3">{questions[index] || '—'}</td></tr>)}</tbody></table></div></Section>

      <Section title="4. التصميم المنهجي"><dl className="grid gap-4 sm:grid-cols-2"><div className="rounded-xl bg-slate-50 p-4"><dt className="font-black">المنهج</dt><dd>{({ quantitative: 'كمي', qualitative: 'نوعي', mixed: 'مختلط', descriptive: 'وصفي/تحليلي' } as Record<string, string>)[text(methodology?.approach)] || text(methodology?.approach)}</dd></div><div className="rounded-xl bg-slate-50 p-4"><dt className="font-black">مجتمع الدراسة</dt><dd>{text(methodology?.population)}</dd></div><div className="rounded-xl bg-slate-50 p-4"><dt className="font-black">العينة المقترحة</dt><dd>{text(methodology?.sample)}</dd></div><div className="rounded-xl bg-slate-50 p-4"><dt className="font-black">أداة جمع البيانات</dt><dd>{text(methodology?.instrument)}</dd></div></dl><p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">هذه صياغة تصميمية أولية معتمدة من الباحث، وليست تنفيذاً للتحليل الإحصائي ولا بديلاً عن مراجعة المشرف أو لجنة الأخلاقيات.</p></Section>

      <Section title={`5. مصفوفة الأدلة المختارة (${papers.length})`}><div className="overflow-x-auto"><table className="w-full min-w-[760px] border-collapse text-right text-xs"><thead><tr className="bg-slate-100"><th className="border border-slate-300 p-3">الدراسة</th><th className="border border-slate-300 p-3">المؤلفون</th><th className="border border-slate-300 p-3">السنة</th><th className="border border-slate-300 p-3">حالة السجل</th><th className="border border-slate-300 p-3">الاستشهادات المسجلة</th></tr></thead><tbody>{papers.map((paper) => <tr key={paper.id}><td className="border border-slate-300 p-3 font-bold">{paper.pdfUrl ? <a href={paper.pdfUrl} target="_blank" rel="noopener noreferrer" className="text-blue-700 underline">{paper.title}</a> : paper.title}</td><td className="border border-slate-300 p-3">{paper.authors || 'غير متاح'}</td><td className="border border-slate-300 p-3">{paper.year || 'د.ت'}</td><td className="border border-slate-300 p-3">سجل أكاديمي موثق</td><td className="border border-slate-300 p-3">{paper.citationCount ?? 'غير متاح'}</td></tr>)}</tbody></table></div></Section>

      <Section title="6. التخليق الأكاديمي المسند"><p>{analysis?.thematicSynthesis}</p><div className="mt-4 space-y-4">{analysis?.themes?.map((theme) => <article key={`${theme.title}-${theme.supportingPaperIds.join('-')}`} className="rounded-xl border border-slate-200 bg-slate-50 p-4"><h3 className="font-black">{theme.title}</h3><p className="mt-2">{theme.synthesis}</p><p className="mt-2 text-xs text-blue-700">المصادر المسندة: {theme.supportingPaperIds.map((id) => papers.find((paper) => paper.id === id)?.title || id).join('؛ ')}</p></article>)}</div></Section>

      <Section title="7. الفجوات المستنتجة والقيود"><div className="grid gap-5 sm:grid-cols-2"><div><h3 className="font-black text-amber-900">[استنتاجات تحتاج تحققاً]</h3><ul className="mt-2 space-y-2">{analysis?.researchGapsIdentified?.map((gap) => <li key={gap}>• {gap}</li>)}</ul></div><div><h3 className="font-black text-slate-800">حدود التقرير</h3><ul className="mt-2 space-y-2">{analysis?.limitations?.map((limitation) => <li key={limitation}>• {limitation}</li>)}</ul></div></div></Section>

      <Section title="8. خلاصة الجاهزية"><p>{analysis?.conclusion}</p><div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900"><strong>الجاهزية:</strong> اكتملت بوابات بناء المقترح الأساسية. يبقى اعتماد المشرف/اللجنة، مراجعة النصوص الكاملة، الموافقات الأخلاقية عند الحاجة، وتنفيذ جمع البيانات والتحليل من الباحث والجهة الأكاديمية.</div></Section>

      <footer className="border-t border-slate-300 py-5 text-center text-xs leading-6 text-slate-500">أُنشئ هذا التقرير من المخرجات المحفوظة في مشروع WAHA. لا يثبت الجدة المطلقة، ولا يستبدل قراءة المصادر الأصلية أو التحكيم الأكاديمي.</footer></>}
  </main></div>;
}
