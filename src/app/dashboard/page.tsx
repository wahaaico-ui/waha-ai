"use client";
import { useUiTranslation } from '@/lib/use-ui-translation';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import SiteHeader from '@/components/SiteHeader';
import ScoreCircle from '@/components/ScoreCircle';
import { useWahaLanguage } from '@/lib/use-language';
import { useAuthSession } from '@/components/AuthSessionProvider';
import { ArrowLeft, CheckCircle2, Clock3, Mail } from 'lucide-react';
import type { DashboardProject } from '@/lib/dashboard-resume';

type JourneyStage = 'verify' | 'title' | 'problem' | 'objectives' | 'questions' | 'hypotheses' | 'methodology' | 'design' | 'instrument' | 'literature' | 'analysis' | 'analysis_input' | 'results' | 'discussion' | 'conclusions' | 'recommendations' | 'publication';


interface HistoryRow {
  id: string;
  idea_text: string;
  report_score: number;
  created_at: string;
}

type ProjectRow = DashboardProject;

interface ResearcherSummary {
  displayName: string;
  specialty: string | null;
}

const COPY = {
  ar: {
    title: 'مشاريعي البحثية',
    welcome: 'مرحباً',
    welcomeBack: 'مرحباً بعودتك',
    resumeTitle: 'لنبدأ من حيث توقفت',
    stoppedAt: 'آخر حفظ',
    lastOutput: 'من آخر نسخة محفوظة',
    nextStep: 'تابع عملك',
    writing: 'الكتابة المرتبطة بالدليل',
    supervisor: 'مراجعة ملاحظات المشرف',
    language: 'الترجمة والتدقيق',
    continueCta: 'متابعة الآن',
    emailCta: 'أرسل آخر نسخة إلى بريدي',
    emailSending: 'جاري إرسال النسخة...',
    emailSuccess: 'تم إرسال آخر نسخة محفوظة إلى بريد حسابك.',
    emailUnavailable: 'إرسال النسخ بالبريد غير متاح الآن. يمكنك تنزيل عملك من داخل المشروع.',
    emailError: 'تعذر إرسال النسخة الآن. حاول مجدداً.',
    journeyComplete: 'راجع مراحل البحث المحفوظة',
    projectSubtitle: 'تابع آخر كتابة أو مراجعة أو مسودة حفظتها في مشروعك، أو ابدأ مشروعاً جديداً.',
    newProject: 'مشروع جديد',
    projectsTitle: 'المشاريع المحفوظة',
    openJourney: 'خريطة البحث',
    openWorkspace: 'المصادر والملفات',
    noProjects: 'لا توجد مشاريع محفوظة بعد.',
    total: 'إجمالي التحليلات',
    avg: 'متوسط الدرجة',
    best: 'أفضل درجة',
    historyTitle: 'سجل التحليلات',
    loading: 'جاري التحميل...',
  },
  en: {
    title: 'My research projects',
    welcome: 'Welcome',
    welcomeBack: 'Welcome back',
    resumeTitle: 'Continue where you left off',
    stoppedAt: 'Last saved',
    lastOutput: 'From your latest saved version',
    nextStep: 'Continue your work',
    writing: 'Evidence-linked writing',
    supervisor: 'Supervisor comments and revisions',
    language: 'Translation and proofreading',
    continueCta: 'Continue now',
    emailCta: 'Email my latest version',
    emailSending: 'Sending your version...',
    emailSuccess: 'Your latest saved version was sent to your account email.',
    emailUnavailable: 'Email delivery is currently unavailable. You can download your work from the project.',
    emailError: 'Unable to send the version now. Please try again.',
    journeyComplete: 'Review your saved research stages',
    projectSubtitle: 'Continue your latest saved writing, review, or research draft, or start a new project.',
    newProject: 'New project',
    projectsTitle: 'Saved projects',
    openJourney: 'Research stages',
    openWorkspace: 'Sources and files',
    noProjects: 'No saved projects yet.',
    total: 'Total Analyses',
    avg: 'Average Score',
    best: 'Best Score',
    historyTitle: 'Analysis History',
    loading: 'Loading...',
  },
};

