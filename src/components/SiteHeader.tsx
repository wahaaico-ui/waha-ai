'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Menu, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Logo from './Logo';
import { useAuthSession } from './AuthSessionProvider';
import { useWahaLanguage } from '@/lib/use-language';
import styles from './SiteHeader.module.css';

const labels = {
  ar: { features: 'الميزات', pricing: 'الأسعار', journey: 'رحلتي البحثية', resources: 'الموارد', about: 'من نحن', contact: 'تواصل معنا', login: 'دخول', start: 'ابدأ الآن', dashboard: 'لوحتي', logout: 'خروج', switch: 'EN' },
  en: { features: 'Features', pricing: 'Pricing', journey: 'My Journey', resources: 'Resources', about: 'About', contact: 'Contact', login: 'Sign in', start: 'Get started', dashboard: 'My dashboard', logout: 'Log out', switch: 'العربية' },
};

export default function SiteHeader() {
  const { language: lang, toggleLanguage: changeLanguage } = useWahaLanguage();
  const [open, setOpen] = useState(false);
  const { user, signOut } = useAuthSession();
  const email = user?.email ?? null;
  const router = useRouter();
  const t = labels[lang];
  const logout = async () => {
    if (!(await signOut())) return;
    setOpen(false);
    router.replace('/');
  };
  const links = [{ href: '/#features', label: t.features }, { href: '/pricing', label: t.pricing }, { href: '/#how-it-works', label: t.resources }, { href: '/about', label: t.about }, { href: '/contact', label: t.contact }, { href: email ? '/dashboard' : '/login?redirect=/dashboard', label: t.journey }];
  return <header id="waha-site-header" dir={lang === 'ar' ? 'rtl' : 'ltr'} className={`${styles.header} sticky top-0 z-50 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl`}><div id="waha-header-bar" className={`${styles.bar} mx-auto flex h-[72px] max-w-7xl items-center justify-between px-4 sm:px-6`}><Link className={styles.brand} href="/" onClick={() => setOpen(false)} aria-label="WAHA AI"><Logo variant="full" className="h-7 w-auto sm:h-8" /></Link><nav id="waha-desktop-nav" className={`${styles.primaryNav} hidden items-center xl:flex`}>{links.map((link) => <Link key={link.href} href={link.href} className="rounded-lg px-2.5 py-2 text-sm font-semibold text-slate-600 transition hover:bg-[#eef4ff] hover:text-[#1647c9]">{link.label}</Link>)}</nav><div id="waha-desktop-actions" className={`${styles.desktopActions} hidden items-center gap-3 lg:flex`}><button onClick={changeLanguage} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 transition hover:border-blue-300 hover:text-[#1647c9]">{t.switch}</button>{email ? <><Link href="/dashboard" className="text-sm font-bold text-slate-700 hover:text-[#1647c9]">{t.dashboard}</Link><button onClick={logout} className="text-sm text-slate-500 hover:text-red-600">{t.logout}</button></> : <Link href="/login" className="text-sm font-bold text-slate-700 hover:text-[#1647c9]">{t.login}</Link>}<Link href="/verify-idea" className="rounded-xl bg-[#1e5eff] px-4 py-2.5 text-sm font-bold text-white shadow-[0_8px_24px_rgba(30,94,255,.22)] transition hover:-translate-y-0.5 hover:bg-[#1647c9]">{t.start}</Link></div><button id="waha-menu-button" onClick={() => setOpen(!open)} className={`${styles.menuButton} rounded-lg p-2 text-slate-700 lg:hidden`} aria-label={open ? 'Close menu' : 'Open menu'} aria-expanded={open}>{open ? <X /> : <Menu />}</button></div>{open && <div id="waha-mobile-menu" className={`${styles.mobileMenu} border-t border-slate-100 bg-white px-4 py-4 shadow-xl lg:hidden`}><nav className="grid gap-1">{links.map((link) => <Link key={link.href} href={link.href} onClick={() => setOpen(false)} className="rounded-lg px-3 py-2.5 text-sm font-semibold text-slate-600 hover:bg-[#eef4ff]">{link.label}</Link>)}<div className="mt-2 grid grid-cols-2 gap-2 border-t border-slate-100 pt-3"><button onClick={changeLanguage} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600">{t.switch}</button><Link onClick={() => setOpen(false)} href={email ? '/dashboard' : '/login'} className="rounded-lg border border-slate-200 px-3 py-2 text-center text-sm font-bold text-slate-700">{email ? t.dashboard : t.login}</Link><Link onClick={() => setOpen(false)} href="/verify-idea" className="col-span-2 rounded-lg bg-[#1e5eff] px-3 py-2.5 text-center text-sm font-bold text-white">{t.start}</Link>{email && <button onClick={logout} className="col-span-2 rounded-lg px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50">{t.logout}</button>}</div></nav></div>}</header>;
}
