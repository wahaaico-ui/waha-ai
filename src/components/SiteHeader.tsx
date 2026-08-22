'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

const LANG_KEY = 'waha_lang';

const COPY = {
  ar: {
    login: 'دخول',
    signup: 'حساب جديد',
    switchTo: 'EN',
    dashboard: 'لوحتي',
    logout: 'خروج',
    verify: 'التحقق',
    research: 'البحث',
    pricing: 'الأسعار',
  },
  en: {
    login: 'Log in',
    signup: 'Sign up',
    switchTo: 'AR',
    dashboard: 'Dashboard',
    logout: 'Log out',
    verify: 'Verify',
    research: 'Research',
    pricing: 'Pricing',
  },
};

interface UserInfo {
  email: string;
  name?: string;
}

export default function SiteHeader() {
  const [lang, setLang] = useState<'ar' | 'en'>('ar');
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem(LANG_KEY) : null;
    if (stored === 'ar' || stored === 'en') setLang(stored);
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setUser({
          email: data.user.email || '',
          name: data.user.user_metadata?.full_name || data.user.user_metadata?.name,
        });
      }
      setLoading(false);
    });

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
    setUserMenuOpen(false);
    setMobileMenuOpen(false);
    router.push('/');
    router.refresh();
  };

  const t = COPY[lang];
  const displayName = user?.name || user?.email?.split('@')[0] || '';
  const initial = (user?.name || user?.email || '?')[0].toUpperCase();
  const isRTL = lang === 'ar';

  return (
    <header
      dir={isRTL ? 'rtl' : 'ltr'}
      className="sticky top-0 z-40 bg-[#090D16]/85 backdrop-blur border-b border-white/5"
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between px-4 sm:px-6 py-3">
        {/* LOGO */}
        <Link href="/" className="flex items-center gap-2 shrink-0" onClick={() => setMobileMenuOpen(false)}>
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center text-white text-sm font-bold shadow-md shadow-emerald-500/30">
            W
          </div>
          <span className="text-white font-bold text-base sm:text-lg">WAHA AI</span>
        </Link>

        {/* DESKTOP NAV LINKS — hidden on mobile */}
        <nav className="hidden md:flex items-center gap-1">
          <Link href="/verify-idea" className="text-sm text-gray-300 hover:text-white px-3 py-1.5 rounded-lg hover:bg-white/5 transition">
            {t.verify}
          </Link>
          <Link href="/research" className="text-sm text-gray-300 hover:text-white px-3 py-1.5 rounded-lg hover:bg-white/5 transition">
            {t.research}
          </Link>
          <Link href="/pricing" className="text-sm text-gray-300 hover:text-white px-3 py-1.5 rounded-lg hover:bg-white/5 transition">
            {t.pricing}
          </Link>
        </nav>

        {/* RIGHT SIDE — auth + lang + mobile toggle */}
        <div className="flex items-center gap-2">
          {/* LANG SWITCH */}
          <button
            onClick={toggleLang}
            className="text-xs text-gray-400 hover:text-white px-2.5 py-1 rounded-lg border border-white/10 hover:border-white/25 transition"
            aria-label="Switch language"
          >
            {t.switchTo}
          </button>

          {/* AUTH — desktop */}
          {!loading && (
            <>
              {user ? (
                <div className="relative">
                  <button
                    onClick={() => setUserMenuOpen(!userMenuOpen)}
                    className="flex items-center gap-2 pl-3 pr-1 py-1 rounded-full border border-white/10 hover:border-emerald-500/40 transition"
                    aria-label="User menu"
                  >
                    <span className="hidden sm:inline text-sm text-gray-300 max-w-[100px] truncate">{displayName}</span>
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center text-white text-xs font-bold">
                      {initial}
                    </div>
                  </button>

                  {userMenuOpen && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setUserMenuOpen(false)}></div>
                      <div className={`absolute mt-2 w-48 bg-[#111827] border border-gray-800 rounded-xl shadow-2xl z-20 py-1 ${isRTL ? 'left-0' : 'right-0'}`}>
                        <div className="px-4 py-3 border-b border-gray-800">
                          <div className="text-sm text-white font-medium truncate">{displayName}</div>
                          <div className="text-xs text-gray-500 truncate">{user.email}</div>
                        </div>
                        <Link
                          href="/verify-idea"
                          onClick={() => setUserMenuOpen(false)}
                          className="block px-4 py-2 text-sm text-gray-300 hover:bg-gray-800 hover:text-white transition"
                        >
                          {t.dashboard}
                        </Link>
                        <button
                          onClick={handleLogout}
                          className={`w-full ${isRTL ? 'text-right' : 'text-left'} px-4 py-2 text-sm text-red-400 hover:bg-gray-800 transition`}
                        >
                          {t.logout}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <div className="hidden sm:flex items-center gap-2">
                  <Link href="/login" className="text-sm text-gray-300 hover:text-white transition px-3 py-1">
                    {t.login}
                  </Link>
                  <Link
                    href="/signup"
                    className="text-sm bg-gradient-to-r from-emerald-500 to-teal-500 hover:opacity-90 text-white font-medium px-4 py-1.5 rounded-lg transition shadow-md shadow-emerald-500/25"
                  >
                    {t.signup}
                  </Link>
                </div>
              )}
            </>
          )}

          {/* MOBILE MENU TOGGLE */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-lg text-gray-300 hover:text-white hover:bg-white/5 transition"
            aria-label="Toggle menu"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              {mobileMenuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* MOBILE MENU — dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-white/5 bg-[#090D16]/95 backdrop-blur">
          <nav className="max-w-7xl mx-auto px-4 py-3 flex flex-col gap-1">
            <Link
              href="/verify-idea"
              onClick={() => setMobileMenuOpen(false)}
              className="text-sm text-gray-300 hover:text-white px-3 py-2.5 rounded-lg hover:bg-white/5 transition"
            >
              {t.verify}
            </Link>
            <Link
              href="/research"
              onClick={() => setMobileMenuOpen(false)}
              className="text-sm text-gray-300 hover:text-white px-3 py-2.5 rounded-lg hover:bg-white/5 transition"
            >
              {t.research}
            </Link>
            <Link
              href="/pricing"
              onClick={() => setMobileMenuOpen(false)}
              className="text-sm text-gray-300 hover:text-white px-3 py-2.5 rounded-lg hover:bg-white/5 transition"
            >
              {t.pricing}
            </Link>

            {!user && !loading && (
              <div className="flex gap-2 pt-2 mt-2 border-t border-white/5">
                <Link
                  href="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex-1 text-center text-sm text-gray-300 hover:text-white px-3 py-2 rounded-lg border border-white/10 hover:border-white/25 transition"
                >
                  {t.login}
                </Link>
                <Link
                  href="/signup"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex-1 text-center text-sm bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-medium px-3 py-2 rounded-lg transition"
                >
                  {t.signup}
                </Link>
              </div>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
