'use client';

import Link from 'next/link';

export default function AcademicHubPage() {
  const modules = [
    {
      title: 'مساحة العمل المركزية',
      desc: 'تشغيل السلسلة الكاملة دفعة واحدة (التحليل، الجاهزية، الأدبيات، الذكاء، القرار، الأفكار، العناوين، والسيمينار).',
      href: '/academic/workspace',
      badge: 'Sprint 2 ⚡',
      color: 'border-blue-500/30 bg-blue-950/20 text-blue-400 hover:border-blue-500'
    },
    {
      title: 'لوحة تحكم الباحث',
      desc: 'إدارة واستعراض ومتابعة كافة المشاريع والأبحاث المحفوظة في قاعدة بيانات Supabase.',
      href: '/academic/dashboard',
      badge: 'Sprint 3 💾',
      color: 'border-emerald-500/30 bg-emerald-950/20 text-emerald-400 hover:border-emerald-500'
    },
    {
      title: 'محلياً: قارئ وتحليل ملفات الـ PDF',
      desc: 'إرفاق واستجواب الملفات المحلية على جهازك عبر تقنيات Gemini بأمان تام.',
      href: '/academic', // رابط داخلي أو ميزة موجودة
      badge: 'Core Tool',
      color: 'border-indigo-500/30 bg-indigo-950/20 text-indigo-400 hover:border-indigo-500'
    },
    {
      title: 'مصفوفة التخليق الأكاديمية',
      desc: 'مقارنة الأهداف، المنهجيات، النتائج والفجوات للأبحاث في جدول واحد.',
      href: '/academic',
      badge: 'Core Tool',
      color: 'border-cyan-500/30 bg-cyan-950/20 text-cyan-400 hover:border-cyan-500'
    },
    {
      title: 'محلل الفجوات البحثية',
      desc: 'كشف الثغرات المعرفية والفرص الكبرى في أي مجال أكاديمي.',
      href: '/academic',
      badge: 'Core Tool',
      color: 'border-purple-500/30 bg-purple-950/20 text-purple-400 hover:border-purple-500'
    },
    {
      title: 'مُولد مراجعة الأدبيات (Literature Review)',
      desc: 'دمج الأبحاث وتوليد فصل أكاديمي مترابط جاهز للتحميل والتصدير.',
      href: '/academic',
      badge: 'Core Tool',
      color: 'border-pink-500/30 bg-pink-950/20 text-pink-400 hover:border-pink-500'
    }
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-12">
      <div className="max-w-6xl mx-auto space-y-12">

        {/* الترويسة الكبرى */}
        <div className="text-center space-y-4 border-b border-slate-800 pb-10">
          <span className="px-4 py-1.5 bg-blue-500/10 text-blue-400 border border-blue-500/20 text-xs font-bold rounded-full">
            WAHA Academic Platform 🟢 مكتمل محلياً
          </span>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-white">
            الواحة للأبحاث الذكية (WAHA)
          </h1>
          <p className="text-slate-400 max-w-2xl mx-auto text-sm md:text-base leading-relaxed">
            المنصة الأكاديمية المتكاملة المدعومة بالذكاء الاصطناعي للتحليل، استكشاف الأدبيات، توليد الأفكار، وصياغة مقترحات السيمينار بأمان تام على جهازك.
          </p>
          <div className="flex items-center justify-center gap-4 pt-4">
            <Link
              href="/academic/workspace"
              className="px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-2xl shadow-xl shadow-blue-600/25 transition-all text-sm"
            >
              افتح مساحة العمل المركزية ⚡
            </Link>
            <Link
              href="/academic/dashboard"
              className="px-8 py-4 bg-slate-900 border border-slate-800 hover:border-emerald-500/50 text-slate-200 font-bold rounded-2xl transition-all text-sm"
            >
              لوحة تحكم المشاريع (Supabase) 💾
            </Link>
          </div>
        </div>

        {/* شبكة الوحدات والأدوات */}
        <div className="space-y-6">
          <h2 className="text-xl font-extrabold text-slate-200 border-r-4 border-blue-500 pr-3">
            أدوات وعمليات المنصة الأكاديمية
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {modules.map((m, idx) => (
              <div key={idx} className={`border p-6 rounded-2xl shadow-xl space-y-4 flex flex-col justify-between transition-all hover:scale-[1.01] ${m.color}`}>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold px-2.5 py-1 bg-slate-900/80 rounded-lg border border-slate-800">
                      {m.badge}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-white">{m.title}</h3>
                  <p className="text-xs text-slate-300 leading-relaxed">{m.desc}</p>
                </div>

                <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between">
                  <span className="text-xs text-slate-500">جاهز للتشغيل</span>
                  <Link href={m.href} className="text-xs font-bold underline hover:text-white transition-colors">
                    الانتقال للأداة ↗
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
