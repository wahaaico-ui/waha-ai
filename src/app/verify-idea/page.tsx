'use client';

import { useUiTranslation } from '@/lib/use-ui-translation';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import JourneyProgress from '@/components/JourneyProgress';
import SiteHeader from '@/components/SiteHeader';
import SiteFooter from '@/components/SiteFooter';
import AuthGate from '@/components/AuthGate';
import { saveJourneyStage } from '@/lib/research-journey';
import { buildProvidedTitlesPath, type ResearchPath, type ResearchScenario, type VerifyReport } from '@/lib/research-exploration';
import { useAuthSession } from '@/components/AuthSessionProvider';
import { IdeaQuestionsAndMatrix, TopicTimingPanel } from '@/components/IdeaSelectionPanels';
import { specialtyLabel } from '@/lib/researcher-profile';
import { Check, Lightbulb, Search, MessageSquare, Copy, LibraryBig } from 'lucide-react';

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
const SCENARIO_ICONS = { uncertain: Search, idea: Lightbulb, rejected_title: MessageSquare, compare_titles: Copy, references_only: LibraryBig };

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

function countryName(code: string, language: 'ar' | 'en'): string {
  if (language === 'ar' && COUNTRY_NAMES[code]) return COUNTRY_NAMES[code];
  try {
    return new Intl.DisplayNames([language], { type: 'region' }).of(code.toUpperCase()) || code;
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
  const { text: ui } = useUiTranslation();

  const config = {
    verified: { label: 'موثق من النتائج', className: 'border-blue-200 bg-blue-50 text-blue-700' },
    inference: { label: 'استنتاج أولي', className: 'border-amber-200 bg-amber-50 text-amber-700' },
    suggestion: { label: 'اقتراح للتفكير', className: 'border-violet-200 bg-violet-50 text-violet-700' },
  }[kind];
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-bold ${config.className}`}>{ui(config.label)}</span>;
}

function VerificationHistory({ items, onReuse }: { items: HistoryItem[]; onReuse: (topic: string) => void }) {
  const { text: ui, language } = useUiTranslation();

  if (items.length === 0) return null;
  return <section id="verification-history" className="scroll-mt-24 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <div className="mb-3 flex items-center justify-between gap-3">
      <div><h2 className="text-sm font-black text-slate-900">{ui("استكشافاتك السابقة")}</h2><p className="mt-1 text-xs text-slate-500">{ui("للمراجعة أو إعادة استخدام الفكرة في فحص جديد.")}</p></div>
      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">{items.length} {ui("نتيجة")}</span>
    </div>
    <div className="space-y-2">
      {items.slice(0, 5).map((item) => {
        const label = item.decision === 'proceed' ? 'قابل للتطوير' : item.decision === 'improve' ? 'يحتاج تحسيناً' : 'يحتاج إعادة صياغة';
        const badge = item.decision === 'proceed' ? 'bg-emerald-50 text-emerald-700' : item.decision === 'improve' ? 'bg-amber-50 text-amber-700' : 'bg-rose-50 text-rose-700';
        const date = new Date(item.created_at).toLocaleDateString(language, { day: 'numeric', month: 'short', year: 'numeric' });
        return <button key={item.id} type="button" onClick={() => onReuse(item.topic)} className="w-full rounded-xl border border-slate-200 p-3 text-start transition hover:border-blue-300 hover:bg-blue-50/40">
          <div className="flex flex-wrap items-center justify-between gap-2"><span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${badge}`}>{ui(label)}</span><span className="text-[11px] text-slate-500">{date} · {item.total_papers} {ui("نتيجة بحث")}</span></div>
          <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-700">{item.topic}</p>
          <span className="mt-2 inline-block text-xs font-bold text-blue-700">{ui("استخدمها في فحص جديد ↑")}</span>
        </button>;
      })}
    </div>
  </section>;
}

