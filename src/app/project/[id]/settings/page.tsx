'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

export default function ProjectSettingsPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const projectId = resolvedParams.id;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    async function fetchProject() {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .single();

      if (error || !data) {
        setError('تعذر جلب بيانات المشروع.');
      } else {
        setTitle(data.title || '');
        setDescription(data.description || '');
      }
      setLoading(false);
    }

    fetchProject();
  }, [projectId, supabase]);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    const { error } = await supabase
      .from('projects')
      .update({ title, description })
      .eq('id', projectId);

    if (error) {
      setError(error.message);
    } else {
      setSuccess('تم تحديث بيانات المشروع بنجاح.');
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!window.confirm('هل أنت متأكد من حذف هذا المشروع نهائياً؟ لا يمكن التراجع عن هذا الإجراء.')) {
      return;
    }

    const { error } = await supabase
      .from('projects')
      .delete()
      .eq('id', projectId);

    if (error) {
      setError(error.message);
    } else {
      router.push('/dashboard');
      router.refresh();
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#090D16] text-white">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#090D16] text-white p-8 md:p-12" dir="rtl">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-8 border-b border-gray-800 pb-6">
          <div className="flex items-center gap-4">
            <Link
              href={`/project/${projectId}`}
              className="text-sm text-emerald-400 hover:text-emerald-300 transition-colors inline-flex items-center gap-1"
            >
              &larr; العودة لتفاصيل المشروع
            </Link>
            <span className="text-gray-600">/</span>
            <span className="text-sm text-gray-400">إعدادات المشروع</span>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 text-sm text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
            {success}
          </div>
        )}

        <form onSubmit={handleUpdate} className="bg-[#111827] border border-gray-800 rounded-2xl p-6 md:p-8 shadow-xl space-y-6 mb-8">
          <h2 className="text-xl font-bold text-white mb-4">تعديل بيانات المشروع</h2>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">عنوان المشروع</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-800 bg-[#090D16] text-white focus:ring-2 focus:ring-emerald-500 outline-none transition-all text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">وصف المشروع</label>
            <textarea
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-800 bg-[#090D16] text-white focus:ring-2 focus:ring-emerald-500 outline-none transition-all resize-none text-sm"
            />
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-gray-950 font-semibold rounded-xl transition-all shadow-lg shadow-emerald-500/10 disabled:opacity-50 text-sm"
            >
              {saving ? 'جاري الحفظ...' : 'حفظ التعديلات'}
            </button>
          </div>
        </form>

        <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-6 md:p-8 shadow-xl flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-red-400 mb-1">منطقة الخطر (حذف المشروع)</h3>
            <p className="text-xs text-gray-400">حذف هذا المشروع سيؤدي إلى إزالة كافة البيانات والتقارير المرتبطة به نهائياً.</p>
          </div>
          <button
            onClick={handleDelete}
            className="px-5 py-2.5 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-xl transition-all text-sm shrink-0"
          >
            حذف المشروع
          </button>
        </div>
      </div>
    </main>
  );
}
