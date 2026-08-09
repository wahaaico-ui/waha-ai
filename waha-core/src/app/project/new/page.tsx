'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function NewProjectPage() {
  const [title, setTitle] = useState('')
  const [ideaText, setIdeaText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    async function checkAuth() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) router.push('/login')
    }
    checkAuth()
  }, [router])

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      router.push('/login')
      return
    }

    // بناء هيكل البيانات الموحد بناءً على research.schema.json
    const initialSchemaData = {
      project_info: {
        project_id: crypto.randomUUID(),
        user_id: session.user.id,
        title: title,
        current_stage: "01_idea",
        updated_at: new Date().toISOString()
      },
      "01_idea": {
        raw_text: ideaText,
        status: "completed"
      },
      "02_gap": {
        identified_gap: "",
        status: "pending"
      },
      metadata: {
        version: "v1"
      }
    }

    // حفظ المشروع في قاعدة بيانات Supabase (نحتاج جدول projects)
    const { error: insertError } = await supabase
      .from('projects')
      .insert([
        { 
          user_id: session.user.id, 
          title: title, 
          schema_data: initialSchemaData 
        }
      ])

    if (insertError) {
      // إذا لم يكن الجدول موجوداً، سنقوم بتخزين مؤقت أو إظهار الخطأ بوضوح
      setError('خطأ في الحفظ: ' + insertError.message)
      setLoading(false)
    } else {
      router.push('/dashboard')
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="mx-auto max-w-2xl rounded-xl bg-white p-8 shadow-sm border border-slate-200">
        <h1 className="mb-2 text-2xl font-bold text-slate-900">مشروع بحثي جديد</h1>
        <p className="mb-6 text-sm text-slate-500">أدخل عنوان البحث والفكرة الأولية لإطلاق محرك WAHA.</p>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">
            {error}
          </div>
        )}

        <form onSubmit={handleCreateProject} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">عنوان البحث</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:border-blue-500 focus:outline-none"
              placeholder="مثال: تأثير الذكاء الاصطناعي على التعليم العالي"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">الفكرة البحثية الأولية (Raw Idea)</label>
            <textarea
              value={ideaText}
              onChange={(e) => setIdeaText(e.target.value)}
              required
              rows={5}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:border-blue-500 focus:outline-none"
              placeholder="اكتب فكرتك باختصار، وسيتولى النظام تحليلها وصياغتها..."
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-blue-600 py-3 font-medium text-white transition hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'جاري الإنشاء...' : 'بدء رحلة البحث (تحليل الفكرة)'}
          </button>
        </form>
      </div>
    </div>
  )
}
