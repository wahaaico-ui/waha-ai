'use client';

import { MailCheck } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import PasswordField from '@/components/PasswordField';
import Logo from '@/components/Logo';
import { passwordStrength } from '@/lib/password-policy';
import { COUNTRY_OPTIONS } from '@/lib/researcher-profile';

const SPECIALTIES = ['العلوم الشرعية والإسلامية', 'اللغة العربية وآدابها', 'التربية وعلم النفس', 'الإدارة والأعمال', 'الاقتصاد والمالية', 'العلوم السياسية والقانون', 'التاريخ والحضارة', 'الاجتماع والأنثروبولوجيا', 'الإعلام والاتصال', 'الطب والعلوم الصحية', 'الهندسة والتقنية', 'علوم الحاسوب والذكاء الاصطناعي', 'العلوم الطبيعية', 'الرياضيات والإحصاء', 'الفنون والتصميم', 'تخصص آخر'];
const LEVELS = [{ value: 'masters', label: 'طالب ماجستير' }, { value: 'phd', label: 'طالب دكتوراه' }, { value: 'postdoc', label: 'باحث ما بعد الدكتوراه' }, { value: 'professor', label: 'أستاذ جامعي' }, { value: 'researcher', label: 'باحث في مركز بحثي' }, { value: 'independent', label: 'باحث مستقل' }];
const inputClass = 'w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100';

