'use client';

import { supabase } from '@/lib/supabase/client';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import UniversityOnboarding from '@/components/UniversityOnboarding';

export default function CreateProjectPage() {
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [createdProjectId, setCreatedProjectId] = useState<string | null>(null);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('عنوان المشروع مطلوب');
      return;
    }

    setLoading(true);
    setError('');

    try {
      if (!supabaseUrl || !supabaseKey) {
        throw new Error('Supabase credentials missing');
      }
// جلب المستخدم الحالي للتأكد من وجود user_id مطلوب في الجدول
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new Error('يجب تسجيل الدخول أولاً لإنشاء مشروع');
      }

      // إدخال المشروع مع تمرير user_id الحقيقي
      const { data, error: insertError } = await supabase
        .from('projects')
        .insert({
          title: title.trim(),
          status: 'active',
          user_id: user.id,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      if (data && data.id) {
        setCreatedProjectId(data.id);
      } else {
        router.push('/projects/workspace');
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'حدث خطأ أثناء إنشاء المشروع');
    } finally {
      setLoading(false);
    }
  };

  if (createdProjectId) {
    return (
      <UniversityOnboarding
        projectId={createdProjectId}
        onComplete={() => {
          router.push(`/projects/workspace?projectId=${createdProjectId}`);
        }}
      />
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg max-w-md w-full p-6 border border-gray-200 dark:border-gray-700">
        <h1 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">إنشاء مشروع أكاديمي جديد</h1>
        {error && (
          <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-lg text-sm">
            {error}
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              عنوان المشروع (Title)
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="أدخل عنوان البحث أو المشروع..."
              className="w-full p-3 border rounded-lg bg-gray-50 dark:bg-gray-900 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-lg transition duration-200 disabled:opacity-50"
          >
            {loading ? 'جاري الإنشاء والربط...' : 'إنشاء المشروع والبدء'}
          </button>
        </form>
      </div>
    </div>
  );
}
