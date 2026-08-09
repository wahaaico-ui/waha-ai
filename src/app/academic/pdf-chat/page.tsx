'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function LocalPdfChatPage() {
  const [fileBase64, setFileBase64] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [question, setQuestion] = useState<string>('');
  const [answer, setAnswer] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      setError('الرجاء اختيار ملف PDF صالح');
      return;
    }

    setFileName(file.name);
    setError('');

    const reader = new FileReader();
    reader.onload = () => {
      const base64String = (reader.result as string).split(',')[1];
      setFileBase64(base64String);
    };
    reader.onerror = () => {
      setError('فشل قراءة الملف المحلي');
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fileBase64) {
      setError('الرجاء رفع ملف PDF أولاً');
      return;
    }

    setLoading(true);
    setError('');
    setAnswer('');

    try {
      const res = await fetch('/api/academic/pdf-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileBase64, question }),
      });

      const data = await res.json();
      if (data.success) {
        setAnswer(data.answer);
      } else {
        setError(data.error || 'فشل تحليل الملف');
      }
    } catch (err: any) {
      setError(err.message || 'خطأ في الاتصال');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10">
      <div className="max-w-4xl mx-auto space-y-8">
        
        <div className="flex items-center justify-between border-b border-slate-800 pb-6">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-white">محادثة وتحليل ملفات الـ PDF المحلية</h1>
            <p className="text-slate-400 mt-1">ارفع أي ملف بحثي من جهازك واستجوبه مباشرة باستخدام ميزة الرؤية والتحليل العميق لـ Gemini.</p>
          </div>
          <Link href="/academic" className="px-4 py-2 bg-slate-900 border border-slate-800 hover:border-blue-500/50 rounded-xl text-sm font-medium transition-colors">
            العودة للبحث
          </Link>
        </div>

        <form onSubmit={handleSubmit} className="bg-slate-900 border border-slate-800 p-8 rounded-2xl shadow-xl space-y-6">
          
          <div className="space-y-2">
            <label className="block text-sm font-bold text-slate-200">اختر ملف PDF من جهازك</label>
            <input
              type="file"
              accept="application/pdf"
              onChange={handleFileChange}
              className="w-full text-sm text-slate-400 file:mr-4 file:py-3 file:px-6 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-500 cursor-pointer bg-slate-950 border border-slate-800 rounded-2xl p-3"
            />
            {fileName && <p className="text-xs text-emerald-400 mt-1">تم إرفاق الملف: {fileName}</p>}
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-bold text-slate-200">سؤالك أو طلب التلخيص (اختياري)</label>
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="اتركه فارغاً لتوليد تلخيص شامل، أو اطرح سؤالاً محدداً حول الورقة..."
              className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 h-28 resize-none"
            />
          </div>

          {error && <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-sm">{error}</div>}

          <button
            type="submit"
            disabled={loading || !fileBase64}
            className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-2xl shadow-lg shadow-blue-600/20 transition-all disabled:opacity-50 text-sm"
          >
            {loading ? 'جارٍ قراءة وتحليل ملف الـ PDF...' : 'تحليل واستجواب الملف عبر Gemini'}
          </button>

        </form>

        {answer && (
          <div className="bg-slate-900 border border-slate-800 p-8 rounded-2xl shadow-2xl space-y-4">
            <h3 className="text-xl font-bold text-blue-400 border-b border-slate-800 pb-3">نتيجة التحليل والإجابة</h3>
            <div className="prose prose-invert max-w-none text-slate-300 leading-relaxed whitespace-pre-wrap">
              {answer}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