function formatDate(iso: string, lang: 'ar' | 'en') {
  return new Date(iso).toLocaleDateString(lang === 'ar' ? 'ar-SA' : 'en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}

function formatDateTime(iso: string, lang: 'ar' | 'en') {
  return new Date(iso).toLocaleString(lang === 'ar' ? 'ar-SA' : 'en-US', {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

const STAGE_COPY: Record<JourneyStage, { ar: string; en: string; href: string }> = {
  verify: { ar: 'استكشاف المسار', en: 'Research exploration', href: '/verify-idea' },
  title: { ar: 'صياغة العنوان', en: 'Research title', href: '/research' },
  problem: { ar: 'المشكلة والفجوة', en: 'Problem and gap', href: '/research/problem' },
  objectives: { ar: 'الأهداف', en: 'Objectives', href: '/research/objectives' },
  questions: { ar: 'الأسئلة', en: 'Questions', href: '/research/questions' },
  hypotheses: { ar: 'الفرضيات', en: 'Hypotheses', href: '/research/hypotheses' },
  methodology: { ar: 'المنهجية', en: 'Methodology', href: '/research/methodology' },
  design: { ar: 'تصميم الدراسة', en: 'Study design', href: '/research/design' },
  instrument: { ar: 'أداة الدراسة', en: 'Instrument', href: '/research/instrument' },
  literature: { ar: 'الأدلة والأدبيات', en: 'Evidence and literature', href: '/research/literature' },
  analysis: { ar: 'تحليل الأدبيات', en: 'Literature synthesis', href: '/research/analysis' },
  analysis_input: { ar: 'مخرجات التحليل الخارجي', en: 'External analysis outputs', href: '/research/analysis-input' },
  results: { ar: 'صياغة النتائج', en: 'Research results', href: '/research/results' },
  discussion: { ar: 'مناقشة النتائج', en: 'Results discussion', href: '/research/discussion' },
  conclusions: { ar: 'الاستنتاجات', en: 'Conclusions', href: '/research/conclusions' },
  recommendations: { ar: 'التوصيات', en: 'Recommendations', href: '/research/recommendations' },
  publication: { ar: 'جاهزية النشر', en: 'Publication readiness', href: '/research/publication' },
};

function resumeHref(project: ProjectRow) {
  if (project.resume.href) return project.resume.href;
  const stage = project.resume.nextStage;
  if (!stage) return `/research/seminar?projectId=${encodeURIComponent(project.id)}`;
  return `${STAGE_COPY[stage].href}?projectId=${encodeURIComponent(project.id)}`;
}

function resumeTitle(project: ProjectRow, language: 'ar' | 'en') {
  const { activity, lastStage, nextStage } = project.resume;
  if (activity === 'writing' || activity === 'supervisor' || activity === 'language') return COPY[language][activity];
  const stage = activity === 'draft' ? lastStage : nextStage;
  return stage ? STAGE_COPY[stage][language] : COPY[language].journeyComplete;
}

function projectStatus(status: string | null, lang: 'ar' | 'en') {
  const stage = status?.replace(/_(completed|needs_improvement)$/, '') || 'draft';
  const labels: Record<string, { ar: string; en: string }> = {
    draft: { ar: 'مسودة', en: 'Draft' },
    active: { ar: 'نشط', en: 'Active' },
    verify: { ar: 'تم استكشاف الفكرة', en: 'Idea explored' },
    title: { ar: 'تم اعتماد العنوان', en: 'Title approved' },
    problem: { ar: 'تم تحديد المشكلة', en: 'Problem defined' },
    objectives: { ar: 'تم اعتماد الأهداف', en: 'Objectives approved' },
    questions: { ar: 'تم اعتماد الأسئلة', en: 'Questions approved' },
    methodology: { ar: 'تم اعتماد المنهجية', en: 'Methodology approved' },
    design: { ar: 'تم اعتماد تصميم الدراسة', en: 'Study design approved' },
    literature: { ar: 'تم اختيار الأدبيات', en: 'Literature selected' },
    analysis: { ar: 'اكتمل تحليل الأدبيات', en: 'Literature synthesis complete' },
    analysis_input: { ar: 'تم اعتماد مخرجات التحليل', en: 'Analysis outputs approved' },
    results: { ar: 'تم اعتماد النتائج', en: 'Results approved' },
    discussion: { ar: 'تم اعتماد المناقشة', en: 'Discussion approved' },
    conclusions: { ar: 'تم اعتماد الاستنتاجات', en: 'Conclusions approved' },
    recommendations: { ar: 'تم اعتماد التوصيات', en: 'Recommendations approved' },
    publication: { ar: 'اكتملت جاهزية النشر', en: 'Publication readiness complete' },
  };
  if (status?.endsWith('_needs_improvement')) return lang === 'ar' ? 'تحتاج مراجعة' : 'Needs review';
  return labels[stage]?.[lang] || (lang === 'ar' ? 'قيد العمل' : 'In progress');
}

export default function DashboardPage() {
  const { text: ui } = useUiTranslation();

  const router = useRouter();
  const { language: lang } = useWahaLanguage();
  const { user, authResolved } = useAuthSession();
  const [loadedUserId, setLoadedUserId] = useState<string | null>(null);
  const loading = !user || loadedUserId !== user.id;
  const [stats, setStats] = useState<{ total: number; avg: number; best: number } | null>(null);
  const [history, setHistory] = useState<HistoryRow[] | null>(null);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [latestProject, setLatestProject] = useState<ProjectRow | null>(null);
  const [researcher, setResearcher] = useState<ResearcherSummary | null>(null);
  const visibleResearcher = loading ? null : researcher;
  const [error, setError] = useState('');
  const [emailStatus, setEmailStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const [emailMessage, setEmailMessage] = useState('');

  useEffect(() => {
    if (!authResolved) return;
    if (!user) {
      router.replace('/login?redirect=/dashboard');
      return;
    }
    const controller = new AbortController();
    fetch('/api/dashboard-stats', { cache: 'no-store', signal: controller.signal })
      .then(async (res) => ({ ok: res.ok, status: res.status, data: await res.json() }))
      .then(({ ok, status, data }) => {
        if (controller.signal.aborted) return;
        if (status === 401) {
          router.push('/login?redirect=/dashboard');
          return;
        }
        if (ok && data.success) {
          setError('');
          setStats(data.stats);
          setHistory(data.history);
          setProjects(data.projects || []);
          setLatestProject(data.latestProject || null);
          setResearcher(data.researcher || null);
        } else {
          setError(data.error || 'تعذر استرجاع مشاريعك الآن. حاول مجدداً.');
        }
      })
      .catch(() => { if (!controller.signal.aborted) setError("حدث خطأ، يرجى المحاولة مجدداً."); })
      .finally(() => { if (!controller.signal.aborted) setLoadedUserId(user.id); });
    return () => controller.abort();
  }, [authResolved, router, user]);

  const t = COPY[lang];
  const dir = lang === 'ar' ? 'rtl' : 'ltr';

  async function emailLatestVersion() {
    if (!latestProject || emailStatus === 'sending') return;
    setEmailStatus('sending');
    setEmailMessage('');
    try {
      const response = await fetch('/api/email/project-snapshot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: latestProject.id }),
      });
      const data: unknown = await response.json();
      if (!response.ok || !data || typeof data !== 'object' || (data as { success?: unknown }).success !== true) {
        const code = data && typeof data === 'object' ? (data as { code?: unknown }).code : null;
        setEmailStatus('error');
        setEmailMessage(code === 'EMAIL_NOT_CONFIGURED' ? t.emailUnavailable : t.emailError);
        return;
      }
      setEmailStatus('success');
      setEmailMessage(t.emailSuccess);
    } catch {
      setEmailStatus('error');
      setEmailMessage(t.emailError);
    }
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-950 font-sans pb-20" dir={dir}>
      <SiteHeader />

      <main className="mx-auto max-w-6xl space-y-8 px-4 py-8 sm:px-6 lg:py-12">
        <section className="rounded-3xl bg-gradient-to-l from-[#0B2551] to-[#2563EB] p-7 text-white shadow-xl shadow-blue-900/10 sm:p-10">
          <p className="break-words text-sm font-bold text-blue-100">{t.welcome}{visibleResearcher ? ` ${visibleResearcher.displayName}` : ''}{visibleResearcher?.specialty ? ` · ${visibleResearcher.specialty}` : ''}</p>
          <div className="mt-3 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
            <div><h1 className="text-2xl font-black sm:text-3xl">{t.title}</h1><p className="mt-3 max-w-2xl text-sm leading-7 text-blue-100">{t.projectSubtitle}</p></div>
            <Link href="/verify-idea" className="inline-flex shrink-0 items-center justify-center rounded-xl bg-white px-5 py-3 text-sm font-bold text-blue-700 shadow-sm">{t.newProject}</Link>
          </div>
        </section>

        {loading ? (
          <p className="text-slate-500 text-sm">{t.loading}</p>
        ) : error ? (
          <p className="text-red-400 text-sm">{ui(error)}</p>
        ) : (
          <>
            {latestProject && <section className="overflow-hidden rounded-3xl border border-blue-200 bg-white shadow-lg shadow-blue-900/5">
              <div className="grid gap-0 lg:grid-cols-[1.45fr_.85fr]">
                <div className="min-w-0 p-6 sm:p-8">
                  <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-blue-700">
                    <span className="break-words rounded-full bg-blue-50 px-3 py-1">{t.welcomeBack}{visibleResearcher ? ` ${visibleResearcher.displayName}` : ''}</span>
                    <span className="inline-flex items-center gap-1 text-slate-500"><Clock3 className="h-3.5 w-3.5" />{t.stoppedAt}: {formatDateTime(latestProject.resume.lastActivityAt, lang)}</span>
                  </div>
                  <h2 className="mt-4 text-xl font-black text-[#10213c] sm:text-2xl">{t.resumeTitle}</h2>
                  <p className="mt-2 line-clamp-2 break-words text-sm font-bold text-slate-700 [overflow-wrap:anywhere]">{latestProject.title}</p>
                  {latestProject.resume.lastOutputPreview && <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-[11px] font-bold text-slate-500">{t.lastOutput}{latestProject.resume.lastVersion ? ` · v${latestProject.resume.lastVersion}` : ''}</p>
                    <p className="mt-2 line-clamp-2 break-words text-sm leading-7 text-slate-700 [overflow-wrap:anywhere]">{latestProject.resume.lastOutputPreview}</p>
                  </div>}
                </div>
                <div className="flex min-w-0 flex-col justify-center bg-gradient-to-br from-[#0B2551] to-[#2563EB] p-6 text-white sm:p-8">
                  <p className="text-xs font-bold text-blue-100">{t.nextStep}</p>
                  <h3 className="mt-2 text-xl font-black">{resumeTitle(latestProject, lang)}</h3>
                  <p className="mt-3 inline-flex items-center gap-2 text-xs text-blue-100"><CheckCircle2 className="h-4 w-4" /><bdi dir="ltr">{latestProject.resume.completedStages} / {latestProject.resume.totalStages ?? Object.keys(STAGE_COPY).length}</bdi><span>{lang === 'ar' ? 'من مراحل خريطة البحث مكتملة ومحفوظة' : 'research stages completed and saved'}</span></p>
                  <Link href={resumeHref(latestProject)} className="mt-6 inline-flex items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-black text-blue-700 shadow-sm">{t.continueCta}<ArrowLeft className="h-4 w-4" /></Link>
                  <button type="button" onClick={emailLatestVersion} disabled={emailStatus === 'sending'} className="mt-3 inline-flex items-center justify-center gap-2 rounded-xl border border-blue-300/50 bg-blue-900/20 px-5 py-3 text-sm font-bold text-white transition hover:bg-blue-900/35 disabled:cursor-wait disabled:opacity-70">
                    <Mail className="h-4 w-4" />{emailStatus === 'sending' ? t.emailSending : t.emailCta}
                  </button>
                  {emailMessage && <p role="status" aria-live="polite" className={`mt-3 text-xs leading-6 ${emailStatus === 'success' ? 'text-emerald-200' : 'text-amber-200'}`}>{emailMessage}</p>}
                </div>
              </div>
            </section>}

            <section className="space-y-4">
              <h2 className="text-lg font-black text-[#10213c]">{t.projectsTitle}</h2>
              {projects.length > 0 ? <div className="grid grid-cols-1 gap-4 md:grid-cols-2">{projects.map((project) => <article key={project.id} className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between gap-4"><div className="min-w-0"><h3 className="truncate font-black text-[#10213c]">{project.title}</h3><p className="mt-1 text-xs text-slate-500">{formatDate(project.resume.lastActivityAt, lang)}</p></div><span className="rounded-full bg-blue-50 px-3 py-1 text-[11px] font-bold text-blue-700">{projectStatus(project.status, lang)}</span></div>
                <p className="mt-3 break-words text-xs leading-6 text-slate-600">{resumeTitle(project, lang)}</p>
                <div className="mt-5 flex flex-wrap gap-2"><Link href={resumeHref(project)} className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white">{t.continueCta}</Link><Link href={`/research/journey?projectId=${encodeURIComponent(project.id)}`} className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700">{t.openJourney}</Link><Link href={`/projects/workspace?projectId=${encodeURIComponent(project.id)}`} className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700">{t.openWorkspace}</Link></div>
              </article>)}</div> : <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center"><p className="text-sm text-slate-500">{t.noProjects}</p><Link href="/verify-idea" className="mt-4 inline-flex rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white">{t.newProject}</Link></div>}
            </section>

            {/* Idea scores come from the retired idea-analysis flow; nothing writes
                them now. Show them only to accounts that have such earlier records. */}
            {history && history.length > 0 && <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 text-center shadow-sm">
                <p className="text-3xl font-black text-[#10213c]">{stats!.total}</p>
                <p className="text-slate-500 text-xs mt-2">{t.total}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-5 text-center shadow-sm">
                <p className="text-3xl font-black text-blue-600">{stats!.avg}%</p>
                <p className="text-slate-500 text-xs mt-2">{t.avg}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-5 text-center shadow-sm">
                <p className="text-3xl font-black text-emerald-600">{stats!.best}%</p>
                <p className="text-slate-500 text-xs mt-2">{t.best}</p>
              </div>
            </div>
              <div className="space-y-3">
                <h2 className="text-xs font-bold text-slate-500">{t.historyTitle}</h2>
                {history.map((row) => (
                  <div
                    key={row.id}
                    className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                  >
                    <ScoreCircle score={row.report_score} size={56} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-slate-900 truncate">{row.idea_text}</p>
                      <p className="text-slate-500 text-[11px] mt-1">{formatDate(row.created_at, lang)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </>}
          </>
        )}
      </main>
    </div>
  );
}
