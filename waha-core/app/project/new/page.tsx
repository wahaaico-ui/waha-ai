'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function NewProjectPage() {
  const [title, setTitle] = useState('')
  const [ideaText, setIdeaText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function checkAuth() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) router.push('/login')
    }
    checkAuth()
  }, [router, supabase])

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      router.push('/login')
      return
    }

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
      setError('خطأ في الحفظ: ' + insertError.message)
      setLoading(false)
    } else {
      router.push('/dashboard')
    }
  }

  return (
    <div className="min-h-screen bg-[#090D16] text-white p-8" dir="rtl">
      <div className="mx-auto max-w-2xl rounded-2xl bg-[#111827] border border-gray-800 p-8 shadow-xl">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-white">مشروع بحثي جديد</h1>
          <Link href="/dashboard" className="text-sm text-emerald-400 hover:underline">
            &larr; العودة لوحة التحكم
          </Link>
        </div>
        <p className="mb-6 text-sm text-gray-400">أدخل عنوان البحث والفكرة الأولية لإطلاق محرك WAHA.</p>

        {error && (
          <div className="mb-4 rounded-xl bg-red-500/10 border border-red-500/20 p-4 text-sm text-red-400">
            {error}
          </div>
        )}

        <form onSubmit={handleCreateProject} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">عنوان البحث</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="w-full rounded-xl bg-[#090D16] border border-gray-800 px-4 py-3 text-white focus:border-emerald-500 focus:outline-none"
              placeholder="مثال: تأثير الذكاء الاصطناعي على التعليم العالي"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">الفكرة البحثية الأولية (Raw Idea)</label>
            <textarea
              value={ideaText}
              onChange={(e) => setIdeaText(e.target.value)}
              required
              rows={5}
              className="w-full rounded-xl bg-[#090D16] border border-gray-800 px-4 py-3 text-white focus:border-emerald-500 focus:outline-none"
              placeholder="اكتب فكرتك باختصار، وسيتولى النظام تحليلها وصياغتها..."
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-emerald-500 hover:bg-emerald-600 text-gray-950 font-semibold py-3.5 transition-all shadow-lg shadow-emerald-500/10 disabled:opacity-50"
          >
            {loading ? 'جاري الإنشاء...' : 'بدء رحلة البحث (تحليل الفكرة)'}
          </button>
        </form>
      </div>
    </div>
  )
}
