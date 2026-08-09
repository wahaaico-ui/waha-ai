'./use client';

import { useState } from 'react';
import Link from 'next/link';

export default function LiteratureReviewPage() {
  const [topic, setTopic] = useState('أثر الذكاء الاصطناعي التوليدي على كفاءة البحث العلمي');
  const [papersNotes, setPapersNotes] = useState(
    'الدراسة الأولى (Smith et al., 2024): تناولت استخدام النماذج اللغوية الكبيرة في تلخيص الأبحاث وأشارت إلى توفير 40% من الوقت.\n' +
    'الدراسة الثانية (الجهني، 2025): ركزت على التحديات الأخلاقية وفقدان التفكير النقدي لدى الباحثين المبتدئين.\n' +
    'الدراسة الثالثة (Johnson, 2025): بحثت تكامل أدوات الذكاء الاصطناعي مع منصات إدارة قواعد البيانات البحثية.'
  );
  const [reviewResult, setReviewResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const generateReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim() || !papersNotes.trim()) return;

    setLoading(true);
    setError('');
    setReviewResult(null);

    try {
      const res = await fetch('/api/academic/literature-synth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, papersNotes }),
      });

      const data = await res.json();
      if (data.success) {
        setReviewResult(data.literatureReview);
      } else {
        setError(data.error || 'فشل التوليد');
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
          <span className="px-3 py-1 bg-pink-500/10 text-pink-400 border border-pink-500/20 text-xs font-semibold rounded-full">
            Sprint 7 - Literature Review Synthesizer
          </span>
          <h1 className="text-3xl font-extrabold tracking-tight text-white mt-2">مُولد مراجعة الأدبيات (Literature Review)</h1>
          <p className="text-slate-400 mt-1">تخليق ودمج الدراسات السابقة في فصل أكاديمي مترابط ومنظم ذكياً</p>
        </div>
        <Link href="/academic" className="px-4 py-2 bg-slate-900 border border-slate-800 hover:border-blue-500/50 rounded-xl text-sm font-medium transition-colors">
          العودة للرئيسية
        </Link>
      </div>

      <form onSubmit={generateReview} className="bg-slate-900 border border-slate-800 p-8 rounded-2xl shadow-xl space-y-6">
        <div className="space-y-2">
          <label className="block text-sm font-bold text-slate-200">عنوان الموضوع أو البحث الرئيسي</label>
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-sm text-slate-100 focus:outline-none focus:border-pink-500"
          />
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-bold text-slate-200">ملخصات وملاحظات الدراسات السابقة</label>
          <textarea
            value={papersNotes}
            onChange={(e) => setPapersNotes(e.target.value)}
            placeholder="اكتب أو ألصق ملخصات الأبحاث السابقة هنا..."
            className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-pink-500 h-40 resize-none font-mono"
          />
        </div>

        {error && <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-sm">{error}</div>}

        <button
          type="submit"
          disabled={loading || !topic.trim()}
          className="w-full py-4 bg-pink-600 hover:bg-pink-500 text-white font-semibold rounded-2xl shadow-lg shadow-pink-600/25 transition-all disabled:opacity-50 text-sm"
        >
          {loading ? 'جارٍ تخليق وصياغة مراجعة الأدبيات...' : 'تخليق فصل مراجعة الأدبيات أكاديمياً 📚'}
        </button>
      </form>

      {reviewResult && (
        <div className="bg-slate-900 border border-slate-800 p-8 rounded-2xl shadow-2xl space-y-6">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-xl font-bold text-pink-400">فصل مراجعة الأدبيات المُخلق</h3>
            <button
              onClick={() => {
                const text = `موضوع البحث: ${topic}\n\n1. المقدمة:\n${reviewResult.introduction}\n\n2. التخليق الموضوعي:\n${reviewResult.thematicSynthesis}\n\n3. الخاتمة:\n${reviewResult.conclusion}`;
                const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'Literature_Review_Chapter.txt';
                a.click();
                URL.revokeObjectURL(url);
              }}
              className="px-4 py-2 bg-pink-600 hover:bg-pink-500 text-white rounded-xl text-xs font-medium transition-colors"
            >
              تحميل الفصل كملف 📥
            </button>
          </div>

          <div className="space-y-2">
            <h4 className="text-sm font-bold text-slate-200">1. المقدمة وتأطير الموضوع:</h4>
            <p className="text-sm text-slate-300 leading-relaxed bg-slate-950 p-4 rounded-xl border border-slate-800">{reviewResult.introduction}</p>
          </div>

          <div className="space-y-2">
            <h4 className="text-sm font-bold text-slate-200">2. التخليق الموضوعي والمقارنة:</h4>
            <p className="text-sm text-slate-300 leading-relaxed bg-slate-950 p-4 rounded-xl border border-slate-800">{reviewResult.thematicSynthesis}</p>
          </div>

          <div className="space-y-2">
            <h4 className="text-sm font-bold text-amber-400">3. الفجوات البحثية المستخلصة:</h4>
            <ul className="space-y-1 bg-slate-950 p-4 rounded-xl border border-slate-800">
              {reviewResult.researchGapsIdentified?.map((g: string, i: number) => (
                <li key={i} className="text-xs text-slate-300 flex items-start gap-2">
                  <span className="text-amber-400 font-bold">•</span> {g}
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-2">
            <h4 className="text-sm font-bold text-slate-200">4. الخاتمة والتوجه المقترح:</h4>
            <p className="text-sm text-slate-300 leading-relaxed bg-slate-950 p-4 rounded-xl border border-slate-800">{reviewResult.conclusion}</p>
          </div>
        </div>
      )}

    </div>
  );
}
