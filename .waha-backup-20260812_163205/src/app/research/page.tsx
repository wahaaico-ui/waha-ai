"use client";
import React, { useState } from 'react';

interface SuitabilityLevel {
  suitable: boolean;
  level: string;
  reason: string;
}

interface TitleSuggestion {
  title: string;
  rank: number;
  reason: string;
  strength: string;
}

interface AcademicReport {
  score: number;
  isSuitableAsTitle: boolean;
  suitabilityReason: string;
  strengths: string[];
  weaknesses: string[];
  needsNarrowing: boolean;
  narrowingAdvice: string | null;
  suggestedTitles: TitleSuggestion[];
  finalRecommendation: string;
  recommendedTitle: string;
  recommendedTitleReason: string;
  mastersLevel: SuitabilityLevel;
  phdLevel: SuitabilityLevel;
  publicationLevel: SuitabilityLevel;
  isRejectedTitle: boolean;
  rejectionAnalysis: string | null;
  rejectionFixes: string[] | null;
}

interface ApiResponse {
  success: boolean;
  message?: string;
  academicThinking?: {
    valid: boolean;
    category: string;
    reason: string | null;
    ideaConfidence: number;
    missingComponents: string[];
    structure: {
      independentVariable: string | null;
      dependentVariable: string | null;
      population: string | null;
      location: string | null;
      studyType: string;
    };
  };
  report?: AcademicReport;
  context?: {
    papers?: Array<{
      title: string;
      publicationYear: number | null;
      authors: string;
      citationCount: number;
      doi: string;
    }>;
    statistics?: {
      totalPapers: number;
      latestYear: number | null;
      oldestYear: number | null;
    };
  };
}

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 80 ? 'text-emerald-400' : score >= 60 ? 'text-amber-400' : 'text-red-400';
  const bg = score >= 80 ? 'bg-emerald-900/30 border-emerald-700' : score >= 60 ? 'bg-amber-900/30 border-amber-700' : 'bg-red-900/30 border-red-700';
  return (
    <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl border ${bg}`}>
      <span className={`text-4xl font-black ${color}`}>{score}</span>
      <span className="text-slate-400 text-xs">/100</span>
    </div>
  );
}

function SuitabilityCard({ label, data }: { label: string; data: SuitabilityLevel }) {
  const color = data.suitable ? 'border-emerald-700 bg-emerald-900/20' : 'border-red-800 bg-red-900/20';
  const icon = data.suitable ? '✅' : '❌';
  return (
    <div className={`rounded-xl border p-3 ${color}`}>
      <div className="flex items-center gap-2 mb-1">
        <span>{icon}</span>
        <span className="text-xs font-bold text-white">{label}</span>
        <span className="text-xs text-slate-400 mr-auto">{data.level}</span>
      </div>
      <p className="text-xs text-slate-300">{data.reason}</p>
    </div>
  );
}

export default function WAHAResearchPage() {
  const [idea, setIdea] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ApiResponse | null>(null);
  const [error, setError] = useState('');

  const analyze = async () => {
    if (!idea.trim()) return;
    setLoading(true);
    setResult(null);
    setError('');
    try {
      const res = await fetch('/api/analyze-idea', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ideaText: idea }),
      });
      const data = await res.json();
      setResult(data);
    } catch {
      setError('حدث خطأ، يرجى المحاولة مجدداً.');
    } finally {
      setLoading(false);
    }
  };

  const thinking = result?.academicThinking;
  const report = result?.report;
  const papers = result?.context?.papers ?? [];
  const stats = result?.context?.statistics;

  return (
    <div className="min-h-screen bg-[#0F172A] text-white font-sans pb-16" dir="rtl">
      <header className="border-b border-slate-800 py-4 px-6 flex justify-between items-center">
        <span className="text-xs bg-blue-900 text-blue-300 font-bold px-3 py-1 rounded-full">المشرف الأكاديمي الرقمي</span>
        <div className="text-xl font-black text-white">WAHA <span className="text-blue-400">AI</span></div>
      </header>

      <main className="max-w-3xl mx-auto px-4 mt-10 space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-extrabold text-white">فحص الفكرة البحثية</h1>
          <p className="text-slate-400 text-sm mt-2">اكتب فكرتك أو عنوانك — سيحللها WAHA كمشرف أكاديمي حقيقي</p>
        </div>

        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5">
          <textarea
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
            disabled={loading}
            placeholder="اكتب فكرتك البحثية أو عنوانك أو عنواناً مرفوضاً هنا..."
            className="w-full h-28 bg-slate-900 border border-slate-700 rounded-xl p-4 text-right text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 resize-none"
          />
          {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
          <button
            onClick={analyze}
            disabled={loading || !idea.trim()}
            className="w-full mt-4 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white font-bold py-3 rounded-xl transition-all text-sm"
          >
            {loading ? '⏳ جاري التحليل الأكاديمي...' : '🔬 تحليل أكاديمي شامل'}
          </button>
        </div>

        {result && (
          <div className="space-y-5">

            {/* رفض أكاديمي */}
            {!result.success && (
              <div className="bg-red-900/40 border border-red-700 rounded-2xl p-5">
                <p className="text-red-300 font-bold text-sm">{result.message}</p>
                {thinking && (
                  <div className="mt-3 space-y-1 text-xs text-red-200">
                    <p>التصنيف: {thinking.category}</p>
                    <p>السبب: {thinking.reason}</p>
                    {thinking.missingComponents.length > 0 && (
                      <p>الناقص: {thinking.missingComponents.join('، ')}</p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* تحليل العنوان المرفوض */}
            {result.success && report?.isRejectedTitle && (
              <div className="bg-orange-900/40 border border-orange-700 rounded-2xl p-5">
                <h2 className="text-sm font-bold text-orange-400 mb-3">⚠️ تحليل العنوان المرفوض</h2>
                <p className="text-orange-200 text-sm">{report.rejectionAnalysis}</p>
                {report.rejectionFixes && (
                  <div className="mt-3">
                    <p className="text-xs font-bold text-orange-400 mb-2">الحلول المقترحة:</p>
                    <ul className="space-y-1">
                      {report.rejectionFixes.map((fix, i) => (
                        <li key={i} className="text-xs text-orange-200 flex gap-2">
                          <span className="text-orange-400">←</span> {fix}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* التحليل الأكاديمي */}
            {result.success && thinking && (
              <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5">
                <h2 className="text-sm font-bold text-blue-400 mb-3">🧠 التحليل الأكاديمي</h2>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="bg-slate-900 rounded-xl p-3">
                    <p className="text-slate-500 mb-1">التصنيف</p>
                    <p className="font-bold text-white">{thinking.category}</p>
                  </div>
                  <div className="bg-slate-900 rounded-xl p-3">
                    <p className="text-slate-500 mb-1">نوع الدراسة</p>
                    <p className="font-bold text-white">{thinking.structure.studyType}</p>
                  </div>
                  <div className="bg-slate-900 rounded-xl p-3">
                    <p className="text-slate-500 mb-1">المتغير المستقل</p>
                    <p className="font-bold text-blue-300">{thinking.structure.independentVariable ?? '—'}</p>
                  </div>
                  <div className="bg-slate-900 rounded-xl p-3">
                    <p className="text-slate-500 mb-1">المتغير التابع</p>
                    <p className="font-bold text-emerald-300">{thinking.structure.dependentVariable ?? '—'}</p>
                  </div>
                  {thinking.structure.population && (
                    <div className="bg-slate-900 rounded-xl p-3">
                      <p className="text-slate-500 mb-1">المجتمع</p>
                      <p className="font-bold text-white">{thinking.structure.population}</p>
                    </div>
                  )}
                  {thinking.structure.location && (
                    <div className="bg-slate-900 rounded-xl p-3">
                      <p className="text-slate-500 mb-1">المكان</p>
                      <p className="font-bold text-white">{thinking.structure.location}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* التقرير الأكاديمي */}
            {result.success && report && (
              <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5 space-y-5">
                <h2 className="text-sm font-bold text-blue-400">📊 التقرير الأكاديمي الشامل</h2>

                {/* الدرجة */}
                <div className="flex items-center gap-4">
                  <ScoreBadge score={report.score} />
                  <p className="text-white text-sm font-bold">{report.suitabilityReason}</p>
                </div>

                {/* قوة وضعف */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-emerald-900/30 border border-emerald-800 rounded-xl p-3">
                    <p className="text-emerald-400 text-xs font-bold mb-2">✅ نقاط القوة</p>
                    <ul className="space-y-1">
                      {report.strengths.map((s, i) => <li key={i} className="text-xs text-emerald-200">{s}</li>)}
                    </ul>
                  </div>
                  <div className="bg-amber-900/30 border border-amber-800 rounded-xl p-3">
                    <p className="text-amber-400 text-xs font-bold mb-2">⚠️ نقاط الضعف</p>
                    <ul className="space-y-1">
                      {report.weaknesses.map((w, i) => <li key={i} className="text-xs text-amber-200">{w}</li>)}
                    </ul>
                  </div>
                </div>

                {/* ملاءمة الدرجات */}
                <div>
                  <p className="text-slate-400 text-xs font-bold mb-3">🎓 ملاءمة مستوى الدراسة والنشر</p>
                  <div className="space-y-2">
                    <SuitabilityCard label="ماجستير" data={report.mastersLevel} />
                    <SuitabilityCard label="دكتوراه" data={report.phdLevel} />
                    <SuitabilityCard label="قابل للنشر" data={report.publicationLevel} />
                  </div>
                </div>

                {/* العناوين المقترحة */}
                <div>
                  <p className="text-slate-400 text-xs font-bold mb-3">📝 أفضل العناوين المقترحة</p>
                  <div className="space-y-3">
                    {report.suggestedTitles.map((t) => (
                      <div key={t.rank} className={`rounded-xl p-3 border ${t.rank === 1 ? 'border-blue-600 bg-blue-900/30' : 'border-slate-700 bg-slate-900'}`}>
                        <div className="flex justify-between items-center mb-2">
                          <span className={`text-xs font-bold px-2 py-0.5 rounded ${t.strength === 'قوي جداً' ? 'bg-blue-700 text-blue-200' : t.strength === 'قوي' ? 'bg-emerald-800 text-emerald-200' : 'bg-slate-700 text-slate-300'}`}>
                            {t.strength}
                          </span>
                          <span className="text-slate-500 text-xs">#{t.rank}</span>
                        </div>
                        <p className="text-white text-sm font-bold">{t.title}</p>
                        <p className="text-slate-400 text-xs mt-1">{t.reason}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* التوصية النهائية */}
                <div className="bg-blue-900/40 border border-blue-700 rounded-xl p-4">
                  <p className="text-blue-400 text-xs font-bold mb-2">🏆 توصية WAHA النهائية</p>
                  <p className="text-white text-sm font-bold">{report.recommendedTitle}</p>
                  <p className="text-blue-200 text-xs mt-2">{report.recommendedTitleReason}</p>
                  <p className="text-slate-300 text-xs mt-2 border-t border-blue-800 pt-2">{report.finalRecommendation}</p>
                </div>
              </div>
            )}

            {/* الأبحاث */}
            {result.success && papers.length > 0 && (
              <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5">
                <h2 className="text-sm font-bold text-blue-400 mb-1">📚 الأبحاث ذات الصلة</h2>
                {stats && (
                  <p className="text-slate-500 text-xs mb-4">
                    {stats.totalPapers} ورقة بحثية · من {stats.oldestYear} إلى {stats.latestYear}
                  </p>
                )}
                <div className="space-y-3 max-h-72 overflow-y-auto" dir="ltr">
                  {papers.map((p, i) => (
                    <div key={i} className="border-b border-slate-700 pb-3 last:border-none">
                      <p className="text-white text-xs font-bold leading-snug">{p.title}</p>
                      <p className="text-slate-500 text-[10px] mt-1">
                        {p.authors} · {p.publicationYear ?? '—'} · {p.citationCount} citations
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        )}
      </main>
    </div>
  );
}
