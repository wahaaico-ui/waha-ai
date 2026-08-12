'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function DashboardPage() {
  const router = useRouter();
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [results, setResults] = useState<any[]>([]);

  useEffect(() => {
    async function checkUser() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
      } else {
        setUserEmail(session.user.email ?? 'Researcher');
        setLoading(false);
      }
    }
    checkUser();
  }, [router]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setIsAnalyzing(true);
    
    // محاكاة محرك البحث والتحليل الذكي للفجوات البحثية بناءً على فكرة المنصة
    setTimeout(() => {
      setResults([
        {
          id: 1,
          title: `تحليل الفجوات البحثية في موضوع: ${searchQuery}`,
          confidence: '98.4%',
          category: 'Knowledge Graph & Literature',
          summary: 'تم رصد فجوة هيكلية في الربط بين النماذج التطبيقية والبيانات المرجعية. يوصى بدمج أطر عمل استراتيجية حديثة.',
          status: 'جاهز للاستخراج'
        },
        {
          id: 2,
          title: `التقييم الأكاديمي المتقدم ومطابقة النطاق الجغرافي`,
          confidence: '94.1%',
          category: 'Supervisor Mode Validation',
          summary: 'تم رصد توافق عالي مع الأبحاث في جامعات الشرق الأوسط مع فرصة لتطوير مخرجات استراتيجية جديدة.',
          status: 'موثق'
        }
      ]);
      setIsAnalyzing(false);
    }, 1200);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-600">
        جاري تحميل مساحة العمل الأكاديمية...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900" dir="rtl">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 h-20 flex items-center justify-between px-8 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-lg shadow-md shadow-blue-600/20">W</div>
          <div>
            <span className="font-bold text-lg block text-gray-900">WAHA AI Pro</span>
            <span className="text-xs text-gray-500">النظام الأكاديمي المتقدم لتحليل الفجوات البحثية</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium text-gray-600">{userEmail}</span>
          <button 
            onClick={handleLogout}
            className="px-4 py-2 text-sm bg-red-50 hover:bg-red-100 text-red-600 font-medium rounded-xl transition-colors"
          >
            تسجيل الخروج
          </button>
        </div>
      </header>

      {/* Main Search & Analysis Section */}
      <main className="max-w-5xl mx-auto px-6 py-12">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-50 border border-blue-100 text-blue-600 text-xs font-semibold mb-6 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
            محرك البحث الذكي مفعل
          </div>
          <h1 className="text-3xl md:text-5xl font-extrabold text-gray-900 mb-4 leading-tight">
            اكتشف الفجوات البحثية بدقة <br />
            <span className="text-blue-600">وتحليل ذكي متكامل</span>
          </h1>
          <p className="text-gray-600 text-lg max-w-2xl mx-auto">
            منصة هندسية متطورة لإدارة أبحاثك، استخراج النتائج الاستراتيجية، وربط البيانات بكفاءة عالية.
          </p>
        </div>

        {/* Search Box Card */}
        <div className="bg-white p-6 md:p-8 rounded-3xl shadow-xl border border-gray-100 mb-12">
          <form onSubmit={handleSearch} className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <span className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-gray-400">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="اكتب عنوان البحث أو الفكرة الأكاديمية هنا..."
                className="w-full pr-12 pl-4 py-4 rounded-2xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-600 text-gray-900 text-base"
              />
            </div>
            <button
              type="submit"
              disabled={isAnalyzing}
              className="px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl transition-all shadow-lg shadow-blue-600/25 flex items-center justify-center gap-2 disabled:opacity-50 text-base"
            >
              {isAnalyzing ? (
                <>
                  <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>جاري التحليل واستخراج الفجوات...</span>
                </>
              ) : (
                <>
                  <span>بدء التحليل الفوري</span>
                  <span>&larr;</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Results Area */}
        {results.length > 0 && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-gray-900 border-r-4 border-blue-600 pr-3">
              نتائج تحليل الفجوات والنتائج الاستراتيجية
            </h2>
            <div className="grid grid-cols-1 gap-6">
              {results.map((item) => (
                <div key={item.id} className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-all">
                  <div className="flex items-center justify-between mb-3">
                    <span className="px-3 py-1 bg-blue-50 text-blue-600 text-xs font-semibold rounded-full">
                      {item.category}
                    </span>
                    <span className="text-sm font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full">
                      نسبة المطابقة: {item.confidence}
                    </span>
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">{item.title}</h3>
                  <p className="text-gray-600 text-sm leading-relaxed mb-4">{item.summary}</p>
                  <div className="flex items-center justify-between pt-4 border-t border-gray-100 text-xs text-gray-500">
                    <span>الحالة: <strong className="text-gray-900">{item.status}</strong></span>
                    <button className="text-blue-600 font-bold hover:underline">عرض التقرير الأكاديمي التفصيلي &larr;</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
