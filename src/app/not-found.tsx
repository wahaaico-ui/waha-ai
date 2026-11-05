'use client';

import { useUiTranslation } from '@/lib/use-ui-translation';
import Link from 'next/link';

export default function NotFound() {
  const { text: ui } = useUiTranslation();

  return (
    <div className="bg-bg text-ink min-h-screen flex items-center justify-center antialiased">
      <div className="max-w-md w-full bg-white border border-line rounded-2xl p-8 text-center backdrop-blur-md shadow-xl shadow-slate-900/5">
        <div className="w-16 h-16 bg-blue-500/15 text-primary rounded-2xl flex items-center justify-center mx-auto mb-6 text-2xl font-bold border border-blue-500/30">
          404
        </div>
        <h2 className="text-2xl font-bold mb-3 tracking-tight text-ink">{ui("الصفحة غير موجودة")}</h2>
        <p className="text-slate-600 text-sm mb-8 leading-relaxed">
          {ui("عذراً، لم نتمكن من العثور على الرابط المطلوب أو ربما تم نقل الصفحة إلى مسار آخر.")}</p>
        <Link
          href="/"
          className="inline-flex items-center justify-center w-full py-3 px-6 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-xl transition-all shadow-lg shadow-blue-600/20 text-sm"
        >
          {ui("العودة للرئيسية")}</Link>
      </div>
    </div>
  );
}
