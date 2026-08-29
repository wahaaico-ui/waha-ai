"use client";
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import SiteHeader from '@/components/SiteHeader';
import ScoreCircle from '@/components/ScoreCircle';
import { useWahaLanguage } from '@/lib/use-language';
import { useAuthSession } from '@/components/AuthSessionProvider';


interface HistoryRow {
  id: string;
  idea_text: string;
  report_score: number;
  created_at: string;
}

interface ProjectRow {
  id: string;
  title: string;
  status: string | null;
  created_at: string;
}

interface ResearcherSummary {
  displayName: string;
  specialty: string | null;
}

const COPY = {
  ar: {
    title: 'مشاريعي البحثية',
    welcome: 'مرحباً',
    projectSubtitle: 'افتح مشروعاً محفوظاً لتتابع من آخر مرحلة معتمدة، أو ابدأ مساراً جديداً.',
    newProject: 'مشروع جديد',
    projectsTitle: 'المشاريع المحفوظة',
    openJourney: 'متابعة الرحلة',
    openWorkspace: 'المصادر والملفات',
    noProjects: 'لا توجد مشاريع محفوظة بعد.',
    total: 'إجمالي التحليلات',
    avg: 'متوسط الدرجة',
    best: 'أفضل درجة',
    historyTitle: 'سجل التحليلات',
    emptyTitle: 'لم تحلل أي فكرة بعد',
    emptySubtitle: 'ابدأ رحلتك البحثية الآن واحصل على تحليل أكاديمي حقيقي لفكرتك',
    emptyCta: 'حلّل فكرتك الآن ←',
    loading: 'جاري التحميل...',
  },
  en: {
    title: 'My research projects',
    welcome: 'Welcome',
    projectSubtitle: 'Open a saved project to continue from its last approved stage, or start a new path.',
    newProject: 'New project',
    projectsTitle: 'Saved projects',
    openJourney: 'Continue journey',
    openWorkspace: 'Sources and files',
    noProjects: 'No saved projects yet.',
    total: 'Total Analyses',
    avg: 'Average Score',
    best: 'Best Score',
    historyTitle: 'Analysis History',
    emptyTitle: "You haven't analyzed any idea yet",
    emptySubtitle: 'Start your research journey now and get a real academic analysis of your idea',
    emptyCta: 'Analyze your idea now →',
    loading: 'Loading...',
  },
};

function formatDate(iso: string, lang: 'ar' | 'en') {
  return new Date(iso).toLocaleDateString(lang === 'ar' ? 'ar-SA' : 'en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
  });
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
    literature: { ar: 'تم اختيار الأدبيات', en: 'Literature selected' },
    analysis: { ar: 'اكتمل التحليل', en: 'Analysis complete' },
  };
  if (status?.endsWith('_needs_improvement')) return lang === 'ar' ? 'تحتاج مراجعة' : 'Needs review';
  return labels[stage]?.[lang] || (lang === 'ar' ? 'قيد العمل' : 'In progress');
}

export default function DashboardPage() {
  const router = useRouter();
  const { language: lang } = useWahaLanguage();
  const { user, authResolved } = useAuthSession();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<{ total: number; avg: number; best: number } | null>(null);
  const [history, setHistory] = useState<HistoryRow[] | null>(null);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [researcher, setResearcher] = useState<ResearcherSummary | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!authResolved) return;
    if (!user) {
      router.push('/login?redirect=/dashboard');
      return;
    }
    fetch('/api/dashboard-stats', { cache: 'no-store' })
      .then(async (res) => ({ ok: res.ok, status: res.status, data: await res.json() }))
      .then(({ ok, status, data }) => {
        if (status === 401) {
          router.push('/login?redirect=/dashboard');
          return;
        }
        if (ok && data.success) {
          setStats(data.stats);
          setHistory(data.history);
          setProjects(data.projects || []);
          setResearcher(data.researcher || null);
        } else {
          setError(data.error || '');
        }
      })
      .catch(() => setError('حدث خطأ، يرجى المحاولة مجدداً.'))
      .finally(() => setLoading(false));
  }, [authResolved, router, user]);

  const t = COPY[lang];
  const dir = lang === 'ar' ? 'rtl' : 'ltr';

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-950 font-sans pb-20" dir={dir}>
      <SiteHeader />

      <main className="mx-auto max-w-6xl space-y-8 px-4 py-8 sm:px-6 lg:py-12">
        <section className="rounded-3xl bg-gradient-to-l from-[#0B2551] to-[#2563EB] p-7 text-white shadow-xl shadow-blue-900/10 sm:p-10">
          <p className="text-sm font-bold text-blue-100">{t.welcome}{researcher ? ` ${researcher.displayName}` : ''}{researcher?.specialty ? ` · ${researcher.specialty}` : ''}</p>
          <div className="mt-3 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
            <div><h1 className="text-2xl font-black sm:text-3xl">{t.title}</h1><p className="mt-3 max-w-2xl text-sm leading-7 text-blue-100">{t.projectSubtitle}</p></div>
            <Link href="/verify-idea" className="inline-flex shrink-0 items-center justify-center rounded-xl bg-white px-5 py-3 text-sm font-bold text-blue-700 shadow-sm">{t.newProject}</Link>
          </div>
        </section>

        {loading ? (
          <p className="text-slate-500 text-sm">{t.loading}</p>
        ) : error ? (
          <p className="text-red-400 text-sm">{error}</p>
        ) : (
          <>
            <section className="space-y-4">
              <h2 className="text-lg font-black text-[#10213c]">{t.projectsTitle}</h2>
              {projects.length > 0 ? <div className="grid gap-4 md:grid-cols-2">{projects.map((project) => <article key={project.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between gap-4"><div className="min-w-0"><h3 className="truncate font-black text-[#10213c]">{project.title}</h3><p className="mt-1 text-xs text-slate-500">{formatDate(project.created_at, lang)}</p></div><span className="rounded-full bg-blue-50 px-3 py-1 text-[11px] font-bold text-blue-700">{projectStatus(project.status, lang)}</span></div>
                <div className="mt-5 flex flex-wrap gap-2"><Link href={`/research/journey?projectId=${encodeURIComponent(project.id)}`} className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white">{t.openJourney}</Link><Link href={`/projects/workspace?projectId=${encodeURIComponent(project.id)}`} className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700">{t.openWorkspace}</Link></div>
              </article>)}</div> : <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center"><p className="text-sm text-slate-500">{t.noProjects}</p><Link href="/verify-idea" className="mt-4 inline-flex rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white">{t.emptyCta}</Link></div>}
            </section>

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

            {history && history.length > 0 ? (
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
            ) : (
              <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
                <p className="text-slate-900 text-sm font-bold">{t.emptyTitle}</p>
                <p className="text-slate-400 text-xs">{t.emptySubtitle}</p>
                <Link
                  href="/verify-idea"
                  className="inline-flex items-center justify-center px-6 py-3 bg-gradient-to-l from-blue-500 to-teal-400 text-gray-950 font-bold rounded-xl transition-all text-sm"
                >
                  {t.emptyCta}
                </Link>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