export default function SignupPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [university, setUniversity] = useState('');
  const [level, setLevel] = useState('');
  const [country, setCountry] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState(false);

  const continueToProfile = (event: React.FormEvent) => {
    event.preventDefault();
    if (!passwordStrength(password).isStrong) return setError('أكمل جميع متطلبات كلمة المرور القوية قبل المتابعة.');
    setError(null); setStep(2);
  };

  const createAccount = async (event: React.FormEvent) => {
    event.preventDefault(); setLoading(true); setError(null);
    try {
      const response = await fetch('/api/auth/signup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password, fullName: name, specialty, university, level, country }) });
      const result = await response.json() as { error?: string; needsEmailConfirmation?: boolean };
      if (!response.ok) throw new Error(result.error || 'تعذر إنشاء الحساب.');
      if (result.needsEmailConfirmation) setCreated(true);
      else { router.push('/verify-idea'); router.refresh(); }
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'تعذر إنشاء الحساب.'); }
    finally { setLoading(false); }
  };

  const googleSignup = async () => {
    setGoogleLoading(true); setError(null);
    const { error: oauthError } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${window.location.origin}/auth/callback?next=/email-confirmed` } });
    if (oauthError) { setError('تعذر فتح تسجيل Google. حاول لاحقاً.'); setGoogleLoading(false); }
  };

  return <main dir="rtl" className="min-h-screen bg-[#f8fafc] px-4 py-10 text-slate-900 sm:px-6"><div className="mx-auto w-full max-w-md"><Link href="/" className="mb-8 flex items-center justify-center" aria-label="WAHA AI"><Logo variant="full" className="h-9 w-auto" /></Link><section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-900/5 sm:p-8"><div className="mb-7 flex gap-2" aria-label={`الخطوة ${step} من 2`}><span className="h-1.5 flex-1 rounded-full bg-blue-600" /><span className={`h-1.5 flex-1 rounded-full ${step === 2 ? 'bg-blue-600' : 'bg-slate-200'}`} /></div>
    {created ? <div className="py-4 text-center"><MailCheck className="mx-auto mb-4 h-16 w-16 text-blue-600" /><h1 className="text-2xl font-black">تحقق من بريدك</h1><p className="mt-3 leading-7 text-slate-600">إذا كان <bdi className="font-bold text-slate-800">{email}</bdi> بريداً جديداً، ستصلك رسالة لتأكيد الحساب. افتحها واضغط <strong>تأكيد حسابي</strong>.</p><p className="mt-4 rounded-xl bg-blue-50 p-3 text-sm leading-6 text-blue-800">إذا كان لديك حساب بهذا البريد مسبقاً، سجّل الدخول أو اطلب إعادة تعيين كلمة المرور. نحافظ على هذه الرسالة عامة لحماية خصوصية الحسابات.</p><div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row"><Link href="/login" className="inline-flex justify-center rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-blue-600/20">تسجيل الدخول</Link><Link href="/forgot-password" className="inline-flex justify-center rounded-xl border border-slate-300 px-5 py-3 text-sm font-bold text-slate-700">نسيت كلمة المرور</Link></div></div> : <>
      <header className="mb-6 text-center"><h1 className="text-2xl font-black">{step === 1 ? 'أنشئ حسابك البحثي' : 'ملفك الأكاديمي'}</h1><p className="mt-2 text-sm text-slate-500">{step === 1 ? 'خطوة أولى آمنة قبل بدء رحلة البحث.' : 'بيانات تساعد WAHA على تخصيص مرافقتك البحثية.'}</p></header>
      {error && <p role="alert" className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
      {step === 1 ? <><button type="button" disabled={googleLoading} onClick={googleSignup} className="w-full rounded-xl border border-slate-300 bg-white py-3 text-sm font-bold text-slate-700 transition hover:border-blue-400 disabled:opacity-50">{googleLoading ? 'جارٍ فتح Google…' : 'المتابعة باستخدام Google'}</button><div className="my-5 flex items-center gap-3 text-xs text-slate-400"><span className="h-px flex-1 bg-slate-200" />أو بالبريد الإلكتروني<span className="h-px flex-1 bg-slate-200" /></div><form onSubmit={continueToProfile} className="space-y-4"><div><label htmlFor="name" className="mb-1.5 block text-sm font-bold text-slate-700">الاسم الكامل</label><input id="name" value={name} onChange={(event) => setName(event.target.value)} className={inputClass} placeholder="محمد أحمد" required /></div><div><label htmlFor="email" className="mb-1.5 block text-sm font-bold text-slate-700">البريد الإلكتروني</label><input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} className={inputClass} placeholder="you@example.com" autoComplete="email" required /></div><PasswordField value={password} onChange={setPassword} /><button type="submit" className="w-full rounded-xl bg-blue-600 py-3 font-bold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700">متابعة ←</button></form></> : <form onSubmit={createAccount} className="space-y-4"><div><label htmlFor="specialty" className="mb-1.5 block text-sm font-bold text-slate-700">التخصص الأكاديمي</label><select id="specialty" value={specialty} onChange={(event) => setSpecialty(event.target.value)} className={inputClass} required><option value="">اختر التخصص</option>{SPECIALTIES.map((item) => <option key={item}>{item}</option>)}</select></div><div><label htmlFor="country" className="mb-1.5 block text-sm font-bold text-slate-700">الدولة أو البيئة البحثية الأساسية</label><select id="country" value={country} onChange={(event) => setCountry(event.target.value)} className={inputClass} required><option value="">اختر الدولة</option>{COUNTRY_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select><p className="mt-1.5 text-xs leading-5 text-slate-500">نستخدمها لإبراز الدراسات الأقرب إلى بيئتك، مع إبقاء البحث العالمي متاحاً.</p></div><div><label htmlFor="university" className="mb-1.5 block text-sm font-bold text-slate-700">الجامعة أو المؤسسة</label><input id="university" value={university} onChange={(event) => setUniversity(event.target.value)} className={inputClass} placeholder="مثال: جامعة الملك سعود" required /></div><div><label htmlFor="level" className="mb-1.5 block text-sm font-bold text-slate-700">المستوى الأكاديمي</label><select id="level" value={level} onChange={(event) => setLevel(event.target.value)} className={inputClass} required><option value="">اختر المستوى</option>{LEVELS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></div><div className="rounded-xl bg-blue-50 p-3 text-xs leading-6 text-blue-800">ستُستخدم هذه المعلومات فقط لتخصيص تجربة WAHA البحثية، ولا تغيّر ملكيتك أو خصوصية مشروعك.</div><div className="flex gap-3"><button type="button" onClick={() => setStep(1)} className="flex-1 rounded-xl border border-slate-300 py-3 text-sm font-bold text-slate-700">رجوع</button><button type="submit" disabled={loading} className="flex-[2] rounded-xl bg-blue-600 py-3 text-sm font-bold text-white shadow-lg shadow-blue-600/20 disabled:opacity-50">{loading ? 'جارٍ إنشاء الحساب…' : 'إنشاء الحساب'}</button></div></form>}
    </>}
    <p className="mt-7 text-center text-sm text-slate-500">لديك حساب؟ <Link href="/login" className="font-bold text-blue-600 hover:underline">سجّل الدخول</Link></p></section><p className="mt-5 text-center text-xs text-slate-400">بإنشاء حساب، أنت توافق على شروط الاستخدام وسياسة الخصوصية.</p></div></main>;
}
