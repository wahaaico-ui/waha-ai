'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

const LANG_KEY = 'waha_lang';

const COPY = {
  ar: { login: 'تسجيل الدخول', signup: 'إنشاء حساب', switchTo: 'English', dashboard: 'لوحتي', logout: 'خروج' },
  en: { login: 'Log in', signup: 'Sign up', switchTo: 'العربية', dashboard: 'Dashboard', logout: 'Log out' },
};

interface UserInfo {
  email: string;
  name?: string;
}

export default function SiteHeader() {
  const [lang, setLang] = useState<'ar' | 'en'>('ar');
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem(LANG_KEY) : null;
    if (stored === 'ar' || stored === 'en') setLang(stored);
  }, []);

  useEffect(() => {
    // Get initial user
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setUser({
          email: data.user.email || '',
          name: data.user.user_metadata?.full_name || data.user.user_metadata?.name,
        });
      }
      setLoading(false);
    });

    // Listen for auth changes
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser({
          email: session.user.email || '',
          name: session.user.user_metadata?.full_name || session.user.user_metadata?.name,
        });
      } else {
        setUser(null);
      }
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  const toggleLang = () => {
    const next = lang === 'ar' ? 'en' : 'ar';
    setLang(next);
    if (typeof window !== 'undefined') localStorage.setItem(LANG_KEY, next);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setMenuOpen(false);
    router.push('/');
    router.refresh();
  };

  const t = COPY[lang];
  const displayName = user?.name || user?.email?.split('@')[0] || '';
  const initial = (user?.name || user?.email || '?')[0].toUpperCase();

  return (
    <header dir={lang === 'ar' ? 'rtl' : 'ltr'} className="sticky top-0 z-40 bg-[#090D16]/80 backdrop-blur border-b border-white/5">
      <div className="max-w-7xl mx-auto flex items-center justify-between px-6 py-3">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center text-white text-sm font-bold">W</div>
          <span className="text-white font-bold">WAHA AI</span>
        </Link>

        <div className="flex items-center gap-2">
          <button onClick={toggleLang} className="text-xs text-gray-400 hover:text-white px-3 py-1 rounded-lg border border-white/10 hover:border-white/20 transition">
            {t.switchTo}
          </button>

          {loading ? (
            <div className="w-8 h-8 rounded-full bg-gray-800 animate-pulse"></div>
          ) : user ? (
            <div className="relative">
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="flex items-center gap-2 pl-3 pr-1 py-1 rounded-full border border-white/10 hover:border-emerald-500/40 transition"
              >
                <span className="text-sm text-gray-300 max-w-[120px] truncate">{displayName}</span>
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center text-white text-xs font-bold">
                  {initial}
                </div>
              </button>

              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)}></div>
                  <div className={`absolute mt-2 w-48 bg-[#111827] border border-gray-800 rounded-xl shadow-2xl z-20 py-1 ${lang === 'ar' ? 'left-0' : 'right-0'}`}>
                    <div className="px-4 py-3 border-b border-gray-800">
                      <div className="text-sm text-white font-medium truncate">{displayName}</div>
                      <div className="text-xs text-gray-500 truncate">{user.email}</div>
                    </div>
                    <Link href="/verify-idea" onClick={() => setMenuOpen(false)} className="block px-4 py-2 text-sm text-gray-300 hover:bg-gray-800 hover:text-white transition">
                      {t.dashboard}
                    </Link>
                    <button onClick={handleLogout} className="w-full text-right px-4 py-2 text-sm text-red-400 hover:bg-gray-800 transition">
                      {t.logout}
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <>
              <Link href="/login" className="text-sm text-gray-300 hover:text-white transition-colors px-3 py-1">
                {t.login}
              </Link>
              <Link href="/signup" className="text-sm bg-gradient-to-r from-emerald-500 to-teal-500 hover:opacity-90 text-white font-medium px-4 py-1.5 rounded-lg transition">
                {t.signup}
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
