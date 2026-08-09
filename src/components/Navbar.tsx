'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Navbar() {
  const pathname = usePathname();

  const isActive = (path: string) => pathname === path;

  return (
    <header className="sticky top-0 z-50 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 text-white">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        
        {/* هُوية الواحة */}
        <Link href="/academic" className="flex items-center gap-3 group">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-500/20 group-hover:scale-105 transition-transform">
            <span className="text-xl font-bold text-white">و</span>
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-wide text-slate-100">الواحة</h1>
            <p className="text-xs text-slate-400">منصة الأبحاث الذكية</p>
          </div>
        </Link>

        {/* الروابط الأساسية */}
        <nav className="hidden md:flex items-center gap-2 text-sm font-medium text-slate-300">
          <Link 
            href="/academic" 
            className={`px-3 py-1.5 rounded-lg transition-colors ${isActive('/academic') ? 'bg-blue-600/10 text-blue-400 border border-blue-500/20' : 'hover:text-blue-400'}`}
          >
            البحث الأكاديمي
          </Link>
          <Link 
            href="/academic/matrix" 
            className={`px-3 py-1.5 rounded-lg transition-colors ${isActive('/academic/matrix') ? 'bg-blue-600/10 text-blue-400 border border-blue-500/20' : 'hover:text-blue-400'}`}
          >
            مصفوفة التخليق
          </Link>
          <Link 
            href="/academic/gaps" 
            className={`px-3 py-1.5 rounded-lg transition-colors ${isActive('/academic/gaps') ? 'bg-blue-600/10 text-blue-400 border border-blue-500/20' : 'hover:text-blue-400'}`}
          >
            محلل الفجوات
          </Link>
          <Link 
            href="/academic/literature-review" 
            className={`px-3 py-1.5 rounded-lg transition-colors ${isActive('/academic/literature-review') ? 'bg-blue-600/10 text-blue-400 border border-blue-500/20' : 'hover:text-blue-400'}`}
          >
            مراجعة الأدبيات
          </Link>
          <Link 
            href="/academic/pdf-chat" 
            className={`px-3 py-1.5 rounded-lg transition-colors ${isActive('/academic/pdf-chat') ? 'bg-blue-600/10 text-blue-400 border border-blue-500/20' : 'hover:text-blue-400'}`}
          >
            قراءة ملفات PDF
          </Link>
          <Link 
            href="/academic/bookmarks" 
            className={`px-3 py-1.5 rounded-lg transition-colors ${isActive('/academic/bookmarks') ? 'bg-blue-600/10 text-blue-400 border border-blue-500/20' : 'hover:text-blue-400'}`}
          >
            المفضلة
          </Link>
        </nav>

        {/* مؤشر الحالة */}
        <div className="flex items-center gap-3">
          <span className="px-3 py-1.5 text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            محلي وآمن
          </span>
        </div>

      </div>
    </header>
  );
}
