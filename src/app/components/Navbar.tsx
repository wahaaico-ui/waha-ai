import React from 'react';

export default function Navbar() {
  return (
    <nav className="fixed top-0 left-0 w-full z-50 bg-slate-900/80 backdrop-blur-md border-b border-slate-800 px-6 py-4">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* شعار الموقع */}
        <div className="text-xl font-bold bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">
          WAHA AI
        </div>
        
        {/* روابط التنقل */}
        <div className="hidden md:flex items-center space-x-8 space-x-reverse text-sm text-slate-300">
          <a href="#" className="hover:text-white transition-colors">الرئيسية</a>
          <a href="#" className="hover:text-white transition-colors">المشاريع</a>
          <a href="#" className="hover:text-white transition-colors">لوحة التحكم</a>
        </div>

        {/* أزرار الدخول */}
        <div className="flex items-center space-x-4 space-x-reverse">
          <button className="text-sm text-slate-300 hover:text-white transition-colors px-4 py-2">
            تسجيل الدخول
          </button>
          <button className="text-sm bg-gradient-to-r from-blue-500 to-emerald-500 hover:from-blue-600 hover:to-emerald-600 text-white font-medium px-4 py-2 rounded-lg transition-all shadow-lg shadow-blue-500/20">
            ابدأ مجاناً
          </button>
        </div>
      </div>
    </nav>
  );
}
