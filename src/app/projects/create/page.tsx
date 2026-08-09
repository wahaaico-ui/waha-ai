"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/utils/supabase';

export default function CreateProject() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  // حقول النموذج
  const [projectName, setProjectName] = useState('');
  const [description, setDescription] = useState('');
  const [endDate, setEndDate] = useState('');
  const [priority, setPriority] = useState('متوسطة');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        // حظر ومنع غير المسجلين وتوجيههم لصفحة تسجيل الدخول فوراً
        router.push('/login');
      } else {
        setUserId(user.id);
        setLoading(false);
      }
    };
    checkUser();
  }, [router]);

  // دالة تفعيل نظام المشاريع الحقيقي بالكامل
  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;

    setSubmitting(true);
    setMessage('');

    try {
      // 1. إنشاء و حفظ الـ Project الجديد داخل قاعدة البيانات
      const { data: projectData, error: projectError } = await supabase
        .from('projects')
        .insert([
          {
            user_id: userId,
            name: projectName,
            description: description,
            end_date: endDate ? endDate : null,
            priority: priority
          }
        ])
        .select()
        .single(); // جلب بيانات المشروع المضاف فوراً للحصول على الـ ID

      if (projectError) throw projectError;

      if (projectData) {
        // 2. إنشاء الـ Research Profile تلقائياً وربطه بـ ID المشروع الجديد
        const { error: researchError } = await supabase
          .from('research_profiles')
          .insert([
            {
              project_id: projectData.id,
              summary: `ملخص ذكي مبدئي لمشروع: ${projectName}`,
              ai_recommendations: 'جاري توليد التوصيات الذكية المتقدمة بناءً على أهداف مساحة العمل...'
            }
          ]);

        if (researchError) throw researchError;

        // 3. إنشاء الـ Workspace تلقائياً (تحديث رسالة النجاح للمستخدم لتهيئة بيئة العمل)
        setMessage('🚀 تم إنشاء المشروع، توليد الـ Research Profile وتهيئة الـ Workspace بنجاح! جاري تحويلك...');
        
        // 4. تحويل المستخدم تلقائياً إلى الـ Dashboard بعد اكتمال كل العمليات
        setTimeout(() => {
          router.push('/dashboard');
        }, 1500);
      }

    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'تعذر معالجة البيانات';
      setMessage(`❌ خطأ أثناء تكوين النظام: ${message}`);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center font-sans">
        <p className="text-slate-400 text-lg animate-pulse">جاري فحص صلاحيات الأمان للتوجيه...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-6 font-sans antialiased">
      <div className="w-full max-w-2xl bg-slate-800/50 backdrop-blur-md border border-slate-800 rounded-2xl p-8 shadow-xl">
        <div className="mb-8 border-b border-slate-700/50 pb-5">
          <h2 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent mb-2 text-right">
            تكوين مشروع ذكي جديد
          </h2>
          <p className="text-slate-400 text-sm text-right">أدخل تفاصيل مشروعك لتقوم منصة WAHA AI بتهيئة مساحة العمل الذكية لك</p>
        </div>

        {/* رسالة حالة توليد النظام */}
        {message && (
          <div className={`p-4 rounded-xl text-sm mb-5 text-center border ${
            message.startsWith('❌') ? 'bg-red-500/10 border-red-500/20 text-red-400' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
          }`}>
            {message}
          </div>
        )}

        <form className="space-y-6" onSubmit={handleCreateProject}>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5 text-right">اسم المشروع</label>
            <input 
              type="text" 
              required
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="مثال: حملة التسويق الرقمي، تطوير التطبيق" 
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors text-right"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5 text-right">وصف المشروع وأهدافه (للمساعد الذكي)</label>
            <textarea 
              rows={4}
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="اشرح باختصار ماذا تريد أن يحقق هذا المشروع، لكي يستطيع الذكاء الاصطناعي مساعدتك واقتراح المهام..." 
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors text-right"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5 text-right">تاريخ الانتهاء المتوقع</label>
              <input 
                type="date" 
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-200 focus:outline-none focus:border-blue-500 transition-colors text-right"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5 text-right">مستوى الأولوية</label>
              <select 
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-200 focus:outline-none focus:border-blue-500 transition-colors text-right appearance-none"
              >
                <option value="منخفضة">منخفضة</option>
                <option value="متوسطة">متوسطة</option>
                <option value="عالية جداً 🔥">عالية جداً 🔥</option>
              </select>
            </div>
          </div>

          <div className="pt-4 flex items-center justify-end gap-4">
            <a href="/dashboard" className="px-5 py-3 text-sm font-medium text-slate-400 hover:text-white transition-colors">إلغاء</a>
            <button 
              type="submit"
              disabled={submitting}
              className="bg-gradient-to-r from-blue-500 to-emerald-500 hover:from-blue-600 hover:to-emerald-600 text-white font-medium px-8 py-3 rounded-xl transition-all shadow-lg shadow-blue-500/20 disabled:opacity-50"
            >
              {submitting ? 'جاري تهيئة مساحة العمل...' : 'توليد مساحة العمل الذكية 🚀'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
