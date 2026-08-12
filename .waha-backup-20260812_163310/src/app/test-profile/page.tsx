'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

export default function ProfessionalDashboard() {
  const [credits, setCredits] = useState<number | null>(null);
  const [userName, setUserName] = useState<string>('Researcher');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    async function loadUserData() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          router.push('/login');
          return;
        }

        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name, free_credits')
          .eq('id', user.id)
          .single();

        if (profile) {
          setUserName(profile.full_name || 'باحث أكاديمي');
          setCredits(profile.free_credits ?? 0);
        }
      } catch (err) {
        console.error('Error loading profile:', err);
      } finally {
        setLoading(false);
      }
    }

    loadUserData();
  }, [router, supabase]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">
        <div className="animate-pulse text-lg font-medium">جاري تحميل البيانات الاحترافية...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-8 font-sans" dir="rtl">
      {/* الهيدر العلوي */}
      <header className="max-w-6xl mx-auto flex justify-between items-center pb-8 border-b border-slate-800 mb-10">
        <div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-indigo-500 bg-clip-text text-transparent">
            منصة التدقيق والتقييم الأكاديمي
          </h1>
          <p className="text-sm text-slate-400 mt-1">لوحة التحكم الرئيسية والتحكم الذكي بالتقارير</p>
        </div>
        <div className="flex items-center gap-4">
          <span className="bg-slate-900 border border-slate-800 px-4 py-2 rounded-xl text-sm font-medium text-slate-300">
            مرحباً، <strong className="text-white">{userName}</strong>
          </span>
          <button 
            onClick={async () => { await supabase.auth.signOut(); router.push('/login'); }}
            className="bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 px-4 py-2 rounded-xl text-sm font-medium transition-all"
          >
            تسجيل الخروج
          </button>
        </div>
      </header>

      {/* المحتوى الرئيسي */}
      <main className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* كرت الرصيد */}
        <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 p-6 rounded-2xl shadow-xl flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-medium text-slate-400">رصيد النقاط المجانية</h3>
            <div className="text-5xl font-extrabold text-blue-400 mt-4 tracking-tight">
              {credits ?? 0}
            </div>
          </div>
          <div className="mt-6 pt-4 border-t border-slate-800/60 text-xs text-slate-400">
            {credits && credits > 0 ? 'الرصيد متاح وجاهز للاستخدام' : 'الرصيد نفد، يرجى الشحن للمتابعة'}
          </div>
        </div>

        {/* كرت توليد التقارير الذكية */}
        <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 p-6 rounded-2xl shadow-xl md:col-span-2 flex flex-col justify-between">
          <div>
            <h3 className="text-lg font-semibold text-white mb-2">التقييم الأكاديمي عبر الذكاء الاصطناعي (Groq Llama 3.3)</h3>
            <p className="text-sm text-slate-400">
              قم بإرسال الأوراق البحثية أو التقارير للحصول على تدقيق لغوي وصياغة أكاديمية بمستوى احترافي عالي الفخامة.
            </p>
          </div>
          <div className="mt-6 flex items-center justify-between pt-4 border-t border-slate-800/60">
            <span className="text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-lg">
              النظام متصل وجاهز للعمل
            </span>
            <button 
              onClick={() => setMessage('جاري تهيئة محرك الذكاء الاصطناعي...')}
              className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2.5 rounded-xl text-sm font-medium shadow-lg shadow-blue-600/20 transition-all"
            >
              بدء تقييم جديد
            </button>
          </div>
        </div>

      </main>

      {message && (
        <div className="max-w-6xl mx-auto mt-6 bg-blue-500/10 border border-blue-500/20 text-blue-400 p-4 rounded-xl text-sm text-center">
          {message}
        </div>
      )}
    </div>
  );
}