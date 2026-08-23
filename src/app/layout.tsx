import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'WAHA AI',
  description: 'WAHA AI — المشرف الأكاديمي الرقمي: منصة أكاديمية لتحليل الفجوات وإدارة الأبحاث بالذكاء الاصطناعي',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ar" dir="rtl">
      <body className="bg-[#f8fafc] text-slate-900 antialiased min-h-screen">
        {children}
      </body>
    </html>
  );
}
