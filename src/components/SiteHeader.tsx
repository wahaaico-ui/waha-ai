"use client";
import Link from 'next/link';

const NAV = {
  ar: [
    { label: 'المميزات', href: '/#features' },
    { label: 'الأسعار', href: '/pricing' },
    { label: 'الجامعات', href: '/#universities' },
    { label: 'الموارد', href: '/#resources' },
  ],
  en: [
    { label: 'Features', href: '/#features' },
    { label: 'Pricing', href: '/pricing' },
    { label: 'Universities', href: '/#universities' },
    { label: 'Resources', href: '/#resources' },
  ],
};

const COPY = {
  ar: { login: 'تسجيل الدخول', signup: 'إنشاء حساب', switchTo: 'English' },
  en: { login: 'Log in', signup: 'Sign up', switchTo: 'العربية' },
};

export default function SiteHeader({ lang, onToggleLang }: { lang: 'ar' | 'en'; onToggleLang: () => void }) {
  const t = COPY[lang];
  return (
    <header className="border-b border-white/10 bg-[#0A0F1C]/90 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between gap-6">
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center font-black text-gray-950 text-sm">
            W
          </div>
          <span className="text-lg tracking-tight" dir="ltr">
            <span className="font-black text-white">WAHA</span>
            <span className="font-black text-teal-400"> AI</span>
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-8">
          {NAV[lang].map((l) => (
            <a key={l.href} href={l.href} className="text-sm text-gray-300 hover:text-white transition-colors">
              {l.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={onToggleLang}
            className="text-xs text-gray-400 hover:text-white border border-white/10 hover:border-white/30 rounded-full px-3 py-1.5 transition-colors"
          >
            {t.switchTo}
          </button>
          <Link href="/login" className="text-sm text-gray-300 hover:text-white transition-colors px-2">
            {t.login}
          </Link>
          <Link
            href="/signup"
            className="text-sm bg-gradient-to-l from-blue-500 to-teal-400 hover:from-blue-400 hover:to-teal-300 text-gray-950 font-bold px-5 py-2.5 rounded-xl transition-all shadow-lg shadow-teal-500/10"
          >
            {t.signup}
          </Link>
        </div>
      </div>
    </header>
  );
}
