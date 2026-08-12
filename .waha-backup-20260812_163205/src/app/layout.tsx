import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'منصة الأبحاث الذكية',
  description: 'منصة أكاديمية لتحليل الفجوات وإدارة الأبحاث بالذكاء الاصطناعي',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ar" dir="rtl">
      <body className="bg-[#090D16] text-white antialiased min-h-screen">
        {children}
      </body>
    </html>
  );
}
