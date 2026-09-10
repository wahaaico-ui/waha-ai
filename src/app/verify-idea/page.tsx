'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import JourneyProgress from '@/components/JourneyProgress';
import SiteHeader from '@/components/SiteHeader';
import AuthGate from '@/components/AuthGate';
import { saveJourneyStage } from '@/lib/research-journey';
import type { ResearchPath, ResearchScenario, VerifyReport } from '@/lib/research-exploration';
import { useAuthSession } from '@/components/AuthSessionProvider';

// ============================================================
// TYPES (mirror API response)
// ============================================================
interface HistoryItem {
  id: string;
  topic: string;
  acceptance_score: number;
  decision: string;
  total_papers: number;
  created_at: string;
}

interface JourneySnapshot {
  topic: string;
  decision: VerifyReport['decision'];
  acceptanceScore: number;
  completedStage: 'idea';
  nextStage: 'title' | null;
  updatedAt: string;
  selectedResearchPath: ResearchPath;
}

const JOURNEY_SNAPSHOT_KEY = 'waha_active_journey';

const RESEARCH_SCENARIOS: Array<{ id: ResearchScenario; title: string; description: string }> = [
  { id: 'uncertain', title: 'ما زلت أستكشف', description: 'لدي مجال اهتمام، لكن لا أملك فكرة أو عنواناً واضحاً.' },
  { id: 'idea', title: 'لدي فكرة أولية', description: 'أريد معرفة ما بُحث حولها وكيف يمكن تطويرها.' },
  { id: 'rejected_title', title: 'عنواني رُفض', description: 'أريد فهم سبب الرفض واقتراح مسار أدق.' },
  { id: 'compare_titles', title: 'أقارن بين عناوين', description: 'أريد معرفة أي عنوان أوضح وأغنى بالأدلة.' },
  { id: 'references_only', title: 'أبحث عن مراجع', description: 'لدي موضوع أو عنوان وأريد الدراسات المرتبطة به فقط.' },
];

// ============================================================
// COUNTRY CODE → ARABIC NAME (top ones only)
// ============================================================
const COUNTRY_NAMES: { [code: string]: string } = {
  US: 'الولايات المتحدة', GB: 'بريطانيا', DE: 'ألمانيا', FR: 'فرنسا',
  CN: 'الصين', JP: 'اليابان', IN: 'الهند', BR: 'البرازيل',
  SA: 'السعودية', EG: 'مصر', JO: 'الأردن', AE: 'الإمارات',
  KW: 'الكويت', OM: 'عمان', QA: 'قطر', BH: 'البحرين',
  LB: 'لبنان', IQ: 'العراق', MA: 'المغرب', DZ: 'الجزائر', TN: 'تونس',
  TR: 'تركيا', ES: 'إسبانيا', IT: 'إيطاليا', CA: 'كندا', AU: 'أستراليا',
  NL: 'هولندا', SE: 'السويد', CH: 'سويسرا', BE: 'بلجيكا',
  MY: 'ماليزيا', ID: 'إندونيسيا', PK: 'باكستان', IR: 'إيران',
  KR: 'كوريا الجنوبية', RU: 'روسيا', MX: 'المكسيك', ZA: 'جنوب أفريقيا',
};

function countryName(code: string): string {
  if (COUNTRY_NAMES[code]) return COUNTRY_NAMES[code];
  try {
    return new Intl.DisplayNames(['ar'], { type: 'region' }).of(code.toUpperCase()) || code;
  } catch {
    return code;
  }
}

// ============================================================
// UI HELPERS
// ============================================================
function decisionColor(d: string): string {
  if (d === 'proceed') return 'from-emerald-500 to-teal-600';
  if (d === 'improve') return 'from-amber-500 to-orange-600';
  return 'from-rose-500 to-red-600';
}

function decisionLabel(d: string): string {
  if (d === 'proceed') return '✓ مسار بحثي قابل للتطوير';
  if (d === 'improve') return '⚠ المسار يحتاج تضييقاً أو إعادة صياغة';
  return '✗ الصياغة الحالية لا تكفي لاتخاذ قرار بحثي';
}

function scoreBarColor(score: number): string {
  if (score >= 60) return 'bg-emerald-500';
  if (score >= 30) return 'bg-amber-500';
  return 'bg-rose-500';
}

