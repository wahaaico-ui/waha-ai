'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import Link from 'next/link';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/login`,
    });

    if (resetError) {
      setError(resetError.message);
      setLoading(false);
    } else {
      setSent(true);
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#090D16] to-[#0D1220] text-white flex items-center justify-center p-6" dir="rtl">
      <div className="max-w-md w-full">
        <Link href="/" className="block text-center mb-6">
          <div className="inline-block w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 mb-3"></div>
          <div className="text-emerald-400 text-sm font-semibold">WAHA AI</div>
        </Link>

        <div className="bg-[#111827]/80 backdrop-blur border border-gray-800 rounded-2xl p-8 shadow-2xl">
          <div className="mb-6 text-center">
            <h1 className="text-2xl font-bold text-white mb-2">استعادة كلمة المرور</h1>
            <p className="text-gray-400 text-sm">أدخل بريدك وسنرسل لك رابط الاستعادة</p>
          </div>

          {sent ? (
            <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 p-4 rounded-xl text-sm text-center">
              ✓ تم إرسال رابط استعادة كلمة المرور إلى بريدك.
              <br />تفقّد صندوق الوارد (وربما spam).
            </div>
          ) : (
            <>
              {error && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-xl mb-4 text-sm">
                  {error}
                </div>
              )}

              <form onSubmit={handleReset} className="space-y-4">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">البريد الإلكتروني</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full bg-[#090D16] border border-gray-800 focus:border-emerald-500 rounded-xl px-4 py-3 text-white text-sm outline-none"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:opacity-90 text-white font-semibold py-3 rounded-xl transition-all text-sm mt-2 disabled:opacity-50"
                >
                  {loading ? 'جارٍ الإرسال...' : 'إرسال الرابط'}
                </button>
              </form>
            </>
          )}

          <p className="text-center text-xs text-gray-400 mt-6">
            <Link href="/login" className="text-emerald-400 hover:text-emerald-300 hover:underline">
              ← العودة إلى تسجيل الدخول
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
