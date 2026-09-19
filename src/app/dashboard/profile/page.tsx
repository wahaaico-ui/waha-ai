'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { User, Mail, Shield, ArrowRight, Save, Plug, KeyRound, Database } from 'lucide-react';
import Link from 'next/link';
import type { User as SupabaseUser } from '@supabase/supabase-js';

export default function ProfilePage() {
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [university, setUniversity] = useState('');
  const [degree, setDegree] = useState('ماجستير');
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const router = useRouter();

  useEffect(() => {
    const fetchUserData = async () => {
      const { data: { user: authenticatedUser } } = await supabase.auth.getUser();
      if (!authenticatedUser) {
        router.push('/login');
        return;
      }
      setUser(authenticatedUser);

      // جلب بيانات الملف الشخصي إن وجدت
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authenticatedUser.id)
        .single();

      if (data) {
        setUniversity(data.university || '');
        setDegree(data.degree || 'ماجستير');
      }
      setLoading(false);
    };
    fetchUserData();
  }, [router]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setBanner(null);
    if (!user) {
      setBanner({ type: 'error', message: 'يجب تسجيل الدخول أولاً' });
      return;
    }
    setSaving(true);

    const { error } = await supabase
      .from('profiles')
      .update({ university, degree })
      .eq('id', user.id);

    setSaving(false);
    if (error) {
      setBanner({ type: 'error', message: 'حدث خطأ أثناء التحديث: ' + error.message });
    } else {
      setBanner({ type: 'success', message: 'تم تحديث الملف الشخصي بنجاح!' });
    }
  };

  if (loading) return <div className="min-h-screen bg-[#09090b] flex items-center justify-center text-cyan-500 font-bold">جاري تحميل الملف الشخصي...</div>;

  return (
    <div className="min-h-screen bg-[#09090b] text-white p-6 md:p-12">
      <div className="max-w-2xl mx-auto">
        <Link href="/dashboard" className="inline-flex items-center gap-2 text-gray-400 hover:text-cyan-400 mb-8 transition">
          <ArrowRight className="w-4 h-4" /> العودة إلى مشاريعي
        </Link>

        <Link href="/settings/security" className="mb-6 flex items-center justify-between rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-5 text-emerald-300 transition hover:bg-emerald-500/10">
          <span className="flex items-center gap-3"><KeyRound className="h-5 w-5" /><span><strong className="block">أمان الحساب والتحقق الثنائي</strong><small className="text-gray-400">إضافة تطبيق مصادقة لحماية تسجيل الدخول</small></span></span>
          <span>←</span>
        </Link>

        <Link href="/settings/privacy" className="mb-6 flex items-center justify-between rounded-2xl border border-violet-500/20 bg-violet-500/5 p-5 text-violet-300 transition hover:bg-violet-500/10">
          <span className="flex items-center gap-3"><Database className="h-5 w-5" /><span><strong className="block">الخصوصية وبيانات الحساب</strong><small className="text-gray-400">تنزيل بياناتك أو حذف الحساب نهائياً</small></span></span>
          <span>←</span>
        </Link>

        <h1 className="text-3xl font-bold mb-2">إدارة الحساب والملف الأكاديمي</h1>
        <p className="text-gray-400 mb-8">تعديل بياناتك الشخصية والمؤسسية لضمان دقة التقارير الصادرة.</p>

        {banner && (
          <div
            className={`mb-6 rounded-2xl border p-4 text-sm ${
              banner.type === 'success'
                ? 'border-emerald-500/20 bg-emerald-500/5 text-emerald-300'
                : 'border-red-500/20 bg-red-500/5 text-red-300'
            }`}
          >
            {banner.message}
          </div>
        )}

        <Link href="/settings/integrations" className="mb-6 flex items-center justify-between rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-5 text-cyan-300 transition hover:bg-cyan-500/10">
          <span className="flex items-center gap-3"><Plug className="h-5 w-5" /><span><strong className="block">التكاملات البحثية</strong><small className="text-gray-400">ربط Zotero وإدارة مصادر البحث الخارجية</small></span></span>
          <span>←</span>
        </Link>

        <form onSubmit={handleUpdateProfile} className="bg-[#18181b] border border-[#27272a] rounded-3xl p-8 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">البريد الإلكتروني (حساب موثق)</label>
            <div className="relative">
              <Mail className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
              <input
                type="email"
                value={user?.email || ''}
                disabled
                className="w-full bg-[#27272a]/50 text-gray-400 border border-[#3f3f46] rounded-xl py-3 pr-12 pl-4 cursor-not-allowed text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">الجامعة / المؤسسة الأكاديمية</label>
            <div className="relative">
              <User className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
              <input
                type="text"
                value={university}
                onChange={(e) => setUniversity(e.target.value)}
                placeholder="مثال: جامعة بيرزيت / الجامعة الأردنية..."
                className="w-full bg-[#27272a] text-white border border-[#3f3f46] rounded-xl py-3 pr-12 pl-4 focus:outline-none focus:border-cyan-500 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">الدرجة الأكاديمية المستهدفة</label>
            <select
              value={degree}
              onChange={(e) => setDegree(e.target.value)}
              className="w-full bg-[#27272a] text-white border border-[#3f3f46] rounded-xl py-3 px-4 focus:outline-none focus:border-cyan-500 text-sm"
            >
              <option value="ماجستير">ماجستير</option>
              <option value="دكتوراه">دكتوراه</option>
              <option value="بحث منشور">بحث منشور / ورقة علمية</option>
            </select>
          </div>

          <div className="pt-4 border-t border-[#27272a] flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-emerald-400">
              <Shield className="w-4 h-4" /> الحساب محمي وفق نظام RLS الآمن
            </div>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 bg-cyan-600 hover:bg-cyan-500 text-white px-6 py-3 rounded-xl font-bold transition disabled:opacity-50"
            >
              <Save className="w-5 h-5" /> {saving ? 'جاري الحفظ...' : 'حفظ التعديلات'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
