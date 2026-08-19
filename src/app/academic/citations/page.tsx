'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function CitationsPage() {
  const [sourceInput, setSourceInput] = useState('كتاب بعنوان: الذكاء الاصطناعي في التعليم العالي، المؤلف: أحمد محمد علي، سنة النشر: 2023، دار النشر: دار الفكر العربي، القاهرة.');
  const [citations, setCitations] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copiedStyle, setCopiedStyle] = useState('');

  const generateCitations = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sourceInput.trim()) return;

    setLoading(true);
    setError('');
    setCitations(null);

    try {
      const res = await fetch('/api/academic/citations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceInput }),
      });

      const data = await res.json();
      if (data.success) {
        setCitations(data.citations);
      } else {
        setError(data.error || 'فشل التنسيق');
      }
    } catch (err: any) {
      setError(err.message || 'حدث خطأ في الاتصال');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string, style: string) => {
    navigator.clipboard.writeText(text);
    setCopiedStyle(style);
    setTimeout(() => setCopiedStyle(''), 2000);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 p-6 md:p-10">

      <div className="flex items-center justify-between border-b border-slate-800 pb-6">
        <div>
          <span className="px-3 py-1 bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 text-xs font-semibold rounded-full">
            Sprint 19 - Academic Citation & Reference Formatter
          </span>
          <h1 className="text-3xl font-extrabold tracking-tight text-white mt-2">محرك تنسيق وتوثيق المراجع الأكاديمية</h1>
          <p className="text-slate-400 mt-1">توليد التوثيق المرجعي الدقيق تلقائياً حسب أنظمة APA, IEEE, Harvard, MLA</p>
        </div>
        <Link href="/academic" className="px-4 py-2 bg-slate-900 border border-slate-800 hover:border-blue-500/50 rounded-xl text-sm font-medium transition-colors">
          العودة للرئيسية
        </Link>
      </div>

      <form onSubmit={generateCitations} className="bg-slate-900 border border-slate-800 p-8 rounded-2xl shadow-xl space-y-6">
        <div className="space-y-2">
          <label className="block text-sm font-bold text-slate-200">بيانات المصدر أو الكتاب أو المقال (عنوان، مؤلف، سنة، رابط...)</label>
          <textarea
            value={sourceInput}
            onChange={(e) => setSourceInput(e.target.value)}
            placeholder="اكتب تفاصيل المصدر هنا..."
            className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 h-32 resize-none"
          />
        </div>

        {error && <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-sm">{error}</div>}

        <button
          type="submit"
          disabled={loading || !sourceInput.trim()}
          className="w-full py-4 bg-cyan-600 hover:bg-cyan-500 text-white font-semibold rounded-2xl shadow-lg shadow-cyan-600/25 transition-all disabled:opacity-50 text-sm"
        >
          {loading ? 'جارٍ تنسيق المرجع حسب النظم الأكاديمية...' : 'تنسيق وتوليد المراجع 📚'}
        </button>
      </form>

      {citations && (
        <div className="bg-slate-900 border border-slate-800 p-8 rounded-2xl shadow-2xl space-y-6">
          <h3 className="text-xl font-bold text-cyan-400 border-b border-slate-800 pb-4">نتائج التوثيق الأكاديمي للمصدر</h3>

          <div className="grid grid-cols-1 gap-4">

            {/* APA */}
            <div className="bg-slate-950 p-5 rounded-xl border border-slate-800 flex items-center justify-between gap-4">
              <div>
                <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider">APA (7th Edition)</span>
                <p className="text-sm font-mono text-slate-200 mt-1">{citations.apa}</p>
              </div>
              <button
                onClick={() => copyToClipboard(citations.apa, 'apa')}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded-lg shrink-0 transition-colors"
              >
                {copiedStyle === 'apa' ? 'تم النسخ! ✓' : 'نسخ'}
              </button>
            </div>

            {/* IEEE */}
            <div className="bg-slate-950 p-5 rounded-xl border border-slate-800 flex items-center justify-between gap-4">
              <div>
                <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider">IEEE</span>
                <p className="text-sm font-mono text-slate-200 mt-1">{citations.ieee}</p>
              </div>
              <button
                onClick={() => copyToClipboard(citations.ieee, 'ieee')}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded-lg shrink-0 transition-colors"
              >
                {copiedStyle === 'ieee' ? 'تم النسخ! ✓' : 'نسخ'}
              </button>
            </div>

            {/* Harvard */}
            <div className="bg-slate-950 p-5 rounded-xl border border-slate-800 flex items-center justify-between gap-4">
              <div>
                <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider">Harvard</span>
                <p className="text-sm font-mono text-slate-200 mt-1">{citations.harvard}</p>
              </div>
              <button
                onClick={() => copyToClipboard(citations.harvard, 'harvard')}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded-lg shrink-0 transition-colors"
              >
                {copiedStyle === 'harvard' ? 'تم النسخ! ✓' : 'نسخ'}
              </button>
            </div>

            {/* MLA */}
            <div className="bg-slate-950 p-5 rounded-xl border border-slate-800 flex items-center justify-between gap-4">
              <div>
                <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider">MLA (9th Edition)</span>
                <p className="text-sm font-mono text-slate-200 mt-1">{citations.mla}</p>
              </div>
              <button
                onClick={() => copyToClipboard(citations.mla, 'mla')}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded-lg shrink-0 transition-colors"
              >
                {copiedStyle === 'mla' ? 'تم النسخ! ✓' : 'نسخ'}
              </button>
            </div>

          </div>

          {citations.notes && citations.notes !== 'لا توجد' && (
            <div className="p-4 bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 rounded-xl text-xs">
              <strong>ملاحظات التوثيق:</strong> {citations.notes}
            </div>
          )}
        </div>
      )}

    </div>
  );
}
