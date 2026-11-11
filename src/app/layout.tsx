import './globals.css';
import type { Metadata } from 'next';
import { Inter, IBM_Plex_Sans_Arabic } from 'next/font/google';
import AuthSessionProvider from '@/components/AuthSessionProvider';
import { toAuthUser } from '@/lib/auth/auth-user';
import LanguageDocument from '@/components/LanguageDocument';
import { createClient } from '@/lib/supabase/server';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const plexArabic = IBM_Plex_Sans_Arabic({
  subsets: ['arabic'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-plex-arabic',
});

export const metadata: Metadata = {
  title: 'WAHA AI',
  description: 'الواحة للبحث والكتابة الأكاديمية: مراجع الدراسات، مقارنة المستخلصات، ترجمة وتدقيق النصوص ومتابعة ملاحظات المشرف في مشروع محفوظ.',
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const initialUser = toAuthUser(user);

  return (
    <html lang="ar" dir="rtl" data-scroll-behavior="smooth" className={`${inter.variable} ${plexArabic.variable}`}>
      <head>
        {/* Intentionally unprocessed: compatibility fallback for legacy Android browsers. */}
        {/* eslint-disable-next-line @next/next/no-css-tags */}
        <link rel="stylesheet" href="/legacy-mobile.css" />
      </head>
      <body className="bg-bg text-ink antialiased min-h-screen font-arabic">
        <AuthSessionProvider initialUser={initialUser}><LanguageDocument />{children}</AuthSessionProvider>
      </body>
    </html>
  );
}
