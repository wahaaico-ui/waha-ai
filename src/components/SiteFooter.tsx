import Link from 'next/link';

export default function SiteFooter({ lang }: { lang: 'ar' | 'en' }) {
  const ar = lang === 'ar';
  const columns = [
    { title: ar ? 'المنتج' : 'Product', links: [
      { href: '/?task=writing#start', label: ar ? 'الكتابة بالدليل' : 'Writing with evidence' },
      { href: '/dashboard', label: ar ? 'مشاريعي البحثية' : 'My research projects' },
      { href: '/tools/sample-size', label: ar ? 'حاسبة حجم العينة المجانية' : 'Free sample size calculator' },
      { href: '/pricing', label: ar ? 'الأسعار' : 'Pricing' },
    ] },
    { title: ar ? 'تعرّف على الواحة' : 'Explore WAHA', links: [
      { href: '/', label: ar ? 'الرئيسية' : 'Home' },
      { href: '/#features', label: ar ? 'إمكانيات الواحة' : 'WAHA capabilities' },
      { href: '/guide', label: ar ? 'كيف تعمل' : 'How it works' },
      { href: '/about', label: ar ? 'من نحن' : 'About WAHA' },
    ] },
    { title: ar ? 'الدعم والبيانات' : 'Support and data', links: [
      { href: '/login', label: ar ? 'تسجيل الدخول' : 'Log in' },
      { href: '/contact', label: ar ? 'تواصل معنا' : 'Contact us' },
      { href: '/privacy', label: ar ? 'بياناتك وخصوصيتك' : 'Your data and privacy' },
      { href: '/terms', label: ar ? 'إرشادات الاستخدام' : 'Use guidelines' },
    ] },
  ];
  return (
    <footer dir={ar ? 'rtl' : 'ltr'} className="border-t border-slate-200 bg-white">
      <div className="mx-auto grid max-w-7xl gap-8 px-6 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <Link href="/" className="inline-flex min-h-11 items-center rounded-lg text-xl font-extrabold tracking-tight text-[#10213c]">WAHA</Link>
          <p className="mt-3 max-w-xs text-sm leading-7 text-slate-500">{ar ? 'مصادرك وكتابتك ومراجعاتك في مشروع بحثي مترابط.' : 'Your sources, writing and reviews in one connected research project.'}</p>
        </div>
        {columns.map(column => (
          <nav key={column.title} aria-label={column.title}>
            <h2 className="font-bold text-[#10213c]">{column.title}</h2>
            <ul className="mt-3 grid text-sm leading-7 text-slate-600">
              {column.links.map(link => <li key={link.href}><Link href={link.href} className="inline-flex min-h-11 items-center rounded-lg py-2 hover:text-primary-dark hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary">{link.label}</Link></li>)}
            </ul>
          </nav>
        ))}
      </div>
      <div className="border-t border-slate-100 px-5 py-6 text-center text-xs leading-6 text-slate-500">© {new Date().getFullYear()} {ar ? 'الواحة للبحث العلمي' : 'WAHA Research Intelligence'}</div>
    </footer>
  );
}
