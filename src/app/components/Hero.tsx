import React from 'react';

export default function Hero() {
  return (
    <section className="relative flex flex-col items-center justify-center text-center px-6 pt-40 pb-24 max-w-5xl mx-auto">
      {/* إشعار علوي صغير متميز */}
      <div className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs px-4 py-1.5 rounded-full mb-6 font-medium">
        <span>✨ منصة المستقبل بدعم الذكاء الاصطناعي</span>
      </div>

      {/* العنوان الرئيسي الكبير للموقع */}
      <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-6 leading-tight max-w-4xl">
        ابنِ مشاريعك الذكية مع{' '}
        <span className="bg-gradient-to-r from-blue-400 via-indigo-400 to-emerald-400 bg-clip-text text-transparent">
          WAHA AI
        </span>
      </h1>

      {/* الوصف التعريفي المساعد */}
      <p className="text-slate-400 text-lg md:text-xl max-w-2xl mb-10 leading-relaxed">
        المنصة المتكاملة لإدارة مساحات العمل والمشاريع المتقدمة المدعومة بالذكاء الاصطناعي. ابدأ الآن ونظم أعمالك بذكاء وسرعة فائقة.
      </p>

      {/* أزرار اتخاذ الإجراء الرئيسية */}
      <div className="flex flex-col sm:flex-row items-center gap-4">
        <button className="w-full sm:w-auto bg-gradient-to-r from-blue-500 to-emerald-500 hover:from-blue-600 hover:to-emerald-600 text-white font-medium px-8 py-3.5 rounded-xl transition-all shadow-lg shadow-blue-500/20 transform hover:-translate-y-0.5">
          ابدأ مشروعك الأول مجاناً
        </button>
        <button className="w-full sm:w-auto bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-8 py-3.5 rounded-xl transition-all transform hover:-translate-y-0.5">
          شاهد الدليل التعريفي
        </button>
      </div>
    </section>
  );
}