function EvidenceBadge({ kind }: { kind: 'verified' | 'inference' | 'suggestion' }) {
  const config = {
    verified: { label: 'موثق من النتائج', className: 'border-blue-200 bg-blue-50 text-blue-700' },
    inference: { label: 'استنتاج أولي', className: 'border-amber-200 bg-amber-50 text-amber-700' },
    suggestion: { label: 'اقتراح للتفكير', className: 'border-violet-200 bg-violet-50 text-violet-700' },
  }[kind];
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-bold ${config.className}`}>{config.label}</span>;
}

function VerificationHistory({ items, onReuse }: { items: HistoryItem[]; onReuse: (topic: string) => void }) {
  if (items.length === 0) return null;
  return <section id="verification-history" className="scroll-mt-24 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <div className="mb-3 flex items-center justify-between gap-3">
      <div><h2 className="text-sm font-black text-slate-900">استكشافاتك السابقة</h2><p className="mt-1 text-xs text-slate-500">للمراجعة أو إعادة استخدام الفكرة في فحص جديد.</p></div>
      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">{items.length} نتيجة</span>
    </div>
    <div className="space-y-2">
      {items.slice(0, 5).map((item) => {
        const label = item.decision === 'proceed' ? 'قابل للتطوير' : item.decision === 'improve' ? 'يحتاج تحسيناً' : 'يحتاج إعادة صياغة';
        const badge = item.decision === 'proceed' ? 'bg-emerald-50 text-emerald-700' : item.decision === 'improve' ? 'bg-amber-50 text-amber-700' : 'bg-rose-50 text-rose-700';
        const date = new Date(item.created_at).toLocaleDateString('ar', { day: 'numeric', month: 'short', year: 'numeric' });
        return <button key={item.id} type="button" onClick={() => onReuse(item.topic)} className="w-full rounded-xl border border-slate-200 p-3 text-right transition hover:border-blue-300 hover:bg-blue-50/40">
          <div className="flex flex-wrap items-center justify-between gap-2"><span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${badge}`}>{label}</span><span className="text-[11px] text-slate-500">{date} · {item.total_papers} دراسة مرتبطة</span></div>
          <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-700">{item.topic}</p>
          <span className="mt-2 inline-block text-xs font-bold text-blue-700">استخدمها في فحص جديد ↑</span>
        </button>;
      })}
    </div>
  </section>;
}

