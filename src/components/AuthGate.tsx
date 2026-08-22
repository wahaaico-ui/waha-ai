"use client";

import Link from "next/link";

interface AuthGateProps {
  variant: "blur" | "block";
  reason?: string;
}

export default function AuthGate({ variant, reason }: AuthGateProps) {
  const title =
    variant === "block"
      ? "سجّل مجاناً للاستمرار"
      : "سجّل لعرض النتيجة الكاملة";

  const defaultReason =
    variant === "block"
      ? "لقد استفدت من الفحوصات المجانية. أنشئ حساباً مجانياً للاستمرار في التحقق من أفكارك، حفظ نتائجك، وتصدير التقارير."
      : "النتيجة أمامك، لكن التفاصيل الكاملة، حفظ التاريخ، وتصدير PDF متاحة للأعضاء فقط. سجّل مجاناً الآن.";

  const icon = variant === "block" ? "🔒" : "✨";

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-b from-white/40 via-white/85 to-white p-6 z-10">
      <div className="bg-white border-2 border-teal-500 rounded-2xl p-8 max-w-md text-center shadow-2xl">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-teal-500 to-emerald-500 flex items-center justify-center text-white text-3xl">
          {icon}
        </div>
        <h3 className="text-xl font-bold text-slate-800 mb-2">
          {title}
        </h3>
        <p className="text-sm text-slate-600 mb-5 leading-relaxed">
          {reason || defaultReason}
        </p>
        <Link
          href="/signup"
          className="inline-block w-full px-6 py-3 bg-gradient-to-r from-teal-500 to-emerald-500 hover:opacity-90 text-white font-bold rounded-xl transition text-sm shadow-lg mb-3 animate-pulse"
        >
          إنشاء حساب مجاني
        </Link>
        <div className="text-xs text-slate-500">
          لديك حساب؟{" "}
          <Link href="/login" className="text-teal-600 hover:underline font-bold">
            سجّل الدخول
          </Link>
        </div>
      </div>
    </div>
  );
}
