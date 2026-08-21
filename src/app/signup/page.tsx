'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function SignupPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const router = useRouter();

  const handleGoogleSignup = async () => {
    setGoogleLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/verify-idea`,
      },
    });
    if (error) {
      setError(error.message);
      setGoogleLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (password.length < 6) {
      setError('كلمة المرور يجب أن تكون 6 أحرف على الأقل');
      setLoading(false);
      return;
    }

    const { data, error: signupError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: name },
        emailRedirectTo: `${window.location.origin}/verify-idea`,
      },
    });

    if (signupError) {
      setError(signupError.message);
      setLoading(false);
      return;
    }

    if (data.user && !data.session) {
      setSuccessMsg('تم إنشاء الحساب! تفقّد بريدك الإلكتروني لتفعيل الحساب قبل الدخول.');
      setLoading(false);
    } else {
      router.push('/verify-idea');
      router.refresh();
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#090D16] to-[#0D1220] text-white flex items-center justify-center p-6" dir="rtl">
      <div className="max-w-md w-full">
        {/* Logo/Brand */}
        <Link href="/" className="block text-center mb-6">
          <div className="inline-block w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 mb-3"></div>
          <div className="text-emerald-400 text-sm font-semibold">WAHA AI</div>
        </Link>

        <div className="bg-[#111827]/80 backdrop-blur border border-gray-800 rounded-2xl p-8 shadow-2xl">
          <div className="mb-6 text-center">
            <h1 className="text-2xl font-bold text-white mb-2">إنشاء حساب جديد</h1>
            <p className="text-gray-400 text-sm">ابدأ رحلتك البحثية مع الواحة</p>
          </div>

          {successMsg && (
            <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 p-4 rounded-xl mb-4 text-sm text-center">
              ✓ {successMsg}
            </div>
          )}

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-xl mb-4 text-sm">
              {error}
            </div>
          )}

          {!successMsg && (
            <>
              {/* Google Sign-in */}
              <button
                onClick={handleGoogleSignup}
                disabled={googleLoading || loading}
                className="w-full flex items-center justify-center gap-3 bg-white hover:bg-gray-100 text-gray-800 font-medium py-3 rounded-xl transition-all text-sm mb-4 disabled:opacity-50"
              >
                <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
                  <path d="M17.64 9.2a10.34 10.34 0 0 0-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92a8.78 8.78 0 0 0 2.68-6.62z" fill="#4285F4"/>
                  <path d="M9 18a8.6 8.6 0 0 0 5.96-2.18l-2.92-2.26a5.4 5.4 0 0 1-8.06-2.84H.92v2.34A9 9 0 0 0 9 18z" fill="#34A853"/>
                  <path d="M3.98 10.72a5.4 5.4 0 0 1 0-3.44V4.94H.92a9 9 0 0 0 0 8.12l3.06-2.34z" fill="#FBBC05"/>
                  <path d="M9 3.58c1.32 0 2.5.46 3.44 1.34l2.58-2.58A9 9 0 0 0 .92 4.94l3.06 2.34A5.4 5.4 0 0 1 9 3.58z" fill="#EA4335"/>
                </svg>
                {googleLoading ? 'جارٍ فتح Google...' : 'التسجيل بحساب Google'}
              </button>

              <div className="flex items-center gap-3 my-5">
                <div className="flex-1 h-px bg-gray-800"></div>
                <span className="text-xs text-gray-500">أو</span>
                <div className="flex-1 h-px bg-gray-800"></div>
              </div>

              <form onSubmit={handleSignup} className="space-y-4">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">الاسم الكامل</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="محمد أحمد"
                    className="w-full bg-[#090D16] border border-gray-800 focus:border-emerald-500 rounded-xl px-4 py-3 text-white text-sm outline-none transition-colors"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-400 mb-1">البريد الإلكتروني</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full bg-[#090D16] border border-gray-800 focus:border-emerald-500 rounded-xl px-4 py-3 text-white text-sm outline-none transition-colors"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-400 mb-1">كلمة المرور (6 أحرف على الأقل)</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    minLength={6}
                    className="w-full bg-[#090D16] border border-gray-800 focus:border-emerald-500 rounded-xl px-4 py-3 text-white text-sm outline-none transition-colors"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading || googleLoading}
                  className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:opacity-90 text-white font-semibold py-3 rounded-xl transition-all text-sm mt-2 disabled:opacity-50"
                >
                  {loading ? 'جارٍ إنشاء الحساب...' : 'إنشاء الحساب'}
                </button>
              </form>
            </>
          )}

          <p className="text-center text-xs text-gray-400 mt-6">
            لديك حساب بالفعل؟{' '}
            <Link href="/login" className="text-emerald-400 hover:text-emerald-300 hover:underline">
              تسجيل الدخول
            </Link>
          </p>
        </div>

        <p className="text-center text-xs text-gray-600 mt-4">
          بإنشاء حساب أنت توافق على شروط الاستخدام وسياسة الخصوصية
        </p>
      </div>
    </main>
  );
}
