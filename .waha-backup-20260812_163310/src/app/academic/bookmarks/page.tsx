'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function BookmarksPage() {
  const [bookmarks, setBookmarks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchBookmarks();
  }, []);

  const fetchBookmarks = async () => {
    try {
      const res = await fetch('/api/academic/bookmarks');
      const data = await res.json();
      if (data.success) {
        setBookmarks(data.data);
      } else {
        setError(data.error || 'فشل جلب المفضلة');
      }
    } catch (err: any) {
      setError(err.message || 'خطأ في الاتصال');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-8">
      <div className="max-w-5xl mx-auto space-y-8">
        
        {/* الترويسة */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-6">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-white">الأبحاث المحفوظة (المفضلة)</h1>
            <p className="text-slate-400 mt-1">مكتبتك الشخصية الموثقة في قاعدة بيانات الواحة.</p>
          </div>
          <Link href="/academic" className="px-4 py-2 bg-slate-900 border border-slate-800 hover:border-blue-500/50 rounded-xl text-sm font-medium transition-colors">
            العودة للبحث
          </Link>
        </div>

        {error && (
          <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl">
            {error} (تأكد من تسجيل الدخول لحفظ وعرض المفضلة).
          </div>
        )}

        {loading ? (
          <div className="text-center py-12 text-slate-500">جارٍ تحميل المفضلة...</div>
        ) : bookmarks.length === 0 && !error ? (
          <div className="bg-slate-900/50 border border-slate-800/80 rounded-2xl p-12 text-center text-slate-500">
            لا توجد أبحاث محفوظة في المفضلة حالياً. ابدأ بحفظ بعض الأبحاث من صفحة البحث الرئيسية.
          </div>
        ) : (
          <div className="space-y-4">
            {bookmarks.map((paper, idx) => (
              <div key={idx} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-3 shadow-xl">
                <div className="flex items-start justify-between gap-4">
                  <h3 className="text-lg font-bold text-blue-400 leading-snug">{paper.title}</h3>
                  <span className="px-3 py-1 bg-slate-800 text-slate-300 text-xs font-semibold rounded-full shrink-0">
                    {paper.year || 'د.ت'}
                  </span>
                </div>
                <p className="text-sm text-slate-400 line-clamp-2">{paper.abstract}</p>
                <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-xs text-slate-400">
                  <span>المصدر: {paper.source || 'الواحة'}</span>
                  {paper.pdf_url && (
                    <a href={paper.pdf_url} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">
                      تحميل الـ PDF 📄
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}
