'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function SignupPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error: signupError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (signupError) {
      setError(signupError.message);
      setLoading(false);
    } else {
      router.push('/projects/create');
      router.refresh();
    }
  };

  return (
    <main className="min-h-screen bg-[#090D16] text-white flex items-center justify-center p-6" dir="rtl">
      <div className="max-w-md w-full bg-[#111827] border border-gray-800 rounded-2xl p-8 shadow-2xl">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-white mb-2">إنشاء حساب جديد</h1>
          <p className="text-gray-400 text-sm">انضم إلى منصة الأبحاث الذكية وابدأ مشاريعك</p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-xl mb-4 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSignup} className="space-y-4">
          <div>
            <label className="block text-xs text-gray-400 mb-1">البريد الإلكتروني</label>
            <input
              type="email5"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-[#090D16] border border-gray-800 focus:border-emerald-500 rounded-xl px-4 py-3 text-white text-sm outline-none"
              required
            />
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1">كلمة المرور</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-[#090D16] border border-gray-800 focus:border-emerald-500 rounded-xl px-4 py-3 text-white text-sm outline-none"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-emerald-500 hover:bg-emerald-600 text-gray-950 font-semibold py-3 rounded-xl transition-all text-sm mt-2"
          >
            {loading ? 'جاري إنشاء الحساب...' : 'تسجيل وحفظ'}
          </button>
        </form>

        <p className="text-center text-xs text-gray-400 mt-6">
          لديك حساب بالفعل؟{' '}
          <Link href="/login" className="text-emerald-400 hover:underline">
            تسجيل الدخول
          </Link>
        </p>
      </div>
    </main>
  );
}