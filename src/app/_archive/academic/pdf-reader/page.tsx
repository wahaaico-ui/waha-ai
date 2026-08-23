'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function PdfReaderPage() {
  const [fileName, setFileName] = useState('Research_Paper_Sample.pdf');
  const [textContent, setTextContent] = useState('');
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const analyzeDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!textContent.trim()) return;

    setLoading(true);
    setError('');
    setAnalysisResult(null);

    try {
      const res = await fetch('/api/academic/pdf-analyzer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ textContent, fileName }),
      });

      const data = await res.json();
      if (data.success) {
        setAnalysisResult(data.analysis);
      } else {
        setError(data.error || 'فشل التحليل');
      }
    } catch (err: any) {
      setError(err.message || 'حدث خطأ في الاتصال');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 p-6 md:p-10">

      <div className="flex items-center justify-between border-b border-slate-800 pb-6">
        <div>
          <span className="px-3 py-1 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-xs font-semibold rounded-full">
            Sprint 6 - Local PDF & Document Deep Reader
          </span>
          <h1 className="text-3xl font-extrabold tracking-tight text-white mt-2">قارئ وتحليل المستندات المحلية</h1>
          <p className="text-slate-400 mt-1">تحليل واستخراج رؤى الأوراق البحثية وملفات الـ PDF عبر عقل Gemini بأمان تام</p>
        </div>
        <Link href="/academic" className="px-4 py-2 bg-slate-900 border border-slate-800 hover:border-blue-500/50 rounded-xl text-sm font-medium transition-colors">
          العودة للرئيسية
        </Link>
      </div>

      <form onSubmit={analyzeDocument} className="bg-slate-900 border border-slate-800 p-8 rounded-2xl shadow-xl space-y-6">
        <div className="space-y-2">
          <label className="block text-sm font-bold text-slate-200">اسم المستند أو البحث</label>
          <input
            type="text"
            value={fileName}
            onChange={(e) => setFileName(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-bold text-slate-200">لصق محتوى المستند أو المستخلص هنا</label>
          <textarea
            value={textContent}
            onChange={(e) => setTextContent(e.target.value)}
            placeholder="ألصق النص المستخرج من ملف الـ PDF هنا..."
            className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 h-40 resize-none font-mono"
          />
        </div>

        {error && <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-sm">{error}</div>}

        <button
          type="submit"
          disabled={loading || !textContent.trim()}
          className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-2xl shadow-lg shadow-indigo-600/25 transition-all disabled:opacity-50 text-sm"
        >
          {loading ? 'جارٍ قراءة وتحليل المستند بعمق...' : 'تحليل المستند واستخراج الرؤى 📑'}
        </button>
      </form>

      {analysisResult && (
        <div className="bg-slate-900 border border-slate-800 p-8 rounded-2xl shadow-2xl space-y-6">
          <h3 className="text-xl font-bold text-indigo-400 border-b border-slate-800 pb-3">نتائج التحليل العميق للمستند</h3>

          <div className="space-y-2">
            <h4 className="text-sm font-bold text-slate-200">الملخص التنفيذي:</h4>
            <p className="text-sm text-slate-300 leading-relaxed bg-slate-950 p-4 rounded-xl border border-slate-800">{analysisResult.summary}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <h4 className="text-sm font-bold text-slate-200">المشكلة والأهداف:</h4>
              <p className="text-xs text-slate-300 leading-relaxed bg-slate-950 p-4 rounded-xl border border-slate-800">{analysisResult.problemAndObjectives}</p>
            </div>
            <div className="space-y-2">
              <h4 className="text-sm font-bold text-slate-200">المنهجية والأدوات:</h4>
              <p className="text-xs text-slate-300 leading-relaxed bg-slate-950 p-4 rounded-xl border border-slate-800">{analysisResult.methodology}</p>
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="text-sm font-bold text-emerald-400">النتائج الرئيسية:</h4>
            <ul className="space-y-1 bg-slate-950 p-4 rounded-xl border border-slate-800">
              {analysisResult.keyFindings?.map((f: string, i: number) => (
                <li key={i} className="text-xs text-slate-300 flex items-start gap-2">
                  <span className="text-emerald-400 font-bold">•</span> {f}
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-2">
            <h4 className="text-sm font-bold text-amber-400">نقاط القوة والثغرات:</h4>
            <p className="text-xs text-slate-300 leading-relaxed bg-slate-950 p-4 rounded-xl border border-slate-800">{analysisResult.strengthsAndLimitations}</p>
          </div>
        </div>
      )}

    </div>
  );
}