// ============================================================
// MAIN PAGE
// ============================================================
export default function VerifyIdeaPage() {
  const [scenario, setScenario] = useState<ResearchScenario>('idea');
  const [topic, setTopic] = useState(() => {
    if (typeof window === 'undefined') return '';
    return new URLSearchParams(window.location.search).get('idea')?.trim() || '';
  });
  const [candidateTitles, setCandidateTitles] = useState(['', '']);
  const [rejectionFeedback, setRejectionFeedback] = useState('');
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<VerifyReport | null>(null);
  const [error, setError] = useState('');
  const { user, isAuthenticated, authResolved } = useAuthSession();
  const [projectId, setProjectId] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'local' | 'cloud'>('idle');
  const [selectedPathId, setSelectedPathId] = useState<string | null>(null);
  const [adoptingPath, setAdoptingPath] = useState(false);

  const [history, setHistory] = useState<HistoryItem[]>([]);

  useEffect(() => {
    if (!authResolved || !isAuthenticated) {
      return;
    }
    fetch('/api/verify-idea/history')
      .then(r => r.json())
      .then(d => setHistory(d.items || []))
      .catch(() => {});
  }, [authResolved, isAuthenticated, report]); // Refresh after each new verification

  const saveJourney = async (verification: VerifyReport, serverProjectId: string | null, selectedResearchPath: ResearchPath) => {
    const snapshot: JourneySnapshot = {
      topic: verification.topic,
      decision: verification.decision,
      acceptanceScore: verification.acceptanceScore,
      completedStage: 'idea',
      nextStage: verification.decision === 'proceed' ? 'title' : null,
      updatedAt: new Date().toISOString(),
      selectedResearchPath,
    };

    if (!user) {
      localStorage.setItem(JOURNEY_SNAPSHOT_KEY, JSON.stringify(snapshot));
      setSaveStatus('local');
      return;
    }
    if (!serverProjectId) {
      setSaveStatus('idle');
      setError('ظهرت النتيجة، لكن تعذر إنشاء مشروعك المحمي. أعد المحاولة قبل الانتقال إلى المرحلة التالية.');
      return;
    }

    localStorage.removeItem(JOURNEY_SNAPSHOT_KEY);

    try {
      const researchPaths = verification.researchPaths.some((path) => path.id === selectedResearchPath.id)
        ? verification.researchPaths
        : [...verification.researchPaths, selectedResearchPath];
      await saveJourneyStage(serverProjectId, 'verify', {
        topic: verification.topic,
        decision: verification.decision,
        acceptanceScore: verification.acceptanceScore,
        gaps: verification.gaps,
        sources: verification.topPapers,
        searchCoverage: verification.searchCoverage,
        researcherContext: verification.researcherContext,
        contextMatch: verification.contextMatch,
        researchPaths,
        selectedResearchPath,
        researcherInput: verification.researcherInput,
        evidenceLimitations: verification.evidenceLimitations,
      });
      setProjectId(serverProjectId);
      setSaveStatus('cloud');
    } catch (reason) {
      setSaveStatus('idle');
      setError(reason instanceof Error ? reason.message : 'تعذر حفظ الاستكشاف داخل المشروع.');
    }
  };

  const adoptResearchPath = async (path: ResearchPath) => {
    if (!report || report.decision !== 'proceed') return;
    setAdoptingPath(true);
    setError('');
    setSelectedPathId(path.id);
    try {
      await saveJourney(report, projectId, path);
    } finally {
      setAdoptingPath(false);
    }
  };

  const handleVerify = async () => {
    if (!topic.trim() || topic.trim().length < 5) {
      setError('اكتب موضوعاً بحثياً واضحاً (5 أحرف على الأقل)');
      return;
    }
    const normalizedTitles = candidateTitles.map((title) => title.trim()).filter(Boolean);
    if (scenario === 'compare_titles' && (normalizedTitles.length < 2 || normalizedTitles.some((title) => title.length < 10))) {
      setError('اكتب عنوانين واضحين على الأقل، لا يقل كل عنوان عن 10 أحرف.');
      return;
    }
    if (scenario === 'rejected_title' && rejectionFeedback.trim().length < 5) {
      setError('اكتب ملاحظة المشرف أو سبب رفض العنوان كما فهمته.');
      return;
    }
    setError('');
    setReport(null);
    setSelectedPathId(null);
    setSaveStatus('idle');
    setProjectId(null);
    setLoading(true);
    try {
      const res = await fetch('/api/verify-idea', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: topic.trim(),
          scenario,
          candidateTitles: normalizedTitles,
          rejectionFeedback: rejectionFeedback.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'حدث خطأ. حاول مرة أخرى.');
        setLoading(false);
        return;
      }
      const serverProjectId = data.usageInfo?.projectId || null;
      setProjectId(serverProjectId);
      setReport(data);
    } catch {
      setError('تعذّر الاتصال بالخادم. تحقق من الإنترنت وحاول مجدداً.');
    } finally {
      setLoading(false);
    }
  };

  const maxYearCount = report ? Math.max(...report.yearDistribution.map(y => y.count), 1) : 1;

  return (
    <div dir="rtl" className="min-h-screen bg-[#f8fafc] text-slate-900">
      <SiteHeader />
      {authResolved && !isAuthenticated && <aside className="border-b border-blue-200 bg-blue-50 px-4 py-3 text-center text-sm leading-7 text-blue-950"><strong>يمكنك تجربة الاستكشاف مجاناً.</strong> يلزم حساب مجاني قبل اعتماد المسار وحفظه والانتقال إلى بقية مراحل البحث. <Link href="/signup" className="font-black text-blue-700 underline">إنشاء حساب</Link> أو <Link href="/login" className="font-black text-blue-700 underline">تسجيل الدخول</Link>.</aside>}
      <JourneyProgress current="verify" lang="ar" />
      <div className="max-w-4xl mx-auto px-6 py-12">
        {/* HEADER */}
        <div className="mb-10 text-center">
          <div className="inline-block px-4 py-1 rounded-full bg-teal-50 border border-teal-200 text-teal-700 text-sm font-semibold mb-4">
            المرحلة 1 · قبل صياغة العنوان
          </div>
          <h1 className="text-4xl font-bold text-slate-800 mb-3">
            استكشاف المسار البحثي والفجوة
          </h1>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
            اكتب ما لديك كما هو: اهتمام عام، فكرة أولية، عنوان مقترح، أو ملاحظة من المشرف.
            نقرأ الأدبيات المرتبطة لنوضح ما بُحث، وأين، وما الزاوية القابلة للتطوير.
          </p>
        </div>

        {/* INPUT */}
        <div id="new-exploration" className="mb-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <fieldset className="mb-6">
            <legend className="mb-3 text-sm font-bold text-slate-800">أين أنت الآن؟</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              {RESEARCH_SCENARIOS.map((option) => {
                const active = scenario === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setScenario(option.id)}
                    className={`rounded-xl border p-4 text-right transition ${active ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-100' : 'border-slate-200 bg-white hover:border-blue-200'}`}
                  >
                    <span className={`block text-sm font-black ${active ? 'text-blue-800' : 'text-slate-800'}`}>{option.title}</span>
                    <span className="mt-1 block text-xs leading-5 text-slate-500">{option.description}</span>
                  </button>
                );
              })}
            </div>
          </fieldset>
          <label htmlFor="research-topic" className="block text-sm font-semibold text-slate-700 mb-2">
            {scenario === 'uncertain' ? 'ما المجال أو المشكلة التي تهمك؟' : scenario === 'compare_titles' ? 'ما الموضوع المشترك بين العناوين؟' : scenario === 'references_only' ? 'ما الموضوع أو العنوان الذي تريد مراجع له؟' : 'ما الذي تفكر في بحثه؟'}
          </label>
          <textarea
            id="research-topic"
            value={topic}
            onChange={(e) => { setTopic(e.target.value); setError(''); }}
            placeholder={scenario === 'references_only' ? 'اكتب الموضوع أو العنوان كما هو للبحث عن الأدلة المرتبطة به' : 'مثال: عنواني رُفض، وأفكر في أثر الذكاء الاصطناعي على تعلم اللغة العربية لدى طلبة الجامعات'}
            className="w-full min-h-[100px] px-4 py-3 rounded-xl border border-slate-300 focus:border-teal-500 focus:ring-2 focus:ring-teal-100 outline-none text-slate-800 text-lg resize-none"
            disabled={loading}
          />
          {scenario === 'rejected_title' && (
            <div className="mt-4">
              <label htmlFor="rejection-feedback" className="mb-2 block text-sm font-semibold text-slate-700">ما ملاحظة المشرف أو سبب الرفض؟</label>
              <textarea id="rejection-feedback" value={rejectionFeedback} onChange={(event) => setRejectionFeedback(event.target.value)} placeholder="مثال: العنوان واسع، المتغيرات غير واضحة، أو لا توجد فجوة محددة" className="min-h-24 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" disabled={loading} />
            </div>
          )}
          {scenario === 'compare_titles' && (
            <div className="mt-4 space-y-3">
              <div className="text-sm font-semibold text-slate-700">العناوين التي تريد مقارنتها</div>
              {candidateTitles.map((title, index) => (
                <label key={index} className="block">
                  <span className="sr-only">العنوان {index + 1}</span>
                  <input value={title} onChange={(event) => setCandidateTitles((current) => current.map((item, itemIndex) => itemIndex === index ? event.target.value : item))} placeholder={`العنوان ${index + 1}`} className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" disabled={loading} />
                </label>
              ))}
              {candidateTitles.length < 4 && <button type="button" onClick={() => setCandidateTitles((current) => [...current, ''])} className="text-xs font-bold text-blue-700">+ إضافة عنوان آخر</button>}
              <p className="text-xs leading-5 text-slate-500">سنحفظ هذه العناوين داخل المشروع لتظهر في خطوة المقارنة التفصيلية، ولن نختار نيابة عنك.</p>
            </div>
          )}
          {error && (
            <div role="alert" className="mt-3 px-4 py-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-sm">
              {error}
            </div>
          )}
          <button
            onClick={handleVerify}
            disabled={loading || !topic.trim()}
            className="mt-4 w-full py-3 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 text-white font-semibold text-lg hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            {loading ? 'جارٍ تحليل المسار البحثي...' : 'حلّل المسار البحثي'}
          </button>
          <p className="mt-3 text-xs text-slate-500 text-center">
            قد يستغرق التحليل 10–20 ثانية
          </p>
          {isAuthenticated && history.length > 0 && topic.trim() && !loading && !report && <button type="button" onClick={() => document.getElementById('verification-history')?.scrollIntoView({ behavior: 'smooth', block: 'start' })} className="mx-auto mt-4 flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-xs font-bold text-blue-700"><span className="animate-bounce" aria-hidden="true">↓</span> لديك {history.length} استكشافات سابقة أسفل الفحص</button>}
        </div>

        {isAuthenticated && !report && !loading && <VerificationHistory items={history} onReuse={(previousTopic) => {
          setTopic(previousTopic);
          setError('');
          document.getElementById('new-exploration')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }} />}

        {/* LOADING STATE */}
        {loading && (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center">
            <div className="inline-block w-12 h-12 border-4 border-teal-200 border-t-teal-600 rounded-full animate-spin mb-4"></div>
            <p className="text-slate-600">نحلل الأدبيات والسياقات المرتبطة بما كتبته…</p>
          </div>
        )}

        {/* REPORT */}
        {report && !loading && (() => {
          const usage = report.usageInfo;
          const showBlur = !isAuthenticated && usage?.isBlurred;
          const showBlock = !isAuthenticated && usage?.isBlocked;
          const searchedAt = new Date(report.searchCoverage.searchedAt).toLocaleString('ar', { dateStyle: 'medium', timeStyle: 'short' });
          const referencesOnly = report.researcherInput.scenario === 'references_only';
          const comparisonScenario = report.researcherInput.scenario === 'compare_titles';
          const providedTitlesPath: ResearchPath = {
            id: 'provided-title-comparison',
            title: 'مقارنة العناوين التي قدّمها الباحث',
            rationale: 'هذا الاتجاه يحفظ العناوين المدخلة كما هي لقياس وضوحها وغنى أدلتها قبل اعتماد أحدها.',
            evidenceLevel: 'suggestion',
            supportingReferences: report.topPapers.slice(0, 3).map((paper) => ({ title: paper.title, year: paper.year, url: paper.url })),
          };
          return (
            <div className="relative">
              {showBlock && <AuthGate variant="block" />}
              {showBlur && !showBlock && <AuthGate variant="blur" />}
              <div className={(showBlur || showBlock) ? "blur-sm pointer-events-none select-none space-y-6" : "space-y-6"}>

            {/* DECISION BANNER */}
            <div className={`bg-gradient-to-r ${decisionColor(report.decision)} rounded-2xl p-6 text-white shadow-md`}>
              <div className="flex items-center justify-between mb-3">
                <div className="text-3xl font-bold">{report.acceptanceScore}<span className="text-xl opacity-70">/100</span></div>
                <div className="text-sm opacity-80">مؤشر استدلالي لقابلية تطوير المسار</div>
              </div>
              <div className="text-lg font-semibold mb-2">{decisionLabel(report.decision)}</div>
              <div className="text-sm opacity-95 leading-relaxed">{report.decisionMessage}</div>
            </div>

            {/* PLAIN-LANGUAGE OUTCOME */}
            <div className="rounded-2xl border border-blue-200 bg-blue-50 p-6">
              <h3 className="text-lg font-black text-slate-900">ماذا تعني هذه النتيجة؟</h3>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <div className="rounded-xl bg-white p-4">
                  <div className="text-2xl font-black text-blue-700">{report.totalPapers}</div>
                  <p className="mt-1 text-sm leading-6 text-slate-600">دراسة قريبة ظهرت ضمن نطاق البحث الحالي، وليست حصراً لكل ما نُشر عالمياً.</p>
                </div>
                <div className="rounded-xl bg-white p-4">
                  <div className="text-2xl font-black text-violet-700">{report.gaps.length}</div>
                  <p className="mt-1 text-sm leading-6 text-slate-600">مؤشر فجوة محتملة يحتاج مراجعة الأدلة، وليس حكماً نهائياً بأن الموضوع لم يُبحث.</p>
                </div>
                <div className="rounded-xl bg-white p-4">
                  <div className="font-black text-slate-900">خطوتك الآن</div>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    {referencesOnly
                      ? 'راجع قائمة الدراسات أدناه، وافتح الدراسة الأصلية قبل الاستشهاد بها.'
                      : comparisonScenario
                        ? 'احفظ العناوين التي أدخلتها، ثم انتقل مباشرة إلى مقارنة الوضوح والأدلة.'
                      : report.decision === 'proceed'
                      ? 'اختر اتجاه تطوير واحداً أدناه؛ بعدها نصوغ عناوين أكاديمية متسقة معه.'
                      : 'راجع التحسينات المقترحة، عدّل فكرتك، ثم أعد التحليل قبل الانتقال.'}
                  </p>
                </div>
              </div>
            </div>

            <details className="group rounded-2xl border border-slate-200 bg-white p-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-bold text-slate-800">
                <span>عرض التفاصيل الرقمية ومنهج قراءة النتيجة</span>
                <span className="text-blue-600 transition group-open:rotate-180" aria-hidden="true">⌄</span>
              </summary>
              <p className="mt-2 text-xs leading-6 text-slate-500">هذه التفاصيل مفيدة للباحث المتقدم، ولا تحتاجها لاتخاذ الخطوة التالية.</p>
              <div className="mt-5 space-y-6">

            {/* SEARCH COVERAGE — factual and bounded */}
            <div className="rounded-2xl border border-blue-200 bg-white p-6">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-bold text-slate-900">نطاق البحث الذي نُفّذ</h3>
                  <p className="mt-1 text-xs text-slate-500">آخر بحث: {searchedAt}</p>
                </div>
                <EvidenceBadge kind="verified" />
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-xl bg-slate-50 p-3"><div className="text-2xl font-black text-slate-900">{report.searchCoverage.queryCount}</div><div className="mt-1 text-xs text-slate-600">صياغات بحثية استُخدمت</div></div>
                <div className="rounded-xl bg-slate-50 p-3"><div className="text-2xl font-black text-slate-900">{report.searchCoverage.uniqueStudies}</div><div className="mt-1 text-xs text-slate-600">نتيجة فريدة بعد إزالة التكرار</div></div>
                <div className="rounded-xl bg-blue-50 p-3"><div className="text-2xl font-black text-blue-700">{report.totalPapers}</div><div className="mt-1 text-xs text-blue-800">دراسة أقرب إلى موضوعك</div></div>
                <div className="rounded-xl bg-blue-50 p-3"><div className="text-2xl font-black text-blue-700">{report.yearDistribution.length}</div><div className="mt-1 text-xs text-blue-800">سنوات نشر ممثلة في النتائج</div></div>
              </div>
              {report.searchCoverage.excludedByRelevance > 0 && <p className="mt-3 text-xs text-slate-500">فُحصت {report.searchCoverage.candidateResults} نتيجة مرشحة، واستُبعدت {report.searchCoverage.excludedByRelevance} نتيجة ضعيفة الصلة قبل بناء التقرير.</p>}
              <p className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs leading-6 text-slate-600">{report.searchCoverage.scopeNote}</p>
            </div>

            {/* RESEARCHER CONTEXT */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <h3 className="font-bold text-slate-900">مدى قرب النتائج من سياقك البحثي</h3>
                <EvidenceBadge kind="inference" />
              </div>
              {report.researcherContext.countryName ? (
                <div className="grid gap-4 md:grid-cols-[180px_1fr]">
                  <div className="rounded-xl bg-blue-50 p-4 text-center">
                    <div className="text-3xl font-black text-blue-700">{report.contextMatch.localAffiliationMatches}</div>
                    <div className="mt-1 text-xs leading-5 text-blue-800">نتيجة مرتبطة بمؤلفين من مؤسسات في {report.researcherContext.countryName}</div>
                  </div>
                  <div className="space-y-2 text-sm leading-7 text-slate-700">
                    <p><strong>الدولة:</strong> {report.researcherContext.countryName}</p>
                    {report.researcherContext.specialty && <p><strong>التخصص:</strong> {report.researcherContext.specialty}</p>}
                    {report.researcherContext.university && <p><strong>المؤسسة:</strong> {report.researcherContext.university}</p>}
                    <p className="text-xs text-slate-500">{report.contextMatch.note}</p>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-7 text-amber-900">
                  {report.contextMatch.note} أكمل الدولة والتخصص في ملفك لاحقاً لتحصل على قراءة أقرب إلى بيئتك البحثية.
                </div>
              )}
            </div>

            {/* SCORE BREAKDOWN */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h3 className="font-bold text-slate-800">تفصيل مؤشر المسار (حساب شفاف)</h3><EvidenceBadge kind="inference" /></div>
              <div className="space-y-3">
                {[
                  { label: 'مؤشر أولي على فجوة محتملة', value: report.scoreBreakdown.gapExists, max: 25 },
                  { label: 'حداثة الاهتمام البحثي', value: report.scoreBreakdown.recency, max: 20 },
                  { label: 'تنوع المنهجيات المستخدمة', value: report.scoreBreakdown.methodDiversity, max: 20 },
                  { label: 'تنوع السياقات الجغرافية', value: report.scoreBreakdown.geoDiversity, max: 15 },
                  { label: 'كفاية عدد الدراسات المرجعية', value: report.scoreBreakdown.sufficientRefs, max: 10 },
                  { label: 'الاتساق الداخلي للأدبيات', value: report.scoreBreakdown.consistency, max: 10 },
                ].map((item) => (
                  <div key={item.label}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-slate-700">{item.label}</span>
                      <span className="font-semibold text-slate-800">{item.value} / {item.max}</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2">
                      <div className={`h-2 rounded-full ${scoreBarColor((item.value / item.max) * 100)}`} style={{ width: `${(item.value / item.max) * 100}%` }}></div>
                    </div>
                  </div>
                ))}
              </div>
              {report.methodologyDistribution.length > 0 && (
                <div className="mt-5 border-t border-slate-200 pt-4">
                  <div className="flex flex-wrap gap-2">{report.methodologyDistribution.map((method) => <span key={method.type} className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs text-slate-700">{method.type}: {method.count}</span>)}</div>
                  <p className="mt-3 text-xs leading-6 text-slate-500">{report.methodologyNote}</p>
                </div>
              )}
            </div>

            {/* STATS OVERVIEW */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white rounded-2xl border border-slate-200 p-5 text-center">
                <div className="text-3xl font-bold text-teal-600">{report.totalPapers}</div>
                <div className="text-sm text-slate-600 mt-1">نتيجة فريدة في نطاق البحث الحالي</div>
              </div>
              <div className="bg-white rounded-2xl border border-slate-200 p-5 text-center">
                <div className="text-3xl font-bold text-blue-600">{report.geographicDistribution.length}</div>
                <div className="text-sm text-slate-600 mt-1">دولة ظهرت في انتماءات المؤلفين</div>
              </div>
              <div className="bg-white rounded-2xl border border-slate-200 p-5 text-center">
                <div className="text-3xl font-bold text-purple-600">{report.gaps.length}</div>
                <div className="text-sm text-slate-600 mt-1">مؤشر يحتاج تحققاً أعمق</div>
              </div>
            </div>

              </div>
            </details>

            {/* GAPS */}
            {report.gaps.length > 0 && (
              <div className="bg-white rounded-2xl border border-slate-200 p-6">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h3 className="font-bold text-slate-800">مؤشرات فجوة محتملة</h3><EvidenceBadge kind="inference" /></div>
                <ul className="space-y-2">
                  {report.gaps.map((g, i) => (
                    <li key={i} className="flex gap-3 text-slate-700">
                      <span className="text-teal-600 font-bold flex-shrink-0">◆</span>
                      <span>{g}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* ALTERNATIVE ANGLES (if rejected) */}
            {report.alternativeAngles && report.alternativeAngles.length > 0 && (
              <div className="bg-rose-50 border-2 border-rose-200 rounded-2xl p-6">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h3 className="font-bold text-rose-800">زوايا بديلة مقترحة</h3><EvidenceBadge kind="suggestion" /></div>
                <ol className="space-y-3">
                  {report.alternativeAngles.map((a, i) => (
                    <li key={i} className="flex gap-3">
                      <span className="flex-shrink-0 w-7 h-7 rounded-full bg-rose-600 text-white text-sm font-bold flex items-center justify-center">{i + 1}</span>
                      <span className="text-rose-900 leading-relaxed">{a}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {/* IMPROVEMENTS (if middle score) */}
            {report.improvements && report.improvements.length > 0 && (
              <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-6">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h3 className="font-bold text-amber-800">تحسينات مقترحة قبل الاعتماد</h3><EvidenceBadge kind="suggestion" /></div>
                <ol className="space-y-3">
                  {report.improvements.map((imp, i) => (
                    <li key={i} className="flex gap-3">
                      <span className="flex-shrink-0 w-7 h-7 rounded-full bg-amber-600 text-white text-sm font-bold flex items-center justify-center">{i + 1}</span>
                      <span className="text-amber-900 leading-relaxed">{imp}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {/* GROUNDED RESEARCH PATHS */}
            {!referencesOnly && !comparisonScenario && report.researchPaths.length > 0 && (
              <div id="research-paths" className="scroll-mt-24 rounded-2xl border border-violet-200 bg-white p-6">
                <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                  <div><h3 className="font-bold text-slate-900">اتجاهات لتطوير فكرتك</h3><p className="mt-1 text-xs leading-6 text-slate-500">كل اتجاه يغيّر زاوية الدراسة أو سياقها، وليس عنواناً نهائياً. اختر الأنسب، ثم نقترح عناوين أكاديمية متسقة معه.</p></div>
                  <EvidenceBadge kind="suggestion" />
                </div>
                <div className="space-y-4">
                  {report.researchPaths.map((path, index) => {
                    const selected = selectedPathId === path.id;
                    return (
                    <article key={path.id} className={`rounded-xl border p-4 transition ${selected ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-100' : 'border-slate-200'}`}>
                      <div className="flex gap-3"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-violet-600 text-sm font-black text-white">{index + 1}</span><div><h4 className="font-bold leading-7 text-slate-900">{path.title}</h4><p className="mt-1 text-sm leading-7 text-slate-600">{path.rationale}</p></div></div>
                      {path.supportingReferences.length > 0 && (
                        <div className="mt-3 border-t border-slate-100 pt-3">
                          <div className="mb-2 text-xs font-bold text-slate-500">مراجع مرتبطة بهذا المسار</div>
                          <ul className="space-y-1.5 text-xs leading-5 text-slate-600">
                            {path.supportingReferences.map((reference, referenceIndex) => (
                              <li key={`${path.id}-${reference.title}-${referenceIndex}`}>
                                {reference.url ? <a href={reference.url} target="_blank" rel="noopener noreferrer" className="text-blue-700 hover:underline">{reference.title}</a> : reference.title}
                                {reference.year > 0 && <span> ({reference.year})</span>}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {report.decision === 'proceed' && (
                        <button type="button" onClick={() => void adoptResearchPath(path)} disabled={adoptingPath} className={`mt-4 w-full rounded-xl px-4 py-3 text-sm font-bold transition disabled:opacity-50 ${selected && (saveStatus === 'cloud' || saveStatus === 'local') ? 'bg-emerald-600 text-white' : 'border border-blue-200 bg-white text-blue-700 hover:bg-blue-50'}`}>
                          {selected && adoptingPath ? 'جارٍ اعتماد الاتجاه وحفظه…' : selected && (saveStatus === 'cloud' || saveStatus === 'local') ? '✓ تم اعتماد هذا الاتجاه' : 'اعتماد هذا الاتجاه'}
                        </button>
                      )}
                    </article>
                  );})}
                </div>
              </div>
            )}

            {/* PROCEED CTA (if strong) */}
            {referencesOnly ? (
              <div className="rounded-2xl border-2 border-blue-200 bg-blue-50 p-6">
                <h3 className="font-black text-blue-950">وجدنا لك مراجع مرتبطة بالموضوع</h3>
                <p className="mt-2 text-sm leading-7 text-blue-900">هذه ليست بوابة انتقال إلى بناء البحث. راجع النتائج الأصلية أدناه، ويمكنك لاحقاً العودة واختيار «لدي فكرة أولية» إذا أردت بناء رحلة بحثية كاملة.</p>
                <button type="button" onClick={() => document.getElementById('top-papers')?.scrollIntoView({ behavior: 'smooth', block: 'start' })} className="mt-4 rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white">عرض الدراسات المرتبطة ↓</button>
              </div>
            ) : comparisonScenario ? (
              <div className="rounded-2xl border-2 border-violet-200 bg-violet-50 p-6">
                <h3 className="font-black text-violet-950">عناوينك جاهزة للمقارنة</h3>
                <p className="mt-2 text-sm leading-7 text-violet-900">لن نطلب منك اختيار اتجاه بحثي جديد؛ سننقل العناوين التي أدخلتها كما هي إلى مقارنة الأدلة والوضوح.</p>
                {saveStatus === 'cloud' && projectId ? <Link href={`/research?projectId=${projectId}`} className="mt-4 inline-flex rounded-xl bg-violet-700 px-5 py-3 text-sm font-bold text-white">انتقل إلى مقارنة عناويني ←</Link>
                  : saveStatus === 'local' ? <Link href={`/signup?redirect=${encodeURIComponent('/verify-idea')}`} className="mt-4 inline-flex rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white">أنشئ حساباً لحفظ المقارنة</Link>
                    : <button type="button" onClick={() => void adoptResearchPath(providedTitlesPath)} disabled={adoptingPath || report.decision !== 'proceed'} className="mt-4 rounded-xl bg-violet-700 px-5 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">{adoptingPath ? 'جارٍ حفظ العناوين…' : report.decision === 'proceed' ? 'حفظ العناوين ومتابعة المقارنة' : 'حسّن الصياغة وفق الملاحظات أولاً'}</button>}
              </div>
            ) : <div className={`rounded-2xl border-2 p-6 ${report.decision === 'proceed' ? 'border-emerald-300 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className={`text-sm font-bold ${report.decision === 'proceed' ? 'text-emerald-800' : 'text-amber-900'}`}>
                    {report.decision === 'proceed' && selectedPathId && (saveStatus === 'cloud' || saveStatus === 'local')
                      ? 'تم اعتماد اتجاه تطوير الفكرة'
                      : report.decision === 'proceed'
                        ? 'اختر اتجاه التطوير أولاً'
                        : 'تحتاج الفكرة إلى تحسين قبل الانتقال'}
                  </div>
                  <p className={`mt-1 text-sm leading-6 ${report.decision === 'proceed' ? 'text-emerald-700' : 'text-amber-800'}`}>
                    {report.decision !== 'proceed'
                      ? 'لا ننتقل إلى العنوان أو الأدبيات قبل معالجة الملاحظات أعلاه وإعادة فحص الفكرة.'
                      : selectedPathId && (saveStatus === 'cloud' || saveStatus === 'local')
                        ? 'حُفظ اختيارك مع الأدلة والسياق. الخطوة التالية هي صياغة عنوان أكاديمي متسق مع هذا الاتجاه.'
                        : 'راجع الاتجاهات المرتبطة بالأدلة أعلاه، ثم اختر اتجاهاً واحداً قبل الانتقال.'}
                  </p>
                  <p className="mt-2 text-xs text-slate-500">
                    {saveStatus === 'cloud' ? 'تم حفظ التقرير والاختيار داخل مشروعك.' : saveStatus === 'local' ? 'تم حفظ آخر حالة للرحلة على هذا الجهاز.' : 'لم يُعتمد مسار بعد.'}
                  </p>
                </div>
                {report.decision === 'proceed' && selectedPathId && saveStatus === 'cloud' ? (
                  <Link href={`/research?topic=${encodeURIComponent(report.topic)}${projectId ? `&projectId=${projectId}` : ''}`} className="inline-flex shrink-0 items-center justify-center rounded-xl bg-emerald-600 px-5 py-3 font-semibold text-white transition hover:bg-emerald-700">
                    انتقل إلى صياغة العنوان ←
                  </Link>
                ) : report.decision === 'proceed' && selectedPathId && saveStatus === 'local' ? (
                  <Link href={`/signup?redirect=${encodeURIComponent('/verify-idea')}`} className="inline-flex shrink-0 items-center justify-center rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white transition hover:bg-blue-700">أنشئ حساباً لحفظ المشروع والمتابعة</Link>
                ) : report.decision === 'proceed' ? (
                  <button type="button" onClick={() => document.getElementById('research-paths')?.scrollIntoView({ behavior: 'smooth', block: 'start' })} className="inline-flex shrink-0 items-center justify-center rounded-xl border border-blue-300 bg-white px-5 py-3 font-semibold text-blue-800 transition hover:bg-blue-50">
                    اختر اتجاه تطوير من القائمة أعلاه
                  </button>
                ) : (
                  <button type="button" onClick={() => document.querySelector('textarea')?.focus()} className="inline-flex shrink-0 items-center justify-center rounded-xl border border-amber-300 bg-white px-5 py-3 font-semibold text-amber-800 transition hover:bg-amber-100">
                    حسّن الفكرة وأعد الفحص
                  </button>
                )}
              </div>
            </div>}

            {/* YEAR DISTRIBUTION */}
            {report.yearDistribution.length > 0 && (
              <div className="bg-white rounded-2xl border border-slate-200 p-6">
                <h3 className="font-bold text-slate-800 mb-4">التوزيع الزمني للدراسات</h3>
                <div className="space-y-2">
                  {report.yearDistribution.map((y) => (
                    <div key={y.year} className="flex items-center gap-3">
                      <div className="w-14 text-sm text-slate-600 font-mono">{y.year}</div>
                      <div className="flex-1 bg-slate-100 rounded-full h-6 relative">
                        <div className="bg-gradient-to-l from-teal-500 to-emerald-500 h-6 rounded-full flex items-center justify-end pl-2" style={{ width: `${(y.count / maxYearCount) * 100}%` }}>
                          <span className="text-white text-xs font-semibold">{y.count}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* GEOGRAPHIC DISTRIBUTION */}
            {report.geographicDistribution.length > 0 && (
              <div className="bg-white rounded-2xl border border-slate-200 p-6">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-bold text-slate-800">التوزيع الجغرافي لانتماءات المؤلفين</h3><p className="mt-1 text-xs text-slate-500">لا يُعامل تلقائياً كموقع تنفيذ الدراسة الميدانية.</p></div><EvidenceBadge kind="verified" /></div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {report.geographicDistribution.map((g) => (
                    <div key={g.region} className="flex items-center justify-between px-3 py-2 bg-slate-50 rounded-lg">
                      <span className="text-slate-700 text-sm">{countryName(g.region)}</span>
                      <span className="font-semibold text-teal-600 text-sm">{g.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TOP PAPERS */}
            {report.topPapers.length > 0 && (
              <div id="top-papers" className="scroll-mt-24 bg-white rounded-2xl border border-slate-200 p-6">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h3 className="font-bold text-slate-800">أهم الدراسات المرجعية في النتائج الحالية</h3><EvidenceBadge kind="verified" /></div>
                <div className="space-y-3">
                  {report.topPapers.map((p, i) => (
                    <div key={i} className="border-r-4 border-teal-500 pr-4 py-2">
                      <div className="flex items-start justify-between gap-3 mb-1">
                        <div className="text-xs font-semibold text-teal-600">
                          دراسة أكاديمية موثقة
                          {p.year > 0 && ` · ${p.year}`}
                          {p.citations > 0 && ` · ${p.citations} استشهاد`}
                          {p.countries && p.countries.length > 0 && ` · ${p.countries.slice(0, 2).map(countryName).join('، ')}`}
                        </div>
                      </div>
                      <div className="text-slate-800 leading-relaxed mb-1">{p.title}</div>
                      {p.authors && p.authors.length > 0 && (
                        <div className="text-xs text-slate-500">{p.authors.slice(0, 3).join('، ')}{p.authors.length > 3 ? ' وآخرون' : ''}</div>
                      )}
                      {p.url && (
                        <a href={p.url} target="_blank" rel="noopener noreferrer" className="text-xs text-teal-600 hover:underline">
                          فتح الدراسة ↗
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <h3 className="font-bold text-slate-800">حدود يجب معرفتها قبل اعتماد القرار</h3>
              <ul className="mt-3 space-y-2 text-xs leading-6 text-slate-600">
                {report.evidenceLimitations.map((limitation) => <li key={limitation} className="flex gap-2"><span className="text-slate-400">•</span><span>{limitation}</span></li>)}
              </ul>
            </div>

              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
