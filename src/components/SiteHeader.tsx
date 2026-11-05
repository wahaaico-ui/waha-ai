'use client';

import { useUiTranslation } from '@/lib/use-ui-translation';
import Link from 'next/link';
import { useState } from 'react';
import { Menu, X } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import Logo from './Logo';
import { useAuthSession } from './AuthSessionProvider';
import styles from './SiteHeader.module.css';
import { useWahaLanguage } from '@/lib/use-language';

const labels = { home: 'الرئيسية', features: 'إمكانيات الواحة', pricing: 'الأسعار', journey: 'مشاريعي', resources: 'كيف تعمل', about: 'من نحن', contact: 'تواصل معنا', login: 'دخول', start: 'ابدأ الآن', dashboard: 'مشاريعي', logout: 'خروج' };

export default function SiteHeader() {
  const { text: ui, direction: uiDirection } = useUiTranslation();

  const [open, setOpen] = useState(false);
  const { user, signOut } = useAuthSession();
  const email = user?.email ?? null;
  const router = useRouter();
  const pathname = usePathname();
  const t = Object.fromEntries(Object.entries(labels).map(([key, value]) => [key, ui(value)])) as typeof labels;
  const { language, toggleLanguage } = useWahaLanguage();
  const logout = async () => {
    if (!(await signOut())) return;
    setOpen(false);
    router.replace('/');
  };
  const links = [{ href: '/', label: t.home }, { href: '/#features', label: t.features }, { href: '/guide', label: t.resources }, { href: '/pricing', label: t.pricing }, { href: '/about', label: t.about }, { href: '/contact', label: t.contact }];
  return (
    <header id="waha-site-header" dir={uiDirection} className={`${styles.header} sticky top-0 z-50 border-b border-line bg-white/95 backdrop-blur-xl`}>
      <div id="waha-header-bar" className={`${styles.bar} mx-auto h-[72px] max-w-7xl gap-4 px-4 sm:px-6`}>
        <Link className={styles.brand} href="/" onClick={() => setOpen(false)} aria-label="WAHA AI"><Logo variant="full" className="h-7 w-auto sm:h-8" /></Link>
        <nav id="waha-desktop-nav" aria-label={ui("التنقل الرئيسي")} className={`${styles.primaryNav} hidden items-center xl:flex`}>
          {links.map((link) => <Link key={link.href} href={link.href} aria-current={pathname === link.href ? 'page' : undefined} className="rounded-lg px-2.5 py-2 text-sm font-semibold text-slate-600 transition hover:bg-primary-tint hover:text-primary-dark aria-[current=page]:bg-primary-tint aria-[current=page]:text-primary-dark">{link.label}</Link>)}
        </nav>
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <div id="waha-desktop-actions" className={`${styles.desktopActions} hidden items-center gap-3 xl:flex`}>
            {email ? <><Link href="/dashboard" className="text-sm font-bold text-slate-700 hover:text-primary-dark">{t.dashboard}</Link><button onClick={logout} className="text-sm text-slate-500 hover:text-red-600">{t.logout}</button></> : <Link href="/login" className="text-sm font-bold text-slate-700 hover:text-primary-dark">{t.login}</Link>}
            <Link href="/#start" onClick={() => setOpen(false)} className="rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white shadow-[0_6px_20px_rgba(30,94,255,.16)] transition hover:bg-primary-dark">{t.start}</Link>
          </div>
          <button type="button" onClick={toggleLanguage} aria-label={language === 'ar' ? 'Switch interface to English' : 'تغيير الواجهة إلى العربية'} className="min-h-10 rounded-lg border border-line px-3 py-2 text-sm font-bold text-primary-dark transition hover:bg-primary-tint">{language === 'ar' ? 'English' : 'العربية'}</button>
          <button type="button" id="waha-menu-button" onClick={() => setOpen(!open)} className={`${styles.menuButton} rounded-lg p-2 text-slate-700 xl:hidden`} aria-label={open ? ui("إغلاق القائمة") : ui("فتح القائمة")} aria-expanded={open} aria-controls="waha-mobile-menu">{open ? <X /> : <Menu />}</button>
        </div>
      </div>
      {open && <div id="waha-mobile-menu" className={`${styles.mobileMenu} border-t border-line bg-white px-4 py-4 shadow-xl xl:hidden`}>
        <nav aria-label={ui("التنقل الرئيسي")} className="grid gap-1">
          {links.map((link) => <Link key={link.href} href={link.href} aria-current={pathname === link.href ? 'page' : undefined} onClick={() => setOpen(false)} className="rounded-lg px-3 py-2.5 text-sm font-semibold text-slate-600 hover:bg-primary-tint aria-[current=page]:bg-primary-tint aria-[current=page]:text-primary-dark">{link.label}</Link>)}
          <div className="mt-2 grid gap-2 border-t border-line pt-3">
            <Link onClick={() => setOpen(false)} href={email ? '/dashboard' : '/login'} className="rounded-lg border border-line px-3 py-2 text-center text-sm font-bold text-slate-700">{email ? t.dashboard : t.login}</Link>
            <Link onClick={() => setOpen(false)} href="/#start" className="rounded-lg bg-primary px-3 py-2.5 text-center text-sm font-bold text-white">{t.start}</Link>
            {email && <button onClick={logout} className="rounded-lg px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50">{t.logout}</button>}
          </div>
        </nav>
      </div>}
    </header>
  );
}
