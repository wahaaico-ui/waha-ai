"use client";
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import SiteHeader from '@/components/SiteHeader';
import ScoreCircle from '@/components/ScoreCircle';

const LANG_KEY = 'waha_lang';

interface HistoryRow {
  id: string;
  idea_text: string;
  report_score: number;
  created_at: string;
}

const COPY = {
  ar: {
    title: 'لوحة التحكم',
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
    title: 'Dashboard',
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

export default function DashboardPage() {
  const router = useRouter();
  const [lang, setLang] = useState<'ar' | 'en'>('ar');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<{ total: number; avg: number; best: number } | null>(null);
  const [history, setHistory] = useState<HistoryRow[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const storedLang = localStorage.getItem(LANG_KEY);
    if (storedLang === 'ar' || storedLang === 'en') setLang(storedLang);

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.push('/login');
        return;
      }
      fetch('/api/dashboard-stats')
        .then((res) => res.json())
        .then((data) => {
          if (data.success) {
            setStats(data.stats);
            setHistory(data.history);
          } else {
            setError(data.error || '');
          }
        })
        .catch(() => setError('حدث خطأ، يرجى المحاولة مجدداً.'))
        .finally(() => setLoading(false));
    });
  }, [router]);

  const toggleLang = () => {
    const next = lang === 'ar' ? 'en' : 'ar';
    setLang(next);
    localStorage.setItem(LANG_KEY, next);
  };

  const t = COPY[lang];
  const dir = lang === 'ar' ? 'rtl' : 'ltr';

  return (
    <div className="min-h-screen bg-[#0A0F1C] text-white font-sans pb-20" dir={dir}>
      <SiteHeader />

      <main className="max-w-4xl mx-auto px-4 mt-10 space-y-8">
        <h1 className="text-2xl font-black">{t.title}</h1>

        {loading ? (
          <p className="text-slate-500 text-sm">{t.loading}</p>
        ) : error ? (
          <p className="text-red-400 text-sm">{error}</p>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-2xl p-5 text-center">
                <p className="text-3xl font-black text-white">{stats!.total}</p>
                <p className="text-slate-500 text-xs mt-2">{t.total}</p>
              </div>
              <div className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-2xl p-5 text-center">
                <p className="text-3xl font-black text-teal-400">{stats!.avg}%</p>
                <p className="text-slate-500 text-xs mt-2">{t.avg}</p>
              </div>
              <div className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-2xl p-5 text-center">
                <p className="text-3xl font-black text-emerald-400">{stats!.best}%</p>
                <p className="text-slate-500 text-xs mt-2">{t.best}</p>
              </div>
            </div>

            {history && history.length > 0 ? (
              <div className="space-y-3">
                <h2 className="text-xs font-bold text-slate-500">{t.historyTitle}</h2>
                {history.map((row) => (
                  <div
                    key={row.id}
                    className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-2xl p-4 flex items-center gap-4"
                  >
                    <ScoreCircle score={row.report_score} size={56} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-white truncate">{row.idea_text}</p>
                      <p className="text-slate-500 text-[11px] mt-1">{formatDate(row.created_at, lang)}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-2xl p-10 text-center space-y-4">
                <p className="text-white text-sm font-bold">{t.emptyTitle}</p>
                <p className="text-slate-400 text-xs">{t.emptySubtitle}</p>
                <Link
                  href="/research"
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
