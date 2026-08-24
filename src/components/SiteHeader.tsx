'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Menu, X } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

const LANG_KEY = 'waha_lang';
const labels = {
  ar: { features: 'الميزات', pricing: 'الأسعار', journey: 'رحلتي البحثية', resources: 'الموارد', login: 'دخول', start: 'ابدأ الآن', dashboard: 'لوحتي', logout: 'خروج', switch: 'EN' },
  en: { features: 'Features', pricing: 'Pricing', journey: 'My Journey', resources: 'Resources', login: 'Sign in', start: 'Get started', dashboard: 'My dashboard', logout: 'Log out', switch: 'العربية' },
};

export default function SiteHeader() {
  const [lang, setLang] = useState<'ar' | 'en'>(() => typeof window !== 'undefined' && localStorage.getItem(LANG_KEY) === 'en' ? 'en' : 'ar');
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const router = useRouter();
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => setEmail(session?.user.email ?? null));
    return () => data.subscription.unsubscribe();
  }, []);
  const t = labels[lang];
  const changeLanguage = () => { const next = lang === 'ar' ? 'en' : 'ar'; setLang(next); localStorage.setItem(LANG_KEY, next); window.dispatchEvent(new CustomEvent('waha-language-change', { detail: next })); };
  const logout = async () => { await supabase.auth.signOut(); setOpen(false); router.push('/'); router.refresh(); };
  const links = [{ href: '/#features', label: t.features }, { href: '/pricing', label: t.pricing }, { href: '/#how-it-works', label: t.resources }, { href: email ? '/dashboard' : '/login?redirect=/dashboard', label: t.journey }];
  return <header dir={lang === 'ar' ? 'rtl' : 'ltr'} className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/90 backdrop-blur"><div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6"><Link href="/" onClick={() => setOpen(false)} className="flex items-center gap-2 text-xl font-extrabold tracking-tight text-[#10213c]"><span className="grid h-9 w-9 place-items-center rounded-xl bg-[#2563eb] text-sm text-white">✦</span>WAHA</Link><nav className="hidden items-center gap-1 lg:flex">{links.map((link) => <Link key={link.href} href={link.href} className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-blue-50 hover:text-blue-700">{link.label}</Link>)}</nav><div className="hidden items-center gap-3 sm:flex"><button onClick={changeLanguage} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 transition hover:border-blue-300 hover:text-blue-700">{t.switch}</button>{email ? <><Link href="/dashboard" className="text-sm font-bold text-slate-700 hover:text-blue-700">{t.dashboard}</Link><button onClick={logout} className="text-sm text-slate-500 hover:text-red-600">{t.logout}</button></> : <Link href="/login" className="text-sm font-bold text-slate-700 hover:text-blue-700">{t.login}</Link>}<Link href="/verify-idea" className="rounded-xl bg-[#2563eb] px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700">{t.start}</Link></div><button onClick={() => setOpen(!open)} className="rounded-lg p-2 text-slate-700 sm:hidden" aria-label="Toggle menu">{open ? <X /> : <Menu />}</button></div>{open && <div className="border-t border-slate-100 bg-white px-4 py-4 sm:hidden"><nav className="grid gap-1">{links.map((link) => <Link key={link.href} href={link.href} onClick={() => setOpen(false)} className="rounded-lg px-3 py-2.5 text-sm font-semibold text-slate-600 hover:bg-blue-50">{link.label}</Link>)}<div className="mt-2 flex items-center gap-2 border-t border-slate-100 pt-3"><button onClick={changeLanguage} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600">{t.switch}</button><Link onClick={() => setOpen(false)} href={email ? '/dashboard' : '/login'} className="rounded-lg px-3 py-2 text-sm font-bold text-slate-700">{email ? t.dashboard : t.login}</Link><Link onClick={() => setOpen(false)} href="/verify-idea" className="flex-1 rounded-lg bg-[#2563eb] px-3 py-2 text-center text-sm font-bold text-white">{t.start}</Link></div></nav></div>}</header>;
}
