'using client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Check, ShieldCheck, Zap } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function PricingPage() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubscribe = async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      router.push('/login');
      return;
    }

    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          userId: session.user.id, 
          email: session.user.email 
        }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error || 'حدث خطأ أثناء الاتصال ببوابة الدفع');
      }
    } catch (err) {
      alert('فشل الاتصال بالخادم');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#09090b] text-white p-6 md:p-12 flex flex-col items-center justify-center">
      <div className="max-w-4xl w-full text-center mb-12">
        <h1 className="text-4xl font-black mb-4">خطط الأسعار وسياسة الاستخدام العادل</h1>
        <p className="text-gray-400">استثمر في مستقبلك الأكاديمي مع نظام WAHA الموثق بدقة وخالٍ من الهلوسة.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl w-full">
        {/* الباقة المجانية */}
        <div className="bg-[#18181b] border border-[#27272a] rounded-3xl p-8 flex flex-col justify-between">
          <div>
            <h3 className="text-xl font-bold mb-2">الباحث المبتدئ</h3>
            <p className="text-gray-400 text-sm mb-6">مناسب للاستكشاف والتجارب البسيطة.</p>
            <div className="text-3xl font-black mb-6">مجاناً</div>
            <ul className="space-y-3 text-sm text-gray-300 mb-8">
              <li className="flex items-center gap-2"><Check className="w-4 h-4 text-cyan-500" /> بحث أساسي عبر OpenAlex</li>
              <li className="flex items-center gap-2"><Check className="w-4 h-4 text-cyan-500" /> حفظ حتى 3 مشاريع</li>
              <li className="flex items-center gap-2"><Check className="w-4 h-4 text-cyan-500" /> تقارير مبسطة</li>
            </ul>
          </div>
          <button onClick={() => router.push('/dashboard')} className="w-full py-3 bg-[#27272a] hover:bg-[#3f3f46] font-bold rounded-xl transition">
            الانتقال للمساحة المجانية
          </button>
        </div>

        {/* الباقة الاحترافية (مدعومة بـ Stripe) */}
        <div className="bg-[#18181b] border-2 border-cyan-500 rounded-3xl p-8 flex flex-col justify-between relative shadow-2xl shadow-cyan-500/10">
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-cyan-500 text-black text-xs font-black px-4 py-1 rounded-full uppercase tracking-wider">
            الأكثر طلباً للعالمية
          </div>
          <div>
            <h3 className="text-xl font-bold mb-2 text-cyan-400">الباحث العالمي (Pro)</h3>
            <p className="text-gray-400 text-sm mb-6">للباحثين الجادين في الماجستير والدكتوراه.</p>
            <div className="text-4xl font-black mb-6">$29 <span className="text-sm font-normal text-gray-400">/ شهرياً</span></div>
            <ul className="space-y-3 text-sm text-gray-300 mb-8">
              <li className="flex items-center gap-2"><Zap className="w-4 h-4 text-cyan-500" /> عدد غير محدود من المشاريع والمراجع</li>
              <li className="flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-cyan-500" /> محرك التحقق الصارم ضد الهلوسة</li>
              <li className="flex items-center gap-2"><Check className="w-4 h-4 text-cyan-500" /> تصدير فوري بصيغ متعددة (Word & LaTeX)</li>
              <li className="flex items-center gap-2"><Check className="w-4 h-4 text-cyan-500" /> أولوية الاستجابة القصوى (Turbo Speed)</li>
            </ul>
          </div>
          <button onClick={handleSubscribe} disabled={loading} className="w-full py-4 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-xl transition shadow-lg shadow-cyan-600/30">
            {loading ? 'جاري التحويل لـ Stripe...' : 'ترقية الحساب الآن'}
          </button>
        </div>
      </div>
    </div>
  );
}
