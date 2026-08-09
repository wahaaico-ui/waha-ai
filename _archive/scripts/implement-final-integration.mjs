import { writeFileSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();

console.log('\n╔══════════════════════════════════════════════════════════════╗');
console.log('║   WAHA  Integration — API & UI with Report Generator         ║');
console.log('╚══════════════════════════════════════════════════════════════╝\n');

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 1. Update API Route to include the professional report
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
writeFileSync(join(ROOT, 'src/app/api/academic/evaluate/route.ts'), `
import { NextResponse } from 'next/server';
import { AcademicDecisionEngine } from '@/lib/academic/core/decision/AcademicDecisionEngine';
import { AcademicReportGenerator } from '@/lib/academic/core/generator/AcademicReportGenerator';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { text } = body;

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return NextResponse.json(
        { error: 'النص المدخل مطلوب ولا يمكن أن يكون فارغاً' },
        { status: 400 }
      );
    }

    const engine = new AcademicDecisionEngine();
    const report = engine.evaluate(text);

    const generator = new AcademicReportGenerator();
    const professionalReportMarkdown = generator.generateProfessionalReport(report);

    return NextResponse.json({
      success: true,
      data: report,
      professionalReport: professionalReportMarkdown
    });
  } catch (error) {
    console.error('API Evaluation Error:', error);
    return NextResponse.json(
      { error: 'حدث خطأ داخلي أثناء معالجة الطلب الأكاديمي' },
      { status: 500 }
    );
  }
}
`.trim() + '\n', 'utf-8');
console.log('  ✔  Updated src/app/api/academic/evaluate/route.ts');

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 2. Update UI Page to display the professional report
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
writeFileSync(join(ROOT, 'src/app/dashboard/evaluate/page.tsx'), `
'use client';
import React, { useState } from 'react';

export default function AcademicEvaluatePage() {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<any>(null);
  const [professionalReport, setProfessionalReport] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const handleEvaluate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;

    setLoading(true);
    setError(null);
    setReport(null);
    setProfessionalReport('');

    try {
      const res = await fetch('/api/academic/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'حدث خطأ غير متوقع');

      setReport(data.data);
      setProfessionalReport(data.professionalReport);
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
            أدخل عنوان بحثك أو فكرتك الأولية للحصول على تحليل متكامل وتوليد التقرير الأكاديمي الاحترافي.
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
                  <span>جاري توليد التقرير الأكاديمي...</span>
                </>
              ) : (
                <span>توليد التقرير الأكاديمي الشامل</span>
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

            {/* Professional Generated Report View */}
            {professionalReport && (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-xl space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                  <h4 className="text-xl font-bold text-indigo-300">التقرير الأكاديمي النهائي</h4>
                  <button
                    onClick={() => navigator.clipboard.writeText(professionalReport)}
                    className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-lg transition-all"
                  >
                    نسخ التقرير
                  </button>
                </div>
                <div className="bg-slate-950 p-6 rounded-xl border border-slate-800 text-slate-300 whitespace-pre-line leading-relaxed text-sm md:text-base">
                  {professionalReport}
                </div>
              </div>
            </div>

          </div>
        )}

      </div>
    </div>
  );
}
`.trim() + '\n', 'utf-8');
console.log('  ✔  Updated src/app/dashboard/evaluate/page.tsx');

console.log('\n✅ Full integration completed successfully.\n');
