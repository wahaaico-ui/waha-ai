'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function SeminarProposalPage() {
  const [title, setTitle] = useState('منصة ذكية قائمة على الذكاء الاصطناعي لتحليل الأدبيات الأكاديمية وصياغة المقترحات');
  const [objectives, setObjectives] = useState('1. بناء محرك لاستخلاص الأدبيات.\n2. تصميم مصفوفة مقارنة ذكية.\n3. أتمتة صياغة مقترحات السيمينار.');
  const [methodology, setMethodology] = useState('المنهج التجريبي والتطويري لهندسة البرمجيات الأكاديمية.');
  const [significance, setSignificance] = useState('توفير 50% من جهد الباحثين في تلخيص الدراسات السابقة وضمان دقة المنهجية.');

  const [proposalResult, setProposalResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const generateProposal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setLoading(true);
    setError('');
    setProposalResult(null);

    try {
      const res = await fetch('/api/academic/proposal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, objectives, methodology, significance }),
      });

      const data = await res.json();
      if (data.success) {
        setProposalResult(data.proposal);
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
          <span className="px-3 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-semibold rounded-full">
            Sprint 10 - Seminar & Research Proposal Generator
          </span>
          <h1 className="text-3xl font-extrabold tracking-tight text-white mt-2">مُولد مقترحات السيمينار والتقارير</h1>
          <p className="text-slate-400 mt-1">إنشاء وثيقة السيمينار الأكاديمية الشاملة والرسمية بضغطة زر واحدة</p>
        </div>
        <Link href="/academic" className="px-4 py-2 bg-slate-900 border border-slate-800 hover:border-blue-500/50 rounded-xl text-sm font-medium transition-colors">
          العودة للرئيسية
        </Link>
      </div>

      <form onSubmit={generateProposal} className="bg-slate-900 border border-slate-800 p-8 rounded-2xl shadow-xl space-y-6">
        <div className="space-y-2">
          <label className="block text-sm font-bold text-slate-200">عنوان البحث المقترح</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="block text-sm font-bold text-slate-200">الأهداف الرئيسية</label>
            <textarea
              value={objectives}
              onChange={(e) => setObjectives(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-3 text-xs text-slate-100 focus:outline-none focus:border-emerald-500 h-28 resize-none font-mono"
            />
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-bold text-slate-200">المنهجية المقترحة</label>
            <textarea
              value={methodology}
              onChange={(e) => setMethodology(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-3 text-xs text-slate-100 focus:outline-none focus:border-emerald-500 h-28 resize-none font-mono"
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-bold text-slate-200">الأهمية العلمية والعملية للبحث</label>
          <input
            type="text"
            value={significance}
            onChange={(e) => setSignificance(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
          />
        </div>

        {error && <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-sm">{error}</div>}

        <button
          type="submit"
          disabled={loading || !title.trim()}
          className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-2xl shadow-lg shadow-emerald-600/25 transition-all disabled:opacity-50 text-sm"
        >
          {loading ? 'جارٍ صياغة وثيقة السيمينار الأكاديمية...' : 'توليد وثيقة السيمينار والمقترح الشامل 📋'}
        </button>
      </form>

      {proposalResult && (
        <div className="bg-slate-900 border border-slate-800 p-8 rounded-2xl shadow-2xl space-y-6">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-xl font-bold text-emerald-400">وثيقة السيمينار الأكاديمي الرسمية</h3>
            <button
              onClick={() => {
                const docText = `عنوان البحث: ${title}\n\n1. المقدمة:\n${proposalResult.introduction}\n\n2. المشكلة:\n${proposalResult.problemAndQuestions}\n\n3. الأهداف:\n${proposalResult.objectivesAndSignificance}\n\n4. المنهجية:\n${proposalResult.methodologyFramework}\n\n5. النتائج المتوقعة:\n${proposalResult.expectedOutcomes}\n\n6. الجدول الزمني:\n${proposalResult.timeline}`;
                const blob = new Blob([docText], { type: 'text/plain;charset=utf-8' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'Seminar_Proposal_Document.txt';
                a.click();
                URL.revokeObjectURL(url);
              }}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-medium transition-colors"
            >
              تحميل الوثيقة الرسمية 📥
            </button>
          </div>

          <div className="space-y-2">
            <h4 className="text-sm font-bold text-slate-200">1. المقدمة والخلفية النظرية:</h4>
            <p className="text-sm text-slate-300 leading-relaxed bg-slate-950 p-4 rounded-xl border border-slate-800">{proposalResult.introduction}</p>
          </div>

          <div className="space-y-2">
            <h4 className="text-sm font-bold text-slate-200">2. مشكلة البحث الأسئلة:</h4>
            <p className="text-sm text-slate-300 leading-relaxed bg-slate-950 p-4 rounded-xl border border-slate-800">{proposalResult.problemAndQuestions}</p>
          </div>

          <div className="space-y-2">
            <h4 className="text-sm font-bold text-slate-200">3. الأهداف والأهمية:</h4>
            <p className="text-sm text-slate-300 leading-relaxed bg-slate-950 p-4 rounded-xl border border-slate-800">{proposalResult.objectivesAndSignificance}</p>
          </div>

          <div className="space-y-2">
            <h4 className="text-sm font-bold text-slate-200">4. الإطار المنهجي:</h4>
            <p className="text-sm text-slate-300 leading-relaxed bg-slate-950 p-4 rounded-xl border border-slate-800">{proposalResult.methodologyFramework}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <h4 className="text-sm font-bold text-emerald-400">النتائج المتوقعة:</h4>
              <p className="text-xs text-slate-300 leading-relaxed bg-slate-950 p-4 rounded-xl border border-slate-800">{proposalResult.expectedOutcomes}</p>
            </div>
            <div className="space-y-2">
              <h4 className="text-sm font-bold text-blue-400">الجدول الزمني المقترح:</h4>
              <p className="text-xs text-slate-300 leading-relaxed bg-slate-950 p-4 rounded-xl border border-slate-800">{proposalResult.timeline}</p>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
