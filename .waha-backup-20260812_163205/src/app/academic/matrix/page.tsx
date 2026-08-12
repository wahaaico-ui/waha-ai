'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function MatrixPage() {
  const [researchTopic, setResearchTopic] = useState('أثر تطبيقات الذكاء الاصطناعي التوليدي في تحسين جودة مخرجات البحث العلمي لطلبة الدراسات العليا');
  const [matrixResult, setMatrixResult] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const generateMatrix = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!researchTopic.trim()) return;

    setLoading(true);
    setError('');
    setMatrixResult([]);

    try {
      const res = await fetch('/api/academic/matrix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ researchTopic }),
      });

      const data = await res.json();
      if (data.success && data.matrixData?.matrixItems) {
        setMatrixResult(data.matrixData.matrixItems);
      } else {
        setError(data.error || 'فشل توليد المصفوفة');
      }
    } catch (err: any) {
      setError(err.message || 'حدث خطأ في الاتصال');
    } finally {
      setLoading(false);
    }
  };

  const exportAsText = () => {
    let content = `مصفوفة تحليل الأدبيات السابقة (Literature Review Matrix)\nموضوع البحث: ${researchTopic}\n\n`;
    matrixResult.forEach((item, idx) => {
      content += `[الدراسة ${idx + 1}]: ${item.authorYear}\n`;
      content += `- الهدف: ${item.objective}\n`;
      content += `- المنهجية: ${item.methodology}\n`;
      content += `- النتائج: ${item.findings}\n`;
      content += `- الفجوة/القصور: ${item.limitations}\n\n`;
    });

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Literature_Review_Matrix.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 p-6 md:p-10">
      
      <div className="flex items-center justify-between border-b border-slate-800 pb-6">
        <div>
          <span className="px-3 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-semibold rounded-full">
            Sprint 17 - Literature Review Synthesis Matrix
          </span>
          <h1 className="text-3xl font-extrabold tracking-tight text-white mt-2">مصفوفة تحليل الأدبيات السابقة</h1>
          <p className="text-slate-400 mt-1">توليد وتنظيم جدول مقارنة وتحليل الدراسات السابقة بدقة أكاديمية عالية</p>
        </div>
        <Link href="/academic" className="px-4 py-2 bg-slate-900 border border-slate-800 hover:border-blue-500/50 rounded-xl text-sm font-medium transition-colors">
          العودة للرئيسية
        </Link>
      </div>

      <form onSubmit={generateMatrix} className="bg-slate-900 border border-slate-800 p-8 rounded-2xl shadow-xl space-y-6">
        <div className="space-y-2">
          <label className="block text-sm font-bold text-slate-200">موضوع البحث أو مجال الدراسات السابقة</label>
          <input
            type="text"
            value={researchTopic}
            onChange={(e) => setResearchTopic(e.target.value)}
            placeholder="اكتب موضوع البحث هنا..."
            className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
          />
        </div>

        {error && <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-sm">{error}</div>}

        <button
          type="submit"
          disabled={loading || !researchTopic.trim()}
          className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-2xl shadow-lg shadow-emerald-600/25 transition-all disabled:opacity-50 text-sm"
        >
          {loading ? 'جارٍ توليد وتحليل مصفوفة الأدبيات السابقة...' : 'توليد مصفوفة الأدبيات السابقة (Matrix) 📊'}
        </button>
      </form>

      {matrixResult.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 p-8 rounded-2xl shadow-2xl space-y-6">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-xl font-bold text-emerald-400">جدول مصفوفة التحليل والمقارنة</h3>
            <button
              onClick={exportAsText}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-medium transition-colors"
            >
              تحميل المصفوفة كملف نصي 📥
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse text-xs">
              <thead>
                <tr className="bg-slate-950 text-emerald-400 border-b border-slate-800">
                  <th className="p-4 font-bold">المؤلف والسنة</th>
                  <th className="p-4 font-bold">هدِف الدراسة</th>
                  <th className="p-4 font-bold">المنهجية والأداة</th>
                  <th className="p-4 font-bold">النتائج الرئيسية</th>
                  <th className="p-4 font-bold">الفجوة / القصور</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-300">
                {matrixResult.map((item: any, idx: number) => (
                  <tr key={idx} className="hover:bg-slate-950/50 transition-colors">
                    <td className="p-4 font-bold text-white whitespace-nowrap">{item.authorYear}</td>
                    <td className="p-4 leading-relaxed">{item.objective}</td>
                    <td className="p-4 leading-relaxed">{item.methodology}</td>
                    <td className="p-4 leading-relaxed">{item.findings}</td>
                    <td className="p-4 leading-relaxed text-slate-400">{item.limitations}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
}
