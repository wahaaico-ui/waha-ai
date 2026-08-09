import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();

function dir(p) { mkdirSync(join(ROOT, p), { recursive: true }); }
function write(p, c) {
  writeFileSync(join(ROOT, p), c.trimStart() + '\n', 'utf-8');
  console.log('  ✔  ' + p);
}

console.log('\n╔══════════════════════════════════════════════════════════════╗');
console.log('║   WAHA  Sprint 2  Task 2  —  Professional UI Dashboard       ║');
console.log('╚══════════════════════════════════════════════════════════════╝\n');

dir('src/app/dashboard/evaluate');

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// FILE 1 — UI Page Component (Tailwind + RTL + Interactive)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
write('src/app/dashboard/evaluate/page.tsx', `
'type client';
import React, { useState } from 'react';

export default function AcademicEvaluatePage() {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleEvaluate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;

    setLoading(true);
    setError(null);
    setReport(null);

    try {
      const res = await fetch('/api/academic/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'حدث خطأ غير متوقع');

      setReport(data.data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-12 font-sans" dir="rtl">
      <div className="max-w-5xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="text-center space-y-3">
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
            منصة وُهى الذكية — محرك تقييم الأبحاث الأكاديمية
          </h1>
          <p className="text-slate-400 text-sm md:text-base max-w-2xl mx-auto">
            أدخل عنوان بحثك أو فكرتك الأولية للحصول على تحليل متكامل للنيا، الجاهزية، الفجوات، والأدبيات العلمية.
          </p>
        </div>

        {/* Input Form Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
          <form onSubmit={handleEvaluate} className="space-y-4">
            <label className="block text-sm font-semibold text-slate-300">
              عنوان البحث أو فكرة الدراسة:
            </label>
            <textarea
              rows={3}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="مثال: أثر الذكاء الاصطناعي على التحصيل الأكاديمي لدى طلبة الجامعات..."
              className="w-full bg-slate-950 border border-slate-700 rounded-xl p-4 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all resize-none"
            />
            <button
              type="submit"
              disabled={loading || !text.trim()}
              className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-semibold py-3 px-6 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>جاري التحليل المعرفي...</span>
                </>
              ) : (
                <span>تقييم وفحص الفكرة الأكاديمية</span>
              )}
            </button>
          </form>

          {error && (
            <div className="mt-4 p-4 bg-red-950/50 border border-red-800/50 text-red-300 rounded-xl text-sm">
              {error}
            </div>
          )}
        </div>

        {/* Results Section */}
        {report && (
          <div className="space-y-6 animate-fade-in">
            
            {/* Verdict Card */}
            <div className="bg-gradient-to-r from-slate-900 to-slate-870 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="space-y-2 text-center md:text-right">
                <span className="text-xs uppercase tracking-wider px-3 py-1 bg-indigo-950 text-indigo-300 rounded-full font-bold">
                  القرار النهائي: {report.finalVerdict.status}
                </span>
                <h3 className="text-xl font-bold text-slate-100">{report.finalVerdict.summaryMessage}</h3>
              </div>
              <div className="flex items-center gap-3 bg-slate-950 px-6 py-4 rounded-xl border border-slate-800">
                <div className="text-3xl font-black text-indigo-400">{report.finalVerdict.score}</div>
                <div className="text-xs text-slate-400 leading-tight">درجة الجودة<br/>الأكاديمية /100</div>
              </div>
            </div>

            {/* Grid Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Intent & Variables */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
                <h4 className="text-lg font-bold text-indigo-300 border-b border-slate-800 pb-2">تحليل النية والمتغيرات</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-slate-400">النية المكتشفة:</span> <span className="font-semibold text-slate-200">{report.intentResult.intent}</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">مستوى الثقة:</span> <span className="font-semibold text-slate-200">{report.intentResult.confidence}%</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">المتغير المستقل:</span> <span className="font-semibold text-indigo-400">{report.intentResult.independentVariable || 'غير محدد'}</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">المتغير التابع:</span> <span className="font-semibold text-indigo-400">{report.intentResult.dependentVariable || 'غير محدد'}</span></div>
                </div>
              </div>

              {/* Intelligence & Saturation */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
                <h4 className="text-lg font-bold text-indigo-300 border-b border-slate-800 pb-2">معلومات واتجاهات المجال</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-slate-400">نسبة تشبع المجال:</span> <span className="font-semibold text-slate-200">{Math.round(report.intelligenceReport.fieldSaturation * 100)}%</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">مؤشر الاتجاه الحديث:</span> <span className="font-semibold text-slate-200">{report.intelligenceReport.trendScore * 100}%</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">المراجع المرتبطة:</span> <span className="font-semibold text-slate-200">{report.evidencePackage.referenceCount} مراجع</span></div>
                </div>
              </div>

            </div>

            {/* Gaps Section */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
              <h4 className="text-lg font-bold text-indigo-300 border-b border-slate-800 pb-2">الفجوات البحثية المكتشفة</h4>
              <ul className="space-y-2 text-sm list-disc list-inside text-slate-300">
                {report.gapAnalysisResult.identifiedGaps.map((gap: any, index: number) => (
                  <li key={index} className="leading-relaxed">
                    <span className="font-semibold text-indigo-400">[{gap.significance}]:</span> {gap.description}
                  </li>
                ))}
              </ul>
            </div>

          </div>
        )}

      </div>
    </div>
  );
}
`);

console.log('\n✅ Sprint 2 Task 2 implementation completed successfully.\n');
