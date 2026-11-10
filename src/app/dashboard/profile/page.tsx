'use client';

import { useUiTranslation } from '@/lib/use-ui-translation';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { User, Mail, Shield, ArrowRight, Save, Plug, KeyRound, Database } from 'lucide-react';
import Link from 'next/link';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import {
  COUNTRY_OPTIONS,
  LEVEL_OPTIONS,
  PROFILE_LIMITS,
  SPECIALTY_OPTIONS,
  parseProfileUpdate,
  researcherProfileFromMetadata,
} from '@/lib/researcher-profile';

const fieldClass = 'w-full bg-[#27272a] text-white border border-[#3f3f46] rounded-xl py-3 px-4 focus:outline-none focus:border-cyan-500 text-sm';
const labelClass = 'block text-sm font-medium text-gray-300 mb-2';

/**
 * Edits the academic profile kept in the account, the same fields signup
 * collects and every report, suggestion and search reads (DOC-21-01).
 */
export default function ProfilePage() {
  const { text: ui } = useUiTranslation();

  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fullName, setFullName] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [specialtyDetail, setSpecialtyDetail] = useState('');
  const [university, setUniversity] = useState('');
  const [level, setLevel] = useState('');
  const [country, setCountry] = useState('');
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
      const profile = researcherProfileFromMetadata(authenticatedUser.user_metadata);
      let savedUniversity = profile.university;
      if (!savedUniversity) {
        // Older accounts typed their university into this page's former table.
        const { data } = await supabase.from('profiles').select('*').eq('id', authenticatedUser.id).maybeSingle();
        savedUniversity = typeof data?.university === 'string' ? data.university.trim() || null : null;
      }
      setFullName(profile.fullName || '');
      setSpecialty(profile.specialty || '');
      setSpecialtyDetail(profile.specialtyDetail || '');
      setUniversity(savedUniversity || '');
      setLevel(profile.level || '');
      setCountry(profile.country || '');
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
    const update = parseProfileUpdate({ fullName, specialty, specialtyDetail, university, level, country });
    if (!update.ok) {
      setBanner({ type: 'error', message: update.error });
      return;
    }
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ data: update.data });
    setSaving(false);
    if (error) {
      setBanner({ type: 'error', message: 'تعذر حفظ الملف الأكاديمي الآن. حاول مجددًا.' });
      return;
    }
    setBanner({ type: 'success', message: 'حُفظ ملفك الأكاديمي، وسيُستخدم في البحث والمسارات المقترحة من الآن.' });
    router.refresh();
  };

  if (loading) return <div className="min-h-screen bg-[#09090b] flex items-center justify-center text-cyan-500 font-bold">{ui("جاري تحميل الملف الشخصي...")}</div>;

  // A value saved from an older list stays visible instead of silently changing.
  const specialtyChoices: readonly string[] = specialty && !(SPECIALTY_OPTIONS as readonly string[]).includes(specialty)
    ? [specialty, ...SPECIALTY_OPTIONS]
    : SPECIALTY_OPTIONS;

  return (
    <div className="min-h-screen bg-[#09090b] text-white p-6 md:p-12">
      <div className="max-w-2xl mx-auto">
        <Link href="/dashboard" className="inline-flex items-center gap-2 text-gray-400 hover:text-cyan-400 mb-8 transition">
          <ArrowRight className="w-4 h-4" /> {ui("العودة إلى مشاريعي")}</Link>

        <Link href="/settings/security" className="mb-6 flex items-center justify-between rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-5 text-emerald-300 transition hover:bg-emerald-500/10">
          <span className="flex items-center gap-3"><KeyRound className="h-5 w-5" /><span><strong className="block">{ui("أمان الحساب والتحقق الثنائي")}</strong><small className="text-gray-400">{ui("إضافة تطبيق مصادقة لحماية تسجيل الدخول")}</small></span></span>
          <span>←</span>
        </Link>

        <Link href="/settings/privacy" className="mb-6 flex items-center justify-between rounded-2xl border border-violet-500/20 bg-violet-500/5 p-5 text-violet-300 transition hover:bg-violet-500/10">
          <span className="flex items-center gap-3"><Database className="h-5 w-5" /><span><strong className="block">{ui("الخصوصية وبيانات الحساب")}</strong><small className="text-gray-400">{ui("تنزيل بياناتك أو حذف الحساب نهائياً")}</small></span></span>
          <span>←</span>
        </Link>

        <h1 className="text-3xl font-bold mb-2">{ui("إدارة الحساب والملف الأكاديمي")}</h1>
        <p className="text-gray-400 mb-8">{ui("تعديل بياناتك الشخصية والمؤسسية لضمان دقة التقارير الصادرة.")}</p>

        {banner && (
          <div
            role={banner.type === 'error' ? 'alert' : 'status'}
            className={`mb-6 rounded-2xl border p-4 text-sm ${
              banner.type === 'success'
                ? 'border-emerald-500/20 bg-emerald-500/5 text-emerald-300'
                : 'border-red-500/20 bg-red-500/5 text-red-300'
            }`}
          >
            {ui(banner.message)}
          </div>
        )}

        <Link href="/settings/integrations" className="mb-6 flex items-center justify-between rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-5 text-cyan-300 transition hover:bg-cyan-500/10">
          <span className="flex items-center gap-3"><Plug className="h-5 w-5" /><span><strong className="block">{ui("التكاملات البحثية")}</strong><small className="text-gray-400">{ui("ربط Zotero وإدارة مصادر البحث الخارجية")}</small></span></span>
          <span>←</span>
        </Link>

        <form onSubmit={handleUpdateProfile} className="bg-[#18181b] border border-[#27272a] rounded-3xl p-8 space-y-6">
          <div>
            <label htmlFor="profile-email" className={labelClass}>{ui("البريد الإلكتروني (حساب موثق)")}</label>
            <div className="relative">
              <Mail className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
              <input
                id="profile-email"
                type="email"
                value={user?.email || ''}
                disabled
                className="w-full bg-[#27272a]/50 text-gray-400 border border-[#3f3f46] rounded-xl py-3 pr-12 pl-4 cursor-not-allowed text-sm"
              />
            </div>
          </div>

          <div>
            <label htmlFor="profile-name" className={labelClass}>{ui("الاسم الكامل")}</label>
            <input id="profile-name" value={fullName} onChange={(e) => setFullName(e.target.value)} maxLength={PROFILE_LIMITS.fullName} required className={fieldClass} />
          </div>

          <div>
            <label htmlFor="profile-specialty" className={labelClass}>{ui("التخصص العام")}</label>
            <select id="profile-specialty" value={specialty} onChange={(e) => setSpecialty(e.target.value)} required className={fieldClass}>
              <option value="">{ui("اختر التخصص")}</option>
              {specialtyChoices.map((item) => <option key={item} value={item}>{ui(item)}</option>)}
            </select>
          </div>

          <div>
            <label htmlFor="profile-specialty-detail" className={labelClass}>{ui("التخصص الدقيق")}</label>
            <input
              id="profile-specialty-detail"
              value={specialtyDetail}
              onChange={(e) => setSpecialtyDetail(e.target.value)}
              maxLength={PROFILE_LIMITS.specialtyDetail}
              placeholder={ui("مثال: أصول الفقه، أو تعليم العربية للناطقين بغيرها")}
              className={fieldClass}
            />
            <p className="mt-2 text-xs leading-5 text-gray-500">{ui("يوجّه البحث والمسارات المقترحة نحو مجالك. اتركه فارغًا إن لم يكن لك تخصص دقيق.")}</p>
          </div>

          <div>
            <label htmlFor="profile-university" className={labelClass}>{ui("الجامعة / المؤسسة الأكاديمية")}</label>
            <div className="relative">
              <User className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
              <input
                id="profile-university"
                type="text"
                value={university}
                onChange={(e) => setUniversity(e.target.value)}
                maxLength={PROFILE_LIMITS.university}
                required
                placeholder={ui("مثال: جامعة بيرزيت / الجامعة الأردنية...")}
                className="w-full bg-[#27272a] text-white border border-[#3f3f46] rounded-xl py-3 pr-12 pl-4 focus:outline-none focus:border-cyan-500 text-sm"
              />
            </div>
          </div>

          <div>
            <label htmlFor="profile-level" className={labelClass}>{ui("المستوى الأكاديمي")}</label>
            <select id="profile-level" value={level} onChange={(e) => setLevel(e.target.value)} required className={fieldClass}>
              <option value="">{ui("اختر المستوى")}</option>
              {LEVEL_OPTIONS.map((item) => <option key={item.value} value={item.value}>{ui(item.label)}</option>)}
            </select>
          </div>

          <div>
            <label htmlFor="profile-country" className={labelClass}>{ui("الدولة أو البيئة البحثية الأساسية")}</label>
            <select id="profile-country" value={country} onChange={(e) => setCountry(e.target.value)} required className={fieldClass}>
              <option value="">{ui("اختر الدولة")}</option>
              {COUNTRY_OPTIONS.map((item) => <option key={item.value} value={item.value}>{ui(item.label)}</option>)}
            </select>
          </div>

          <div className="pt-4 border-t border-[#27272a] flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-xs text-emerald-400">
              <Shield className="w-4 h-4 shrink-0" /> {ui("تُحفظ هذه البيانات في حسابك، وتُستخدم في توجيه البحث والتقارير.")}</div>
            <button
              type="submit"
              disabled={saving}
              className="flex shrink-0 items-center gap-2 bg-cyan-600 hover:bg-cyan-500 text-white px-6 py-3 rounded-xl font-bold transition disabled:opacity-50"
            >
              <Save className="w-5 h-5" /> {saving ? ui("جاري الحفظ...") : ui("حفظ التعديلات")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
