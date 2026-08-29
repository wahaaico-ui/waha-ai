import './globals.css';
import type { Metadata } from 'next';
import { Inter, IBM_Plex_Sans_Arabic } from 'next/font/google';
import AuthSessionProvider, { type AuthUser } from '@/components/AuthSessionProvider';
import { createClient } from '@/lib/supabase/server';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const plexArabic = IBM_Plex_Sans_Arabic({
  subsets: ['arabic'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-plex-arabic',
});

export const metadata: Metadata = {
  title: 'WAHA AI',
  description: 'WAHA AI — المشرف الأكاديمي الرقمي: منصة أكاديمية لتحليل الفجوات وإدارة الأبحاث بالذكاء الاصطناعي',
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const metadata = user?.user_metadata ?? {};
  const initialUser: AuthUser | null = user ? {
    id: user.id,
    email: user.email ?? null,
    fullName: typeof metadata.full_name === 'string'
      ? metadata.full_name
      : typeof metadata.name === 'string'
        ? metadata.name
        : null,
    specialty: typeof metadata.specialty === 'string' ? metadata.specialty : null,
  } : null;

  return (
    <html lang="ar" dir="rtl" data-scroll-behavior="smooth" className={`${inter.variable} ${plexArabic.variable}`}>
      <body className="bg-bg text-ink antialiased min-h-screen font-arabic">
        <AuthSessionProvider initialUser={initialUser}>{children}</AuthSessionProvider>
      </body>
    </html>
  );
}
