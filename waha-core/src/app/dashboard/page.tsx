'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function DashboardPage() {
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [projects, setProjects] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    async function loadData() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/login')
        return
      }
      setUserEmail(session.user.email ?? null)

      // جلب مشاريع المستخدم
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .order('created_at', { ascending: false })

      if (!error && data) {
        setProjects(data)
      }
      setLoading(false)
    }
    loadData()
  }, [router])

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="mx-auto max-w-4xl rounded-xl bg-white p-6 shadow-sm border border-slate-200">
        <div className="flex justify-between items-center mb-6 border-b pb-4">
          <div>
            <h1 className="text-xl font-bold text-slate-800">لوحة تحكم الباحث (WAHA)</h1>
            <p className="text-sm text-slate-500">{userEmail}</p>
          </div>
          <button
            onClick={() => router.push('/project/new')}
            className="rounded-lg bg-blue-600 px-4 py-2 text-white font-medium hover:bg-blue-700 shadow-sm"
          >
            + مشروع بحثي جديد
          </button>
        </div>

        {loading ? (
          <p className="text-center text-slate-500 py-8">جاري تحميل المشاريع...</p>
        ) : projects.length === 0 ? (
          <div className="rounded-lg border-2 border-dashed border-slate-200 p-12 text-center">
            <p className="text-slate-600 mb-4">لا توجد مشاريع بحثية نشطة حالياً.</p>
            <button 
              onClick={() => router.push('/project/new')}
              className="rounded-lg bg-blue-600 px-4 py-2 text-white font-medium hover:bg-blue-700"
            >
              أنشئ مشروعك الأول الآن
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {projects.map((proj) => (
              <div key={proj.id} className="p-4 rounded-lg border border-slate-200 flex justify-between items-center hover:bg-slate-50">
                <div>
                  <h3 className="font-bold text-slate-800">{proj.title}</h3>
                  <p className="text-xs text-slate-400">تاريخ الإنشاء: {new Date(proj.created_at).toLocaleDateString()}</p>
                </div>
                <span className="px-3 py-1 bg-blue-50 text-blue-600 text-xs font-semibold rounded-full">
                  {proj.schema_data?.project_info?.current_stage || 'idea'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
