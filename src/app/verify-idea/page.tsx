'use client';

import { useState, useEffect } from 'react';
import JourneyProgress from '@/components/JourneyProgress';
import { supabase } from '@/lib/supabase/client';
import AuthGate from '@/components/AuthGate';

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

interface Paper {
  title: string;
  year: number;
  citations: number;
  url: string;
  source: 'semanticscholar' | 'openalex' | 'both';
  authors?: string[];
  venue?: string;
}

interface VerifyReport {
  topic: string;
  totalPapers: number;
  yearDistribution: { year: number; count: number }[];
  geographicDistribution: { region: string; count: number }[];
  gaps: string[];
  acceptanceScore: number;
  scoreBreakdown: {
    gapExists: number;
    recency: number;
    methodDiversity: number;
    geoDiversity: number;
    sufficientRefs: number;
    consistency: number;
  };
  decision: 'reject' | 'improve' | 'proceed';
  decisionMessage: string;
  alternativeAngles?: string[];
  improvements?: string[];
  topPapers: Paper[];
  usageInfo?: {
    count: number;
    limit: number;
    isFirstCheck: boolean;
    isBlurred: boolean;
    isBlocked: boolean;
  };
}

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
  return COUNTRY_NAMES[code] || code;
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
  if (d === 'proceed') return '✓ فكرة قوية — انتقل للمرحلة التالية';
  if (d === 'improve') return '⚠ فكرة تحتاج تحسين قبل الاعتماد';
  return '✗ فكرة ضعيفة — لا نوصي بالاستثمار فيها بصيغتها الحالية';
}

function scoreBarColor(score: number): string {
  if (score >= 60) return 'bg-emerald-500';
  if (score >= 30) return 'bg-amber-500';
  return 'bg-rose-500';
}

