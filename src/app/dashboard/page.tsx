'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function DashboardPage() {
  const [query, setQuery] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');
  const [savedProjects, setSavedProjects] = useState<any[]>([]);
  const [emailStatus, setEmailStatus] = useState('');
  const [userId, setUserId] = useState('default-researcher-id');

  useEffect(() => {
    const storedUser = localStorage.getItem('waha_user_id');
    if (storedUser) setUserId(storedUser);

    fetch('/api/waha/projects')
      .then((res) => res.json())
      .then((data) => {
        if (data.projects) setSavedProjects(data.projects);
      })
      .catch((err) => console.error('فشل جلب الأرشيف:', err));
  }, [result]);

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setResult(null);
    setEmailStatus('');

    try {
      const res = await fetch('/api/waha/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, userId }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'فشل التحليل');
      setResult(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleExportDocument = () => {
    if (!result) return;

    const htmlContent = `
      <html dir="rtl" lang="ar">
        <head>
          <meta charset="utf-8" />
          <title>${result.idea}</title>
          <style>
            body { font-family: 'Amiri', Arial, sans-serif; padding: 40px; color: #111; line-height: 1.8; }
            h1 { color: #1e3a8a; border-bottom: 2px solid #1e3a8a; padding-bottom: 10px; }
            h2 { color: #1e40af; margin-top: 20px; }
            .box { background: #f8fafc; border: 1px solid #e2e8f0; padding: 15px; border-radius: 8px; margin-bottom: 15px; }
          </style>
        </head>
        <body>
          <h1>تقرير البحث الأكاديمي السيادي</h1>
          <p><strong>العنوان:</strong> ${result.idea}</p>
          
          <h2>الملخص الأكاديمي (Abstract)</h2>
          <div class="box"><p>${result.arabicAbstract}</p></div>
          <div class="box" dir="ltr"><p><strong>English Abstract:</strong> ${result.englishAbstract}</p></div>

          <h2>مشكلة البحث والفجوة المعرفية</h2>
          <div class="box"><p>${result.problemStatement}</p><p>${result.researchGap}</p></div>

          <h2>الأهداف والأسئلة والفرضيات</h2>
          <div class="box">
            <strong>الأهداف:</strong>
            <ul>${result.objectives?.map((o: string) => `<li>${o}</li>`).join('')}</ul>
            <strong>الأسئلة:</strong>
            <ul>${result.questions?.map((q: string) => `<li>${q}</li>`).join('')}</ul>
            <strong>الفرضيات:</strong>
            <ul>${result.hypotheses?.map((h: string) => `<li>${h}</li>`).join('')}</ul>
          </div>

          <h2>المنهجية والمجتمع وعينة الدراسة والأداة</h2>
          <div class="box">
            <p>${result.researchMethodology}</p>
            <p>${result.populationAndSample}</p>
            <p>${result.researchInstrument}</p>
          </div>

          <h2>التحليل الإحصائي والنتائج والمناقشة</h2>
          <div class="box">
            <p>${result.statisticalAnalysis}</p>
            <strong>النتائج الرئيسية:</strong>
            <ul>${result.keyResults?.map((r: string) => `<li>${r}</li>`).join('')}</ul>
            <p><strong>المناقشة والتوصيات:</strong> ${result.discussion}</p>
            <ul>${result.recommendations?.map((rec: string) => `<li>${rec}</li>`).join('')}</ul>
          </div>

          <h2>قائمة المراجع والمصادر (APA 7th Edition)</h2>
          <ul>
            ${result.referencesList?.map((ref: any) => `<li>${ref.apaString}</li>`).join('')}
          </ul>
        </body>
      </html>
    `;

    const blob = new Blob(['\ufeff' + htmlContent], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${result.idea.slice(0, 30)}_Academic_Report.doc`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleSendEmail = async () => {
    if (!emailInput || !result) return;
    setEmailLoading(true);
    setEmailStatus('');

    try {
      const res = await fetch('/api/waha/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: emailInput,
          reportTitle: result.idea,
          researchGap: result.researchGap,
          arabicAbstract: result.arabicAbstract
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'فشل الإرسال');
      setEmailStatus(data.message);
    } catch (err: any) {
      setEmailStatus(`خطأ: ${err.message}`);
    } finally {
      setEmailLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white p-8 font-sans" dir="rtl">
      <div className="max-w-7xl mx-auto">
        <header className="mb-10 border-b border-slate-800 pb-6 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-white">لوحة تحكم الباحث الأكاديمي</h1>
            <p className="text-slate-400 text-sm mt-1">تصدير المستندات الفعلي، نظام المصادقة، وتوثيق APA 7 - WAHA AI</p>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/auth" className="px-4 py-2 bg-blue-600/20 text-blue-400 border border-blue-500/30 rounded-xl text-sm transition-all hover:bg-blue-600/30">
              تسجيل الحساب / الخروج
            </Link>
            <Link href="/" className="px-4 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 rounded-xl text-sm transition-all">
              الرئيسية
            </Link>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Form & Session History */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl shadow-2xl">
              <h3 className="text-lg font-bold text-white mb-4">فكرة بحثية جديدة</h3>
              <form onSubmit={handleAnalyze} className="space-y-4">
                <div>
                  <textarea
                    rows={4}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="مثال: دور الذكاء الاصطناعي في تحسين كفاءة البحث العلمي"
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-sm text-white focus:outline-none focus:border-blue-500 resize-none"
                    required
                  ></textarea>
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium py-3.5 rounded-xl transition-all shadow-lg shadow-blue-600/20 text-sm disabled:opacity-50"
                >
                  {loading ? 'معالجة المراحل الـ 15...' : 'بدء التحليل وتوثيق الجلسة'}
                </button>
              </form>
            </div>

            {/* Archive */}
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl shadow-xl space-y-4">
              <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider">سجل الأبحاث المحفوظة ({savedProjects.length})</h3>
              <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
                {savedProjects.length > 0 ? (
                  savedProjects.map((proj, idx) => (
                    <div key={idx} className="p-3.5 bg-slate-950 border border-slate-800 rounded-2xl text-xs space-y-1 hover:border-slate-700 transition-all cursor-pointer">
                      <div className="font-bold text-white truncate">{proj.title}</div>
                      <div className="flex justify-between text-[10px] text-slate-400">
                        <span>الحالة: <strong className="text-emerald-400">{proj.status}</strong></span>
                        <span>{new Date(proj.created_at || Date.now()).toLocaleDateString('ar-SA')}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-500 text-center py-4">لا توجد أبحاث محفوظة في الأرشيف.</p>
                )}
              </div>
            </div>
          </div>

          {/* Results Section */}
          <div className="lg:col-span-8 space-y-6">
            {error && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-5 rounded-2xl text-sm">
                <strong>تنبيه الجودة:</strong> {error}
              </div>
            )}

            {result ? (
              <div className="space-y-6">
                
                {/* Indicators */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl flex items-center justify-between">
                    <div>
                      <div className="text-xs text-slate-400">فحص الاقتباس</div>
                      <div className="text-xl font-bold text-emerald-400 mt-1">{result.plagiarismScore}%</div>
                    </div>
                    <span className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse"></span>
                  </div>
                  <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl flex items-center justify-between">
                    <div>
                      <div className="text-xs text-slate-400">ترابط الأفكار</div>
                      <div className="text-xl font-bold text-blue-400 mt-1">{result.coherenceScore}%</div>
                    </div>
                    <span className="w-3 h-3 rounded-full bg-blue-500 animate-pulse"></span>
                  </div>
                  <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl flex items-center justify-between">
                    <div>
                      <div className="text-xs text-slate-400">سلامة التوثيق (APA 7)</div>
                      <div className="text-xl font-bold text-purple-400 mt-1">{result.citationIntegrityScore}%</div>
                    </div>
                    <span className="w-3 h-3 rounded-full bg-purple-500 animate-pulse"></span>
                  </div>
                </div>

                {/* Abstracts */}
                <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl shadow-xl space-y-4">
                  <h3 className="text-lg font-bold text-blue-400">الملخص الأكاديمي (عربي / إنجليزي)</h3>
                  <div className="space-y-3 text-xs text-slate-300">
                    <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl leading-relaxed">
                      <strong className="text-white block mb-1">الملخص العربي:</strong>
                      {result.arabicAbstract}
                    </div>
                    <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl leading-relaxed" dir="ltr">
                      <strong className="text-white block mb-1 text-right" dir="rtl">Abstract (English):</strong>
                      {result.englishAbstract}
                    </div>
                  </div>
                </div>

                {/* Problem & Gap */}
                <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl shadow-xl space-y-4">
                  <h3 className="text-lg font-bold text-blue-400">مشكلة البحث والفجوة المعرفية</h3>
                  <p className="text-slate-300 text-sm leading-relaxed">{result.problemStatement}</p>
                  <p className="text-slate-400 text-sm leading-relaxed border-t border-slate-800 pt-3">{result.researchGap}</p>
                </div>

                {/* References */}
                <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl shadow-xl space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-bold text-purple-400">قائمة المراجع والمصادر (APA 7th Edition)</h3>
                    <span className="text-xs text-slate-400">{result.formattingStatus}</span>
                  </div>
                  <div className="space-y-3 max-h-[250px] overflow-y-auto pr-2">
                    {result.referencesList?.map((refItem: any, idx: number) => (
                      <div key={idx} className="p-3 bg-slate-950 border border-slate-800 rounded-2xl text-xs space-y-1">
                        <div className="text-slate-200 font-serif leading-relaxed" dir="ltr">{refItem.apaString}</div>
                        <div className="text-[11px] text-purple-400">توثيق داخل النص: <code>{refItem.inTextCitation}</code></div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Export & Email Package */}
                <div className="bg-slate-900 border border-emerald-500/30 p-6 rounded-3xl shadow-xl space-y-4">
                  <h4 className="font-bold text-emerald-400 text-sm">حزمة النشر والتصدير الفعلي</h4>
                  <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-4 text-xs">
                    <button
                      onClick={handleExportDocument}
                      className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-emerald-600/20 text-xs"
                    >
                      تنزيل المستند الأكاديمي كاملاً (ملف Word / Docx)
                    </button>

                    <div className="flex gap-2 pt-2 border-t border-slate-900">
                      <input
                        type="email"
                        value={emailInput}
                        onChange={(e) => setEmailInput(e.target.value)}
                        placeholder="أدخل بريدك الإلكتروني لاستلام التقرير"
                        className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-emerald-500"
                      />
                      <button
                        onClick={handleSendEmail}
                        disabled={emailLoading || !emailInput}
                        className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-6 py-2.5 rounded-xl transition-all disabled:opacity-50"
                      >
                        {emailLoading ? 'جاري الإرسال...' : 'إرسال للإيميل'}
                      </button>
                    </div>
                    {emailStatus && (
                      <p className="text-emerald-400 font-medium">{emailStatus}</p>
                    )}
                  </div>
                </div>

              </div>
            ) : (
              <div className="bg-slate-900 border border-slate-800 p-16 rounded-3xl text-center text-slate-500">
                <p className="text-sm">أدخل فكرتك البحثية لبدء التشغيل السيادي، توثيق المراجع، والتصدير المباشر.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