// ============================================================
// MAIN PAGE
// ============================================================
export default function VerifyIdeaPage() {
  const { text: ui, direction: uiDirection, language: uiLanguage } = useUiTranslation();

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
  const creationId = useRef<string | null>(null);
  const [creating, setCreating] = useState(false);
  useEffect(() => {
    if (!authResolved || !isAuthenticated) return;
    const id = new URLSearchParams(window.location.search).get('projectId');
    if (!id) return;
    fetch(`/api/projects?projectId=${encodeURIComponent(id)}`, { cache: 'no-store' })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        setProjectId(data.project.id); creationId.current = data.project.id;
        setTopic((current) => current || data.project.title);
      }).catch(() => setError("تعذر تحميل مشروعك. تحقق من الجلسة وأعد تحميل الصفحة."));
  }, [authResolved, isAuthenticated]);

  const ensureProject = async () => {
    if (!isAuthenticated) return null;
    if (projectId) return projectId;
    creationId.current ||= new URLSearchParams(window.location.search).get('projectId') || crypto.randomUUID();
    // Retain the id even if the response is lost or the page reloads during creation.
    const pendingUrl = new URL(window.location.href);
    pendingUrl.searchParams.set('projectId', creationId.current);
    window.history.replaceState(null, '', pendingUrl);
    const response = await fetch('/api/projects', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectId: creationId.current, title: topic.trim() }) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'تعذر إنشاء المشروع.');
    const id = data.project.id as string;
    setProjectId(id);
    const url = new URL(window.location.href); url.searchParams.set('projectId', id);
    window.history.replaceState(null, '', url);
    return id;
  };

  const createDraft = async () => {
    setCreating(true); setError('');
    try { await ensureProject(); } catch (reason) { setError(reason instanceof Error ? reason.message : 'تعذر حفظ المشروع.'); }
    finally { setCreating(false); }
  };
  const [saveStatus, setSaveStatus] = useState<'idle' | 'local' | 'cloud'>('idle');
  const [selectedPathId, setSelectedPathId] = useState<string | null>(null);
  const [adoptingPath, setAdoptingPath] = useState(false);

  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [historyStatus, setHistoryStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [historyReloadToken, setHistoryReloadToken] = useState(0);
  const [historyOwnerId, setHistoryOwnerId] = useState<string | null>(null);
  const authenticatedUserId = user?.id || null;

  useEffect(() => {
    if (!authResolved || !isAuthenticated || !authenticatedUserId) return;
    const controller = new AbortController();
    fetch('/api/verify-idea/history', { cache: 'no-store', signal: controller.signal })
      .then(async (response) => {
        const data: unknown = await response.json();
        if (!response.ok || !data || typeof data !== 'object' || !Array.isArray((data as { items?: unknown }).items)) {
          throw new Error('Unable to load verification history');
        }
        setHistory((data as { items: HistoryItem[] }).items);
        setHistoryOwnerId(authenticatedUserId);
        setHistoryStatus('ready');
      })
      .catch((reason) => {
        if (reason instanceof DOMException && reason.name === 'AbortError') return;
        setHistoryOwnerId(authenticatedUserId);
        setHistoryStatus('error');
      });
    return () => controller.abort();
  }, [authResolved, isAuthenticated, authenticatedUserId, report, historyReloadToken]); // Refresh after each new verification

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
      setError("ظهرت النتيجة، لكن تعذر إنشاء مشروعك المحمي. أعد المحاولة قبل الانتقال إلى المرحلة التالية.");
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
      setError("اكتب موضوعاً بحثياً واضحاً (5 أحرف على الأقل)");
      return;
    }
    const normalizedTitles = candidateTitles.map((title) => title.trim()).filter(Boolean);
    if (scenario === 'compare_titles' && (normalizedTitles.length < 2 || normalizedTitles.some((title) => title.length < 10))) {
      setError("اكتب عنوانين واضحين على الأقل، لا يقل كل عنوان عن 10 أحرف.");
      return;
    }
    if (scenario === 'rejected_title' && rejectionFeedback.trim().length < 5) {
      setError("اكتب ملاحظة المشرف أو سبب رفض العنوان كما فهمته.");
      return;
    }
    setError('');
    setReport(null);
    setSelectedPathId(null);
    setSaveStatus('idle');
    setLoading(true);
    try {
      const ownedProjectId = await ensureProject();
      const res = await fetch('/api/verify-idea', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: topic.trim(),
          ...(ownedProjectId ? { projectId: ownedProjectId } : {}),
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
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'تعذّر الاتصال بالخادم. تحقق من الإنترنت وحاول مجدداً.');
    } finally {
      setLoading(false);
    }
  };

  const maxYearCount = report ? Math.max(...report.yearDistribution.map(y => y.count), 1) : 1;

  return (
    <div dir={uiDirection} className="min-h-screen bg-[#f8fafc] text-slate-900">
      <SiteHeader />
      <JourneyProgress current="verify" lang={uiLanguage} compact />
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10 lg:py-12">
        <div className="grid items-start gap-6 lg:grid-cols-[.8fr_1.2fr] lg:gap-10">
        {/* HEADER */}
        <header className="lg:sticky lg:top-28">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary-tint px-3 py-1 text-xs font-bold text-primary-dark">
            <Lightbulb className="h-3.5 w-3.5" aria-hidden="true" />
            {ui("المرحلة 1 · قبل صياغة العنوان")}</div>
          <h1 className="mb-3 text-2xl font-black leading-tight tracking-tight text-ink sm:text-4xl lg:text-[2.6rem] lg:leading-[1.35]">{ui("استكشف فكرتك بالمصادر المرتبطة بها")}</h1>
          <p className="text-sm leading-7 text-slate-600 sm:text-base">{ui("اكتب فكرتك أو عنوانك. نجمع الدراسات المرتبطة ونساعدك على تحديد خطوتك التالية.")}</p>
          <Link href="/#start" className="mt-3 inline-flex text-sm font-bold text-primary-dark underline underline-offset-4">{ui("تريد كتابة نص أو مراجعة أو مراجع فقط؟ اختر من خدمات الواحة")}</Link>
          <ul className="mt-7 hidden space-y-4 text-sm text-slate-700 lg:block">
            {['مصادر مرتبطة بفكرتك وروابطها الأصلية', 'اتجاهات بحثية تستند إلى الأدلة المتاحة', 'مساحة تحفظ عملك وتعود إليها لاحقاً'].map((label) => <li key={label} className="flex items-start gap-3"><span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-primary-tint text-primary"><Check className="h-3.5 w-3.5" aria-hidden="true" /></span>{ui(label)}</li>)}
          </ul>
          <p className="mt-6 hidden max-w-sm border-s-2 border-primary/20 ps-3 text-xs leading-6 text-slate-500 lg:block">{ui("نعتمد على السجلات والمستخلصات المتاحة. تحديد الفجوة يحتاج مراجعتك للمصادر الأصلية.")}</p>
        </header>
        <div className="min-w-0">

        {/* INPUT */}
        {isAuthenticated && <section className="mb-5 rounded-2xl border border-blue-200 bg-blue-50 p-5 text-sm leading-7">
          {projectId ? <><p>{ui("مشروعك المسودة محفوظ. يمكنك تشغيل الاستكشاف هنا، أو الانتقال مباشرة إلى البحث عن المصادر.")}</p><Link href={`/research/sources?projectId=${encodeURIComponent(projectId)}`} className="font-bold text-blue-700 underline">{ui("الخطوة التالية: البحث عن مصادر ←")}</Link></>
            : <><p>{ui("احفظ فكرتك أولاً؛ الاستكشاف اختياري ويمكن تشغيله لاحقاً داخل المشروع.")}</p><button type="button" disabled={creating || loading || topic.trim().length < 5} onClick={() => void createDraft()} className="mt-3 rounded-xl bg-blue-600 px-4 py-2 text-white disabled:opacity-40">{creating ? ui("جارٍ الحفظ…") : ui("احفظ مشروعًا مسودة")}</button></>}
        </section>}
        <div id="new-exploration" className="mb-6 rounded-2xl border border-line bg-white p-5 shadow-[0_12px_40px_rgba(17,24,39,.04)] sm:p-7">
          <fieldset className="mb-5">
            <legend className="mb-3 text-sm font-bold text-slate-800">{ui("أين أنت الآن؟")}</legend>
            <select aria-label={ui("أين أنت الآن؟")} value={scenario} onChange={(event) => setScenario(event.target.value as ResearchScenario)} disabled={loading} className="min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-bold text-slate-800 outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 sm:hidden">
              {RESEARCH_SCENARIOS.map((option) => <option key={option.id} value={option.id}>{ui(option.title)}</option>)}
            </select>
            <div className="hidden gap-2 sm:grid sm:grid-cols-2">
              {RESEARCH_SCENARIOS.map((option) => {
                const active = scenario === option.id;
                const Icon = SCENARIO_ICONS[option.id];
                return (
                  <button
                    key={option.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setScenario(option.id)}
                    disabled={loading}
                    className={`flex min-h-12 items-center gap-2.5 rounded-xl border px-3 py-3 text-start transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${active ? 'border-primary bg-primary-tint text-primary-dark' : 'border-slate-200 bg-white text-slate-700 hover:border-primary/40'}`}
                  >
                    <Icon className="h-4 w-4 shrink-0" aria-hidden="true" /><span className="text-sm font-bold">{ui(option.title)}</span>
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-xs leading-6 text-slate-500">{ui(RESEARCH_SCENARIOS.find((option) => option.id === scenario)!.description)}</p>
          </fieldset>
          <label htmlFor="research-topic" className="block text-sm font-semibold text-slate-700 mb-2">
            {scenario === 'uncertain' ? ui("ما المجال أو المشكلة التي تهمك؟") : scenario === 'compare_titles' ? ui("ما الموضوع المشترك بين العناوين؟") : scenario === 'references_only' ? ui("ما الموضوع أو العنوان الذي تريد مراجع له؟") : ui("ما الذي تفكر في بحثه؟")}
          </label>
          <textarea dir="auto"
            id="research-topic"
            value={topic}
            onChange={(e) => { setTopic(e.target.value); setError(''); }}
            placeholder={scenario === 'references_only' ? ui("اكتب الموضوع أو العنوان كما هو للبحث عن الأدلة المرتبطة به") : ui("مثال: عنواني رُفض، وأفكر في أثر الذكاء الاصطناعي على تعلم اللغة العربية لدى طلبة الجامعات")}
            className="min-h-32 w-full resize-y rounded-xl border border-slate-300 px-4 py-3 text-base leading-7 text-slate-800 outline-none placeholder:text-slate-400 focus:border-primary focus:ring-4 focus:ring-primary/10"
            disabled={loading}
          />
          {scenario === 'rejected_title' && (
            <div className="mt-4">
              <label htmlFor="rejection-feedback" className="mb-2 block text-sm font-semibold text-slate-700">{ui("ما ملاحظة المشرف أو سبب الرفض؟")}</label>
              <textarea dir="auto" id="rejection-feedback" value={rejectionFeedback} onChange={(event) => setRejectionFeedback(event.target.value)} placeholder={ui("مثال: العنوان واسع، المتغيرات غير واضحة، أو لا توجد فجوة محددة")} className="min-h-24 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" disabled={loading} />
            </div>
          )}
          {scenario === 'compare_titles' && (
            <div className="mt-4 space-y-3">
              <div className="text-sm font-semibold text-slate-700">{ui("العناوين التي تريد مقارنتها")}</div>
              {candidateTitles.map((title, index) => (
                <label key={index} className="block">
                  <span className="sr-only">{ui("العنوان")}{' '}{index + 1}</span>
                  <input value={title} onChange={(event) => setCandidateTitles((current) => current.map((item, itemIndex) => itemIndex === index ? event.target.value : item))} placeholder={ui("العنوان {0}", [index + 1])} className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" disabled={loading} />
                </label>
              ))}
              {candidateTitles.length < 4 && <button type="button" onClick={() => setCandidateTitles((current) => [...current, ''])} className="text-xs font-bold text-blue-700">{ui("+ إضافة عنوان آخر")}</button>}
              <p className="text-xs leading-5 text-slate-500">{ui("سنحفظ هذه العناوين داخل المشروع لتظهر في خطوة المقارنة التفصيلية، ولن نختار نيابة عنك.")}</p>
            </div>
          )}
          {error && (
            <div role="alert" className="mt-3 px-4 py-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-sm">
              {ui(error)}
            </div>
          )}
          <button
            onClick={handleVerify}
            disabled={loading || !topic.trim()}
            className="mt-4 min-h-12 w-full rounded-xl bg-primary px-4 py-3 text-base font-bold text-white shadow-[0_6px_20px_rgba(30,94,255,.16)] transition hover:bg-primary-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? ui("جارٍ تحليل المسار البحثي...") : ui("حلّل المسار البحثي")}
          </button>
          <p className="mt-3 text-xs text-slate-500 text-center">
            {ui("قد يستغرق التحليل 10–20 ثانية")}</p>
          {authResolved && !isAuthenticated && <p className="mt-4 border-t border-slate-100 pt-4 text-center text-xs leading-6 text-slate-600">{ui("يمكنك تجربة الاستكشاف مجاناً.")}{' '}{ui("احفظ عملك بحساب مجاني.")}{' '}<Link href="/signup" className="font-bold text-primary-dark underline underline-offset-2">{ui("إنشاء حساب")}</Link>{' · '}<Link href="/login" className="font-bold text-primary-dark underline underline-offset-2">{ui("تسجيل الدخول")}</Link></p>}
          {isAuthenticated && historyOwnerId === authenticatedUserId && history.length > 0 && topic.trim() && !loading && !report && <button type="button" onClick={() => document.getElementById('verification-history')?.scrollIntoView({ behavior: 'smooth', block: 'start' })} className="mx-auto mt-4 flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-xs font-bold text-blue-700"><span className="animate-bounce" aria-hidden="true">↓</span> {ui("لديك")}{' '}{history.length} {ui("استكشافات سابقة أسفل الفحص")}</button>}
        </div>
        </div>
        </div>

        {isAuthenticated && !report && !loading && (historyOwnerId !== authenticatedUserId || historyStatus === 'idle' || historyStatus === 'loading') && <div role="status" className="rounded-2xl border border-slate-200 bg-white p-5 text-center text-sm text-slate-500">{ui("جارٍ تحميل استكشافاتك السابقة…")}</div>}
        {isAuthenticated && !report && !loading && historyOwnerId === authenticatedUserId && historyStatus === 'error' && <div role="alert" className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-center text-sm text-amber-900">{ui("تعذر تحميل استكشافاتك السابقة.")}<button type="button" onClick={() => { setHistoryStatus('loading'); setHistoryReloadToken((value) => value + 1); }} className="font-black text-blue-700 underline">{ui("إعادة المحاولة")}</button></div>}
        {isAuthenticated && !report && !loading && historyOwnerId === authenticatedUserId && historyStatus === 'ready' && <VerificationHistory items={history} onReuse={(previousTopic) => {
          setTopic(previousTopic);
          setError('');
          document.getElementById('new-exploration')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }} />}

        {/* LOADING STATE */}
        {loading && (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center">
            <div className="inline-block w-12 h-12 border-4 border-teal-200 border-t-teal-600 rounded-full animate-spin mb-4"></div>
            <p className="text-slate-600">{ui("نحلل الأدبيات والسياقات المرتبطة بما كتبته…")}</p>
          </div>
        )}

        {/* REPORT */}
        {report && !loading && (() => {
          const usage = report.usageInfo;
          const showBlur = !isAuthenticated && usage?.isBlurred;
          const showBlock = !isAuthenticated && usage?.isBlocked;
          const searchedAt = new Date(report.searchCoverage.searchedAt).toLocaleString(uiLanguage, { dateStyle: 'medium', timeStyle: 'short' });
          const referencesOnly = report.researcherInput.scenario === 'references_only';
          const comparisonScenario = report.researcherInput.scenario === 'compare_titles';
          const providedTitlesPath = buildProvidedTitlesPath(report);
          return (
            <div className="relative">
              {showBlock && <AuthGate variant="block" />}
              {showBlur && !showBlock && <AuthGate variant="blur" />}
              <div className={(showBlur || showBlock) ? "blur-sm pointer-events-none select-none space-y-6" : "space-y-6"}>

            {/* DECISION BANNER */}
            <div className={`bg-gradient-to-r ${decisionColor(report.decision)} rounded-2xl p-6 text-white shadow-md`}>
              <div className="flex items-center justify-between mb-3">
                <div className="text-3xl font-bold">{report.acceptanceScore}<span className="text-xl opacity-70">/100</span></div>
                <div className="text-sm opacity-80">{ui("مؤشر استدلالي لقابلية تطوير المسار")}</div>
              </div>
              <div className="text-lg font-semibold mb-2">{ui(decisionLabel(report.decision))}</div>
              <div className="text-sm opacity-95 leading-relaxed">{report.decisionMessage}</div>
            </div>

            {/* TOPIC TIMING AND RECENT DIRECTIONS (DOC-24-07, DOC-23-01) */}
            <TopicTimingPanel key={report.translatedQuery || report.topic} query={report.translatedQuery || report.topic} />

            {/* PLAIN-LANGUAGE OUTCOME */}
            <div className="rounded-2xl border border-blue-200 bg-blue-50 p-6">
              <h3 className="text-lg font-black text-slate-900">{ui("ماذا تعني هذه النتيجة؟")}</h3>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <div className="rounded-xl bg-white p-4">
                  <div className="text-2xl font-black text-blue-700">{report.totalPapers}</div>
                  <p className="mt-1 text-sm leading-6 text-slate-600">{ui("دراسة قريبة ظهرت ضمن نطاق البحث الحالي، وليست حصراً لكل ما نُشر عالمياً.")}</p>
                </div>
                <div className="rounded-xl bg-white p-4">
                  <div className="text-2xl font-black text-violet-700">{report.gaps.length}</div>
                  <p className="mt-1 text-sm leading-6 text-slate-600">{ui("مؤشر فجوة محتملة يحتاج مراجعة الأدلة، وليس حكماً نهائياً بأن الموضوع لم يُبحث.")}</p>
                </div>
                <div className="rounded-xl bg-white p-4">
                  <div className="font-black text-slate-900">{ui("خطوتك الآن")}</div>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    {referencesOnly
                      ? ui("راجع قائمة الدراسات أدناه، وافتح الدراسة الأصلية قبل الاستشهاد بها.")
                      : comparisonScenario
                        ? ui("احفظ العناوين التي أدخلتها، ثم انتقل مباشرة إلى مقارنة الوضوح والأدلة.")
                      : report.decision === 'proceed'
                      ? ui("اختر اتجاه تطوير واحداً أدناه؛ بعدها نصوغ عناوين أكاديمية متسقة معه.")
                      : ui("راجع التحسينات المقترحة، عدّل فكرتك، ثم أعد التحليل قبل الانتقال.")}
                  </p>
                </div>
              </div>
            </div>

            <details className="group rounded-2xl border border-slate-200 bg-white p-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-bold text-slate-800">
                <span>{ui("عرض التفاصيل الرقمية ومنهج قراءة النتيجة")}</span>
                <span className="text-blue-600 transition group-open:rotate-180" aria-hidden="true">⌄</span>
              </summary>
              <p className="mt-2 text-xs leading-6 text-slate-500">{ui("هذه التفاصيل مفيدة للباحث المتقدم، ولا تحتاجها لاتخاذ الخطوة التالية.")}</p>
              <div className="mt-5 space-y-6">

            {/* SEARCH COVERAGE — factual and bounded */}
            <div className="rounded-2xl border border-blue-200 bg-white p-6">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-bold text-slate-900">{ui("نطاق البحث الذي نُفّذ")}</h3>
                  <p className="mt-1 text-xs text-slate-500">{ui("آخر بحث:")}{' '}{searchedAt}</p>
                </div>
                <EvidenceBadge kind="verified" />
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-xl bg-slate-50 p-3"><div className="text-2xl font-black text-slate-900">{report.searchCoverage.queryCount}</div><div className="mt-1 text-xs text-slate-600">{ui("صياغات بحثية استُخدمت")}</div></div>
                <div className="rounded-xl bg-slate-50 p-3"><div className="text-2xl font-black text-slate-900">{report.searchCoverage.uniqueStudies}</div><div className="mt-1 text-xs text-slate-600">{ui("نتيجة فريدة بعد إزالة التكرار")}</div></div>
                <div className="rounded-xl bg-blue-50 p-3"><div className="text-2xl font-black text-blue-700">{report.totalPapers}</div><div className="mt-1 text-xs text-blue-800">{ui("دراسة أقرب إلى موضوعك")}</div></div>
                <div className="rounded-xl bg-blue-50 p-3"><div className="text-2xl font-black text-blue-700">{report.yearDistribution.length}</div><div className="mt-1 text-xs text-blue-800">{ui("سنوات نشر ممثلة في النتائج")}</div></div>
              </div>
              {report.searchCoverage.excludedByRelevance > 0 && <p className="mt-3 text-xs text-slate-500">{ui("فُحصت")}{' '}{report.searchCoverage.candidateResults} {ui("نتيجة مرشحة، واستُبعدت")}{' '}{report.searchCoverage.excludedByRelevance} {ui("نتيجة ضعيفة الصلة قبل بناء التقرير.")}</p>}
              <p className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs leading-6 text-slate-600">{report.searchCoverage.scopeNote}</p>
            </div>

            {/* RESEARCHER CONTEXT */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <h3 className="font-bold text-slate-900">{ui("مدى قرب النتائج من سياقك البحثي")}</h3>
                <EvidenceBadge kind="inference" />
              </div>
              {report.researcherContext.countryName ? (
                <div className="grid gap-4 md:grid-cols-[180px_1fr]">
                  <div className="rounded-xl bg-blue-50 p-4 text-center">
                    <div className="text-3xl font-black text-blue-700">{report.contextMatch.localAffiliationMatches}</div>
                    <div className="mt-1 text-xs leading-5 text-blue-800">{ui("نتيجة مرتبطة بمؤلفين من مؤسسات في")}{' '}{report.researcherContext.countryName}</div>
                  </div>
                  <div className="space-y-2 text-sm leading-7 text-slate-700">
                    <p><strong>{ui("الدولة:")}</strong> {report.researcherContext.countryName}</p>
                    {specialtyLabel(report.researcherContext) && <p><strong>{ui("التخصص:")}</strong> {specialtyLabel(report.researcherContext)}</p>}
                    {report.researcherContext.university && <p><strong>{ui("المؤسسة:")}</strong> {report.researcherContext.university}</p>}
                    <p className="text-xs text-slate-500">{report.contextMatch.note}</p>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-7 text-amber-900">
                  {report.contextMatch.note} {ui("أكمل الدولة والتخصص في ملفك لاحقاً لتحصل على قراءة أقرب إلى بيئتك البحثية.")}</div>
              )}
            </div>

            {/* SCORE BREAKDOWN */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h3 className="font-bold text-slate-800">{ui("تفصيل مؤشر المسار (حساب شفاف)")}</h3><EvidenceBadge kind="inference" /></div>
              <div className="space-y-3">
                {[
                  { label: ui("مؤشر أولي على فجوة محتملة"), value: report.scoreBreakdown.gapExists, max: 25 },
                  { label: ui("حداثة الاهتمام البحثي"), value: report.scoreBreakdown.recency, max: 20 },
                  { label: ui("تنوع المنهجيات المستخدمة"), value: report.scoreBreakdown.methodDiversity, max: 20 },
                  { label: ui("تنوع السياقات الجغرافية"), value: report.scoreBreakdown.geoDiversity, max: 15 },
                  { label: ui("كفاية عدد الدراسات المرجعية"), value: report.scoreBreakdown.sufficientRefs, max: 10 },
                  { label: ui("الاتساق الداخلي للأدبيات"), value: report.scoreBreakdown.consistency, max: 10 },
                ].map((item) => (
                  <div key={item.label}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-slate-700">{ui(item.label)}</span>
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
                <div className="text-sm text-slate-600 mt-1">{ui("نتيجة فريدة في نطاق البحث الحالي")}</div>
              </div>
              <div className="bg-white rounded-2xl border border-slate-200 p-5 text-center">
                <div className="text-3xl font-bold text-blue-600">{report.geographicDistribution.length}</div>
                <div className="text-sm text-slate-600 mt-1">{ui("دولة ظهرت في انتماءات المؤلفين")}</div>
              </div>
              <div className="bg-white rounded-2xl border border-slate-200 p-5 text-center">
                <div className="text-3xl font-bold text-purple-600">{report.gaps.length}</div>
                <div className="text-sm text-slate-600 mt-1">{ui("مؤشر يحتاج تحققاً أعمق")}</div>
              </div>
            </div>

              </div>
            </details>

            {/* GAPS */}
            {report.gaps.length > 0 && (
              <div className="bg-white rounded-2xl border border-slate-200 p-6">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h3 className="font-bold text-slate-800">{ui("مؤشرات فجوة محتملة")}</h3><EvidenceBadge kind="inference" /></div>
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
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h3 className="font-bold text-rose-800">{ui("زوايا بديلة مقترحة")}</h3><EvidenceBadge kind="suggestion" /></div>
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
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h3 className="font-bold text-amber-800">{ui("تحسينات مقترحة قبل الاعتماد")}</h3><EvidenceBadge kind="suggestion" /></div>
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
                  <div><h3 className="font-bold text-slate-900">{ui("اتجاهات لتطوير فكرتك")}</h3><p className="mt-1 text-xs leading-6 text-slate-500">{ui("كل اتجاه يغيّر زاوية الدراسة أو سياقها، وليس عنواناً نهائياً. اختر الأنسب، ثم نقترح عناوين أكاديمية متسقة معه.")}</p></div>
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
                          <div className="mb-2 text-xs font-bold text-slate-500">{ui("مراجع مرتبطة بهذا المسار")}</div>
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
                          {selected && adoptingPath ? ui("جارٍ اعتماد الاتجاه وحفظه…") : selected && (saveStatus === 'cloud' || saveStatus === 'local') ? ui("✓ تم اعتماد هذا الاتجاه") : ui("اعتماد هذا الاتجاه")}
                        </button>
                      )}
                    </article>
                  );})}
                </div>
              </div>
            )}

            {/* FIVE QUESTIONS AND PASSION-FEASIBILITY MATRIX (DOC-23-04, DOC-23-03) */}
            {!referencesOnly && !comparisonScenario && <IdeaQuestionsAndMatrix paths={report.researchPaths} projectId={projectId} isAuthenticated={isAuthenticated} context={{ countryName: report.researcherContext.countryName, specialty: specialtyLabel(report.researcherContext) }} />}

            {/* PROCEED CTA (if strong) */}
            {referencesOnly ? (
              <div className="rounded-2xl border-2 border-blue-200 bg-blue-50 p-6">
                <h3 className="font-black text-blue-950">{ui("وجدنا لك مراجع مرتبطة بالموضوع")}</h3>
                <p className="mt-2 text-sm leading-7 text-blue-900">{ui("هذه ليست بوابة انتقال إلى بناء البحث. راجع النتائج الأصلية أدناه، ويمكنك لاحقاً العودة واختيار «لدي فكرة أولية» إذا أردت بناء رحلة بحثية كاملة.")}</p>
                <button type="button" onClick={() => document.getElementById('top-papers')?.scrollIntoView({ behavior: 'smooth', block: 'start' })} className="mt-4 rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white">{ui("عرض الدراسات المرتبطة ↓")}</button>
              </div>
            ) : comparisonScenario ? (
              <div className="rounded-2xl border-2 border-violet-200 bg-violet-50 p-6">
                <h3 className="font-black text-violet-950">{ui("عناوينك جاهزة للمقارنة")}</h3>
                <p className="mt-2 text-sm leading-7 text-violet-900">{ui("لن نطلب منك اختيار اتجاه بحثي جديد؛ سننقل العناوين التي أدخلتها كما هي إلى مقارنة الأدلة والوضوح.")}</p>
                {saveStatus === 'cloud' && projectId ? <Link href={`/research?projectId=${projectId}`} className="mt-4 inline-flex rounded-xl bg-violet-700 px-5 py-3 text-sm font-bold text-white">{ui("انتقل إلى مقارنة عناويني ←")}</Link>
                  : saveStatus === 'local' ? <Link href={`/signup?redirect=${encodeURIComponent('/verify-idea')}`} className="mt-4 inline-flex rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white">{ui("أنشئ حساباً لحفظ المقارنة")}</Link>
                    : <button type="button" onClick={() => void adoptResearchPath(providedTitlesPath)} disabled={adoptingPath || report.decision !== 'proceed'} className="mt-4 rounded-xl bg-violet-700 px-5 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">{adoptingPath ? ui("جارٍ حفظ العناوين…") : report.decision === 'proceed' ? ui("حفظ العناوين ومتابعة المقارنة") : ui("حسّن الصياغة وفق الملاحظات أولاً")}</button>}
              </div>
            ) : <div className={`rounded-2xl border-2 p-6 ${report.decision === 'proceed' ? 'border-emerald-300 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className={`text-sm font-bold ${report.decision === 'proceed' ? 'text-emerald-800' : 'text-amber-900'}`}>
                    {report.decision === 'proceed' && selectedPathId && (saveStatus === 'cloud' || saveStatus === 'local')
                      ? ui("تم اعتماد اتجاه تطوير الفكرة")
                      : report.decision === 'proceed'
                        ? ui("اختر اتجاه التطوير أولاً")
                        : ui("تحتاج الفكرة إلى تحسين قبل الانتقال")}
                  </div>
                  <p className={`mt-1 text-sm leading-6 ${report.decision === 'proceed' ? 'text-emerald-700' : 'text-amber-800'}`}>
                    {report.decision !== 'proceed'
                      ? ui("لا ننتقل إلى العنوان أو الأدبيات قبل معالجة الملاحظات أعلاه وإعادة فحص الفكرة.")
                      : selectedPathId && (saveStatus === 'cloud' || saveStatus === 'local')
                        ? ui("حُفظ اختيارك مع الأدلة والسياق. الخطوة التالية هي صياغة عنوان أكاديمي متسق مع هذا الاتجاه.")
                        : ui("راجع الاتجاهات المرتبطة بالأدلة أعلاه، ثم اختر اتجاهاً واحداً قبل الانتقال.")}
                  </p>
                  <p className="mt-2 text-xs text-slate-500">
                    {saveStatus === 'cloud' ? ui("تم حفظ التقرير والاختيار داخل مشروعك.") : saveStatus === 'local' ? ui("تم حفظ آخر حالة للرحلة على هذا الجهاز.") : ui("لم يُعتمد مسار بعد.")}
                  </p>
                </div>
                {report.decision === 'proceed' && selectedPathId && saveStatus === 'cloud' ? (
                  <Link href={`/research?topic=${encodeURIComponent(report.topic)}${projectId ? `&projectId=${projectId}` : ''}`} className="inline-flex shrink-0 items-center justify-center rounded-xl bg-emerald-600 px-5 py-3 font-semibold text-white transition hover:bg-emerald-700">
                    {ui("انتقل إلى صياغة العنوان ←")}</Link>
                ) : report.decision === 'proceed' && selectedPathId && saveStatus === 'local' ? (
                  <Link href={`/signup?redirect=${encodeURIComponent('/verify-idea')}`} className="inline-flex shrink-0 items-center justify-center rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white transition hover:bg-blue-700">{ui("أنشئ حساباً لحفظ المشروع والمتابعة")}</Link>
                ) : report.decision === 'proceed' ? (
                  <button type="button" onClick={() => document.getElementById('research-paths')?.scrollIntoView({ behavior: 'smooth', block: 'start' })} className="inline-flex shrink-0 items-center justify-center rounded-xl border border-blue-300 bg-white px-5 py-3 font-semibold text-blue-800 transition hover:bg-blue-50">
                    {ui("اختر اتجاه تطوير من القائمة أعلاه")}</button>
                ) : (
                  <button type="button" onClick={() => document.querySelector('textarea')?.focus()} className="inline-flex shrink-0 items-center justify-center rounded-xl border border-amber-300 bg-white px-5 py-3 font-semibold text-amber-800 transition hover:bg-amber-100">
                    {ui("حسّن الفكرة وأعد الفحص")}</button>
                )}
              </div>
            </div>}

            {/* YEAR DISTRIBUTION */}
            {report.yearDistribution.length > 0 && (
              <div className="bg-white rounded-2xl border border-slate-200 p-6">
                <h3 className="font-bold text-slate-800 mb-4">{ui("التوزيع الزمني للدراسات")}</h3>
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
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-bold text-slate-800">{ui("التوزيع الجغرافي لانتماءات المؤلفين")}</h3><p className="mt-1 text-xs text-slate-500">{ui("لا يُعامل تلقائياً كموقع تنفيذ الدراسة الميدانية.")}</p></div><EvidenceBadge kind="verified" /></div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {report.geographicDistribution.map((g) => (
                    <div key={g.region} className="flex items-center justify-between px-3 py-2 bg-slate-50 rounded-lg">
                      <span className="text-slate-700 text-sm">{countryName(g.region, uiLanguage)}</span>
                      <span className="font-semibold text-teal-600 text-sm">{g.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TOP PAPERS */}
            {report.topPapers.length > 0 && (
              <div id="top-papers" className="scroll-mt-24 bg-white rounded-2xl border border-slate-200 p-6">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h3 className="font-bold text-slate-800">{ui("مراجع من النتائج الحالية")}</h3><EvidenceBadge kind="verified" /></div>
                <div className="space-y-3">
                  {report.topPapers.map((p, i) => (
                    <div key={i} className="border-r-4 border-teal-500 pr-4 py-2">
                      <div className="flex items-start justify-between gap-3 mb-1">
                        <div className="text-xs font-semibold text-teal-600">
                          {ui("مرجع في نتائج البحث")}{' '}{p.year > 0 && ` · ${p.year}`}
                          {p.citations > 0 && ui("· {0} استشهاد", [p.citations])}
                          {p.countries && p.countries.length > 0 && ui("· {0}", [p.countries.slice(0, 2).map((code) => countryName(code, uiLanguage)).join(uiLanguage === 'ar' ? '، ' : ', ')])}
                        </div>
                      </div>
                      <div className="text-slate-800 leading-relaxed mb-1">{p.title}</div>
                      {p.authors && p.authors.length > 0 && (
                        <div className="text-xs text-slate-500">{p.authors.slice(0, 3).join(ui("،"))}{p.authors.length > 3 ? ui("وآخرون") : ''}</div>
                      )}
                      {p.url && (
                        <a href={p.url} target="_blank" rel="noopener noreferrer" className="text-xs text-teal-600 hover:underline">
                          {ui("فتح المرجع ↗")}</a>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <h3 className="font-bold text-slate-800">{ui("حدود يجب معرفتها قبل اعتماد القرار")}</h3>
              <ul className="mt-3 space-y-2 text-xs leading-6 text-slate-600">
                {report.evidenceLimitations.map((limitation) => <li key={limitation} className="flex gap-2"><span className="text-slate-400">•</span><span>{limitation}</span></li>)}
              </ul>
            </div>

              </div>
            </div>
          );
        })()}
      </main>
      <SiteFooter lang={uiLanguage} />
    </div>
  );
}
