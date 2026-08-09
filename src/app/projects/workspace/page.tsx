'use client';
import React, { useState } from 'react';
import { Terminal, Layout, FileCode, Search, Activity, Cpu, ChevronRight, Save, Share2 } from 'lucide-react';

export default function WahaResearchOS() {
  const [activeStep] = useState(1);
  const [project] = useState({
    type: 'أطروحة دكتوراه',
    field: 'القانون',
    progress: 15,
    status: 'تحليل الفكرة البحثية...'
  });

  return (
    <div className="flex h-screen bg-[#F8FAFC] text-[#1E293B] font-sans selection:bg-blue-100" dir="rtl">
      
      {/* 1. Sidebar - التنقل بين أدوات النظام */}
      <aside className="w-14 bg-[#0F172A] flex flex-col items-center py-6 border-l border-slate-800 text-slate-400">
        <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center text-white font-bold mb-10 text-xs">W</div>
        <nav className="flex flex-col gap-8">
          <Layout size={18} className="text-blue-400 cursor-pointer" />
          <FileCode size={18} className="hover:text-white cursor-pointer" />
          <Search size={18} className="hover:text-white cursor-pointer" />
          <Activity size={18} className="hover:text-white cursor-pointer" />
        </nav>
      </aside>

      {/* 2. المركز الإجرائي (The Process Center) - بديل الشات بوت */}
      <section className="w-96 bg-white border-l border-slate-200 flex flex-col shadow-sm">
        <header className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Cpu size={14} className="text-blue-600" />
            <span className="text-[10px] font-black tracking-widest text-slate-500 uppercase">Research Engine v1.0</span>
          </div>
          <div className="w-2 h-2 rounded-full bg-green-500"></div>
        </header>

        <div className="flex-1 p-6 space-y-8 overflow-y-auto">
          {/* محاكاة "النظام" وهو يتفاعل مع الباحث - ليس شات ولكن Tasks */}
          <div className="space-y-6">
            <div className="space-y-2">
              <h3 className="text-[10px] font-bold text-blue-600 uppercase">المرحلة الحالية</h3>
              <p className="text-sm font-bold text-slate-800">توصيف السياق البحثي</p>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-100 rounded-lg space-y-4">
              <p className="text-[12px] leading-relaxed text-slate-600 font-medium">
                تم تحديد المسار كـ <span className="text-blue-600 font-bold">[{project.type}]</span> في تخصص <span className="text-blue-600 font-bold">[{project.field}]</span>.
              </p>
              <div className="flex items-center gap-2 text-[10px] text-green-600 font-bold uppercase">
                <Save size={12} /> تم الحفظ في قاعدة البيانات
              </div>
            </div>

            <div className="space-y-4 pt-4">
              <p className="text-[13px] font-bold text-slate-700">مطلوب من الباحث:</p>
              <div className="p-4 border-r-2 border-blue-600 bg-blue-50/30 text-[12px] text-blue-900 leading-relaxed italic">
                &quot;اشرح الظاهرة البحثية التي تلاحظها، مع تحديد المجتمع المتأثر بها.&quot;
              </div>
            </div>
          </div>
        </div>

        {/* كونسول الإدخال (Command Console) */}
        <div className="p-4 border-t border-slate-100">
          <div className="relative group">
            <div className="absolute top-3 right-3 text-slate-400 font-mono text-[10px]">CMD:</div>
            <textarea 
              className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 pt-8 text-[12px] focus:outline-none focus:ring-1 ring-blue-500 transition-all min-h-[120px]"
              placeholder="اكتب مدخلاتك هنا..."
            />
            <button className="w-full mt-2 py-2 bg-slate-900 text-white text-[11px] font-bold rounded hover:bg-blue-600 transition-all flex items-center justify-center gap-2">
               معالجة البيانات <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </section>

      {/* 3. لوحة المشروع (Project Workspace) - الورقة البحثية الذكية */}
      <section className="flex-1 flex flex-col overflow-hidden bg-[#F1F5F9]">
        
        {/* شريط المراحل العلوي - كجزء من نظام التشغيل */}
        <nav className="h-12 bg-white border-b border-slate-200 flex items-center px-6 gap-6 shadow-sm overflow-x-auto no-scrollbar">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(n => (
            <div key={n} className={`flex items-center gap-2 opacity-${n <= activeStep ? '100' : '30'}`}>
              <div className={`w-5 h-5 rounded flex items-center justify-center text-[10px] font-mono ${n === activeStep ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-500'}`}>
                {n.toString().padStart(2, '0')}
              </div>
              {n === activeStep && <span className="text-[10px] font-bold text-slate-700 whitespace-nowrap uppercase tracking-tighter">Current State</span>}
            </div>
          ))}
        </nav>

        <div className="flex-1 overflow-y-auto p-10 flex flex-col items-center">
          <div className="w-full max-w-4xl bg-white shadow-2xl border border-slate-200 min-h-[1000px] rounded-sm p-16 space-y-12">
            
            <header className="border-b-4 border-slate-900 pb-8 flex justify-between items-end">
              <div>
                <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-2">Research Master Plan</p>
                <h1 className="text-3xl font-black text-slate-900 leading-tight">توصيف المقترح البحثي</h1>
              </div>
              <div className="text-left font-mono">
                <p className="text-[10px] text-slate-400">Project ID: WAHA-7742</p>
                <p className="text-[10px] text-slate-400">Status: {project.status}</p>
              </div>
            </header>

            <div className="grid grid-cols-3 gap-8">
              <div className="p-4 bg-slate-50 border border-slate-100 rounded-lg">
                <p className="text-[9px] font-bold text-slate-400 uppercase mb-1">نوع المشروع</p>
                <p className="text-[12px] font-bold text-slate-800">{project.type}</p>
              </div>
              <div className="p-4 bg-slate-50 border border-slate-100 rounded-lg">
                <p className="text-[9px] font-bold text-slate-400 uppercase mb-1">المجال العلمي</p>
                <p className="text-[12px] font-bold text-slate-800">{project.field}</p>
              </div>
              <div className="p-4 bg-slate-50 border border-slate-100 rounded-lg">
                <p className="text-[9px] font-bold text-slate-400 uppercase mb-1">نسبة الإنجاز</p>
                <div className="w-full bg-slate-200 h-1 mt-2 rounded-full overflow-hidden">
                  <div className="bg-blue-600 h-full" style={{ width: `${project.progress}%` }}></div>
                </div>
              </div>
            </div>

            <section className="space-y-6">
              <div className="flex items-center gap-4 text-slate-300">
                <div className="h-[1px] flex-1 bg-slate-100"></div>
                <span className="text-[10px] font-bold uppercase tracking-widest">فكرة البحث الأولية</span>
                <div className="h-[1px] flex-1 bg-slate-100"></div>
              </div>
              
              <div className="p-8 border-2 border-dashed border-slate-100 rounded-xl flex flex-col items-center justify-center py-20 text-slate-300">
                <Terminal size={40} className="mb-4 opacity-10" />
                <p className="text-[11px] font-medium italic italic">النظام بانتظار مدخلات الباحث في &quot;لوحة المعالجة&quot; يميناً لبدء الصياغة...</p>
              </div>
            </section>

          </div>
        </div>
      </section>

      {/* شريط الأدوات الجانبي - للأوامر السريعة */}
      <aside className="w-64 bg-white border-r border-slate-200 p-6 space-y-8 shadow-inner">
        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">الأدوات النشطة</h3>
        <div className="space-y-4">
          <button className="w-full text-right p-3 bg-slate-50 rounded-lg text-[11px] font-bold flex justify-between items-center group hover:bg-blue-600 hover:text-white transition-all">
            تولي
            <Share2 size={14} className="opacity-60 group-hover:opacity-100" />
          </button>
        </div>
      </aside>
    </div>
  );
}
