'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function AbstractGeneratorPage() {
  const [rawNotes, setRawNotes] = useState('قمنا بدراسة تأثير استخدام الذكاء الاصطناعي التوليدي في تحسين وتطوير سرعة كتابة الأبحاث الأكاديمية لطلبة الدراسات العليا عبر منهج تجريبي شمل 50 طالباً، وأظهرت النتائج زيادة الإنتاجية بنسبة 40% مع الحفاظ على الرصانة العلمية.');
  const [keywords, setKeywords] = useState('الذكاء الاصطناعي التوليدي، البحث العلمي، الدراسات العليا، الإنتاجية الأكاديمية');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState('');

  const generateAbstract = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rawNotes.trim()) return;

    setLoading(true);
    setError('');
    setResult(null);

    try {
      const res = await fetch('/api/academic/abstract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawNotes, keywords }),
      });

      const data = await res.json();
      if (data.success) {
        setResult(data.abstractData);
      } else {
        setError(data.error || 'فشل التوليد');
      }
    } catch (err: any) {
      setError(err.message || 'حدث خطأ في الاتصال');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(''), 2000);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 p-6 md:p-10">

      <div className="flex items-center justify-between border-b border-slate-800 pb-6">
        <div>
          <span className="px-3 py-1 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-xs font-semibold rounded-full">
            Sprint 15 - Abstract & Title Generator Engine
          </span>
          <h1 className="text-3xl font-extrabold tracking-tight text-white mt-2">مُولد ومحسن العناوين والمستخلصات الأكاديمية</h1>
          <p className="text-slate-400 mt-1">هندسة وصياغة المستخلص المهيكل (Structured Abstract) والعناوين العلمية الجذابة</p>
        </div>
        <Link href="/academic" className="px-4 py-2 bg-slate-900 border border-slate-800 hover:border-blue-500/50 rounded-xl text-sm font-medium transition-colors">
          العودة للرئيسية
        </Link>
      </div>

      <form onSubmit={generateAbstract} className="bg-slate-900 border border-slate-800 p-8 rounded-2xl shadow-xl space-y-6">
        <div className="space-y-2">
          <label className="block text-sm font-bold text-slate-200">مسودة البحث أو الملاحظات والنتائج الأولية</label>
          <textarea
            value={rawNotes}
            onChange={(e) => setRawNotes(e.target.value)}
            placeholder="اكتب مسودة البحث هنا..."
            className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 h-36 resize-none font-mono"
          />
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-bold text-slate-200">الكلمات المفتاحية المقترحة (اختياري)</label>
          <input
            type="text"
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
          />
        </div>

        {error && <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-sm">{error}</div>}

        <button
          type="submit"
          disabled={loading || !rawNotes.trim()}
          className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-2xl shadow-lg shadow-indigo-600/25 transition-all disabled:opacity-50 text-sm"
        >
          {loading ? 'جارٍ صياغة وتوليد المستخلص والعناوين...' : 'توليد المستخلص المهيكل والعناوين الأكاديمية ✍️'}
        </button>
      </form>

      {result && (
        <div className="bg-slate-900 border border-slate-800 p-8 rounded-2xl shadow-2xl space-y-6">

          {/* العناوين المقترحة */}
          <div className="space-y-3">
            <h3 className="text-lg font-bold text-indigo-400 border-b border-slate-800 pb-2">العناوين البحثية المقترحة ذات التأثير العالي</h3>
            <div className="grid grid-cols-1 gap-3">
              {result.suggestedTitles?.map((title: string, i: number) => (
                <div key={i} className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-200">{i + 1}. {title}</span>
                  <button
                    onClick={() => copyToClipboard(title, `title-${i}`)}
                    className="text-indigo-400 hover:underline shrink-0 ml-4"
                  >
                    {copied === `title-${i}` ? 'تم النسخ ✓' : 'نسخ'}
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* المستخلص المهيكل */}
          <div className="space-y-4 pt-4 border-t border-slate-800">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-indigo-400">المستخلص الأكاديمي المهيكل (Structured Abstract)</h3>
              <button
                onClick={() => {
                  const fullAbstract = `Background: ${result.abstract?.background}\nObjective: ${result.abstract?.objective}\nMethodology: ${result.abstract?.methodology}\nFindings: ${result.abstract?.findings}\nConclusion: ${result.abstract?.conclusion}\nKeywords: ${result.keywordsList?.join(', ')}`;
                  copyToClipboard(fullAbstract, 'full-abs');
                }}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-medium transition-colors"
              >
                {copied === 'full-abs' ? 'تم نسخ المستخلص كاملاً ✓' : 'نسخ المستخلص كاملاً 📋'}
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-1">
                <strong className="text-indigo-300 block">الخلفية والأهمية (Background):</strong>
                <p className="text-slate-300 leading-relaxed">{result.abstract?.background}</p>
              </div>
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-1">
                <strong className="text-indigo-300 block">الهدف الرئيسي (Objective):</strong>
                <p className="text-slate-300 leading-relaxed">{result.abstract?.objective}</p>
              </div>
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-1">
                <strong className="text-indigo-300 block">المنهجية (Methodology):</strong>
                <p className="text-slate-300 leading-relaxed">{result.abstract?.methodology}</p>
              </div>
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-1">
                <strong className="text-indigo-300 block">النتائج الرئيسية (Key Findings):</strong>
                <p className="text-slate-300 leading-relaxed">{result.abstract?.findings}</p>
              </div>
            </div>

            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-1 text-xs">
              <strong className="text-indigo-300 block">الاستنتاج والتوصيات (Conclusion):</strong>
              <p className="text-slate-300 leading-relaxed">{result.abstract?.conclusion}</p>
            </div>

            {/* الكلمات المفتاحية */}
            <div className="flex flex-wrap items-center gap-2 pt-2">
              <span className="text-xs font-bold text-slate-400">الكلمات المفتاحية:</span>
              {result.keywordsList?.map((kw: string, i: number) => (
                <span key={i} className="px-3 py-1 bg-slate-950 text-indigo-300 border border-indigo-500/20 text-xs rounded-full">
                  {kw}
                </span>
              ))}
            </div>

          </div>

        </div>
      )}

    </div>
  );
}
