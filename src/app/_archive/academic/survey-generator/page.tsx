'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function SurveyGeneratorPage() {
  const [title, setTitle] = useState('أثر الذكاء الاصطناعي التوليدي على كفاءة البحث العلمي');
  const [variables, setVariables] = useState('المستقل: أدوات الذكاء الاصطناعي | التابع: الإنتاجية البحثية، دقة النتائج، الموثوقية');
  const [surveyData, setSurveyData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const generateSurvey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setLoading(true);
    setError('');
    setSurveyData([]);

    try {
      const res = await fetch('/api/academic/survey', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, variables }),
      });

      const data = await res.json();
      if (data.success && data.survey?.surveySections) {
        setSurveyData(data.survey.surveySections);
      } else {
        setError(data.error || 'فشل توليد الاستبيان');
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
          <span className="px-3 py-1 bg-rose-500/10 text-rose-400 border border-rose-500/20 text-xs font-semibold rounded-full">
            Sprint 14 - Survey & Questionnaire Generator
          </span>
          <h1 className="text-3xl font-extrabold tracking-tight text-white mt-2">مُولد الاستبيانات وأدوات جمع البيانات</h1>
          <p className="text-slate-400 mt-1">تصميم وتوليد محاور وعبارات الاستبيان الأكاديمي بناءً على مقياس ليكرت الخماسي</p>
        </div>
        <Link href="/academic" className="px-4 py-2 bg-slate-900 border border-slate-800 hover:border-blue-500/50 rounded-xl text-sm font-medium transition-colors">
          العودة للرئيسية
        </Link>
      </div>

      <form onSubmit={generateSurvey} className="bg-slate-900 border border-slate-800 p-8 rounded-2xl shadow-xl space-y-6">
        <div className="space-y-2">
          <label className="block text-sm font-bold text-slate-200">عنوان البحث أو المشروع</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-sm text-slate-100 focus:outline-none focus:border-rose-500"
          />
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-bold text-slate-200">المتغيرات أو المحاور المطلوبة</label>
          <input
            type="text"
            value={variables}
            onChange={(e) => setVariables(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-sm text-slate-100 focus:outline-none focus:border-rose-500"
          />
        </div>

        {error && <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-sm">{error}</div>}

        <button
          type="submit"
          disabled={loading || !title.trim()}
          className="w-full py-4 bg-rose-600 hover:bg-rose-500 text-white font-semibold rounded-2xl shadow-lg shadow-rose-600/25 transition-all disabled:opacity-50 text-sm"
        >
          {loading ? 'جارٍ تصميم عبارات ومحاور الاستبيان...' : 'توليد استبيان البحث العلمي (ليكيرت) 📝'}
        </button>
      </form>

      {surveyData.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 p-8 rounded-2xl shadow-2xl space-y-6">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-xl font-bold text-rose-400">محاور وعبارات الاستبيان المقترحة</h3>
            <button
              onClick={() => {
                let text = `استبيان بحثي: ${title}\n\n`;
                surveyData.forEach((sec, idx) => {
                  text += `المحور ${idx + 1}: ${sec.sectionTitle}\n`;
                  sec.items?.forEach((item: string, i: number) => {
                    text += `  ${i + 1}. ${item}\n`;
                  });
                  text += '\n';
                });
                const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'Survey_Questionnaire.txt';
                a.click();
                URL.revokeObjectURL(url);
              }}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-medium transition-colors"
            >
              تحميل الاستبيان كملف 📥
            </button>
          </div>

          <div className="space-y-6">
            {surveyData.map((section: any, idx: number) => (
              <div key={idx} className="bg-slate-950 p-6 rounded-2xl border border-slate-800 space-y-4">
                <h4 className="font-bold text-sm text-rose-300 border-b border-slate-800 pb-2">
                  المحور {idx + 1}: {section.sectionTitle}
                </h4>
                <ul className="space-y-2">
                  {section.items?.map((item: string, i: number) => (
                    <li key={i} className="text-xs text-slate-300 flex items-start gap-3 bg-slate-900 p-3 rounded-xl border border-slate-800/80">
                      <span className="text-rose-400 font-bold shrink-0">{i + 1}.</span>
                      <span className="flex-1 leading-relaxed">{item}</span>
                      <span className="text-[10px] text-slate-500 shrink-0 self-center font-mono">[موافق بشدة... غير موافق]</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