// ============================================================
// MAIN PAGE
// ============================================================
export default function VerifyIdeaPage() {
  const [topic, setTopic] = useState('');
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<VerifyReport | null>(null);
  const [error, setError] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setIsAuthenticated(!!data.user);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(!!session?.user);
    });
    return () => listener.subscription.unsubscribe();
  }, []);
  const [history, setHistory] = useState<HistoryItem[]>([]);

  useEffect(() => {
    fetch('/api/verify-idea/history')
      .then(r => r.json())
      .then(d => setHistory(d.items || []))
      .catch(() => {});
  }, [report]); // Refresh after each new verification

  const handleVerify = async () => {
    if (!topic.trim() || topic.trim().length < 5) {
      setError('اكتب موضوعاً بحثياً واضحاً (5 أحرف على الأقل)');
      return;
    }
    setError('');
    setReport(null);
    setLoading(true);
    try {
      const res = await fetch('/api/verify-idea', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: topic.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'حدث خطأ. حاول مرة أخرى.');
        setLoading(false);
        return;
      }
      setReport(data);
    } catch (e: any) {
      setError('تعذّر الاتصال بالخادم. تحقق من الإنترنت وحاول مجدداً.');
    } finally {
      setLoading(false);
    }
  };

  const maxYearCount = report ? Math.max(...report.yearDistribution.map(y => y.count), 1) : 1;

  return (
    <div dir="rtl" className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <JourneyProgress current="verify" lang="ar" />
      <div className="max-w-4xl mx-auto px-6 py-12">
        {/* HEADER */}
        <div className="mb-10 text-center">
          <div className="inline-block px-4 py-1 rounded-full bg-teal-50 border border-teal-200 text-teal-700 text-sm font-semibold mb-4">
            المرحلة صفر · قبل صياغة العنوان
          </div>
          <h1 className="text-4xl font-bold text-slate-800 mb-3">
            فحص عذرية الفكرة
          </h1>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
            قبل أن تستثمر شهوراً في بناء فكرتك، دعنا نتحقق: هل مساحة البحث فيها فرصة حقيقية؟
            أم أنها مشبعة أو ضعيفة؟
          </p>
        </div>

        {/* HISTORY */}
        {history.length > 0 && !report && !loading && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 mb-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-slate-800 text-sm">فحوصاتك السابقة</h3>
              <span className="text-xs text-slate-500">{history.length} فحص</span>
            </div>
            <div className="space-y-2">
              {history.slice(0, 5).map((h) => {
                const scoreColor = h.acceptance_score >= 60 ? 'text-emerald-600' : h.acceptance_score >= 30 ? 'text-amber-600' : 'text-rose-600';
                const decisionLabel = h.decision === 'proceed' ? 'قوية' : h.decision === 'improve' ? 'تحتاج تحسين' : 'ضعيفة';
                const decisionBg = h.decision === 'proceed' ? 'bg-emerald-50 text-emerald-700' : h.decision === 'improve' ? 'bg-amber-50 text-amber-700' : 'bg-rose-50 text-rose-700';
                const date = new Date(h.created_at).toLocaleDateString('ar', { day: 'numeric', month: 'short' });
                return (
                  <button
                    key={h.id}
                    onClick={() => setTopic(h.topic)}
                    className="w-full text-right p-3 rounded-lg border border-slate-200 hover:border-teal-300 hover:bg-slate-50 transition group"
                  >
                    <div className="flex items-center justify-between gap-3 mb-1">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${decisionBg}`}>{decisionLabel}</span>
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <span className={`font-bold ${scoreColor}`}>{h.acceptance_score}/100</span>
                        <span>·</span>
                        <span>{date}</span>
                      </div>
                    </div>
                    <div className="text-sm text-slate-700 line-clamp-1 group-hover:text-teal-700">{h.topic}</div>
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-slate-400 text-center mt-3">اضغط على أي فحص لإعادة تعبئته</p>
          </div>
        )}

        {/* INPUT */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-6">
          <label className="block text-sm font-semibold text-slate-700 mb-2">
            موضوعك البحثي العام <span className="text-slate-400 font-normal">(ليس عنواناً — فكرة عامة)</span>
          </label>
          <textarea
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="مثال: أثر الذكاء الاصطناعي على تعلم اللغة العربية لطلاب الجامعات"
            className="w-full min-h-[100px] px-4 py-3 rounded-xl border border-slate-300 focus:border-teal-500 focus:ring-2 focus:ring-teal-100 outline-none text-slate-800 text-lg resize-none"
            disabled={loading}
          />
          {error && (
            <div className="mt-3 px-4 py-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-sm">
              {error}
            </div>
          )}
          <button
            onClick={handleVerify}
            disabled={loading || !topic.trim()}
            className="mt-4 w-full py-3 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 text-white font-semibold text-lg hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            {loading ? 'جارٍ الفحص في المصادر الأكاديمية...' : 'ابدأ الفحص'}
          </button>
          <p className="mt-3 text-xs text-slate-500 text-center">
            سنبحث في Semantic Scholar و OpenAlex معاً — قد يستغرق الفحص 10-20 ثانية
          </p>
        </div>

        {/* LOADING STATE */}
        {loading && (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center">
            <div className="inline-block w-12 h-12 border-4 border-teal-200 border-t-teal-600 rounded-full animate-spin mb-4"></div>
            <p className="text-slate-600">نفحص عذرية فكرتك في قواعد البيانات العالمية...</p>
          </div>
        )}

        {/* REPORT */}
        {report && !loading && (() => {
          const usage = report.usageInfo;
          const showBlur = !isAuthenticated && usage?.isBlurred;
          const showBlock = !isAuthenticated && usage?.isBlocked;
          return (
            <div className="relative">
              {showBlock && <AuthGate variant="block" />}
              {showBlur && !showBlock && <AuthGate variant="blur" />}
              <div className={(showBlur || showBlock) ? "blur-sm pointer-events-none select-none space-y-6" : "space-y-6"}>

            {/* DECISION BANNER */}
            <div className={`bg-gradient-to-r ${decisionColor(report.decision)} rounded-2xl p-6 text-white shadow-md`}>
              <div className="flex items-center justify-between mb-3">
                <div className="text-3xl font-bold">{report.acceptanceScore}<span className="text-xl opacity-70">/100</span></div>
                <div className="text-sm opacity-80">نسبة القبول الأكاديمي</div>
              </div>
              <div className="text-lg font-semibold mb-2">{decisionLabel(report.decision)}</div>
              <div className="text-sm opacity-95 leading-relaxed">{report.decisionMessage}</div>
            </div>

            {/* SCORE BREAKDOWN */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6">
              <h3 className="font-bold text-slate-800 mb-4">تفصيل نسبة القبول (الحساب الشفاف)</h3>
              <div className="space-y-3">
                {[
                  { label: 'وجود فجوة معرفية حقيقية', value: report.scoreBreakdown.gapExists, max: 25 },
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
            </div>

            {/* STATS OVERVIEW */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white rounded-2xl border border-slate-200 p-5 text-center">
                <div className="text-3xl font-bold text-teal-600">{report.totalPapers}</div>
                <div className="text-sm text-slate-600 mt-1">دراسة موجودة في المصادر</div>
              </div>
              <div className="bg-white rounded-2xl border border-slate-200 p-5 text-center">
                <div className="text-3xl font-bold text-blue-600">{report.geographicDistribution.length}</div>
                <div className="text-sm text-slate-600 mt-1">دولة تناولت هذا الموضوع</div>
              </div>
              <div className="bg-white rounded-2xl border border-slate-200 p-5 text-center">
                <div className="text-3xl font-bold text-purple-600">{report.gaps.length}</div>
                <div className="text-sm text-slate-600 mt-1">فجوة تم اكتشافها</div>
              </div>
            </div>

            {/* GAPS */}
            {report.gaps.length > 0 && (
              <div className="bg-white rounded-2xl border border-slate-200 p-6">
                <h3 className="font-bold text-slate-800 mb-4">الفجوات المكتشفة</h3>
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
                <h3 className="font-bold text-rose-800 mb-4">زوايا بديلة مقترحة</h3>
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
                <h3 className="font-bold text-amber-800 mb-4">تحسينات مطلوبة لرفع النسبة</h3>
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

            {/* PROCEED CTA (if strong) */}
            {report.decision === 'proceed' && (
              <div className="bg-emerald-50 border-2 border-emerald-300 rounded-2xl p-6 text-center">
                <div className="text-emerald-800 font-semibold mb-3">
                  فكرتك قوية. الخطوة التالية: صياغة العنوان.
                </div>
                <a href={`/research?topic=${encodeURIComponent(report.topic)}`} className="inline-block px-6 py-3 bg-emerald-600 text-white rounded-xl font-semibold hover:bg-emerald-700 transition">
                  انتقل إلى صياغة العنوان ←
                </a>
              </div>
            )}

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
                <h3 className="font-bold text-slate-800 mb-4">التوزيع الجغرافي</h3>
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
              <div className="bg-white rounded-2xl border border-slate-200 p-6">
                <h3 className="font-bold text-slate-800 mb-4">أهم الدراسات المرجعية (5 دراسات)</h3>
                <div className="space-y-3">
                  {report.topPapers.map((p, i) => (
                    <div key={i} className="border-r-4 border-teal-500 pr-4 py-2">
                      <div className="flex items-start justify-between gap-3 mb-1">
                        <div className="text-xs font-semibold text-teal-600">
                          {p.source === 'both' ? 'مصدران' : p.source === 'openalex' ? 'OpenAlex' : 'Semantic Scholar'}
                          {p.year > 0 && ` · ${p.year}`}
                          {p.citations > 0 && ` · ${p.citations} استشهاد`}
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

              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
