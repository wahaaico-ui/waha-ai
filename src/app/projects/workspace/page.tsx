'use client';
import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';

function WorkspaceContent() {
  const searchParams = useSearchParams();
  const projectId = searchParams.get('projectId');
  const [project, setProject] = useState<any>(null);
  const [sources, setSources] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [newSourceText, setNewSourceText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || '', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '');
  useEffect(() => {
    if (!projectId) { setError('No ID'); setLoading(false); return; }
    async function load() {
      try {
        setLoading(true);
        const { data: p } = await supabase.from('projects').select('*').eq('id', projectId).single();
        setProject(p);
        const { data: s } = await supabase.from('sources').select('*').eq('project_id', projectId);
        setSources(s || []);
      } catch (err: any) { setError(err.message); } finally { setLoading(false); }
    }
    load();
  }, [projectId]);
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSourceText.trim() || !projectId) return;
    setSubmitting(true);
    try {
      const { data, error } = await supabase.from('sources').insert({ project_id: projectId, raw_text: newSourceText.trim(), confidence: 0.95, parsed_citation_apa: 'APA', parsed_citation_ieee: 'IEEE' }).select().single();
      if (error) throw error;
      setSources([data, ...sources]);
      setNewSourceText('');
    } catch (err: any) { alert(err.message); } finally { setSubmitting(false); }
  };
  if (loading) return <div className='p-8 text-center'>جاري التحميل...</div>;
  if (error || !project) return <div className='p-8 text-center text-red-500'>{error}</div>;
  return (
    <div className='p-6 max-w-4xl mx-auto space-y-6'>
      <div className='bg-white p-6 rounded shadow'><h1 className='text-xl font-bold'>{project.title}</h1><p className='text-xs text-gray-500'>ID: {project.id}</p></div>
      <div className='bg-white p-6 rounded shadow'>
        <form onSubmit={handleSubmit} className='space-y-3'>
          <textarea value={newSourceText} onChange={e => setNewSourceText(e.target.value)} className='w-full p-2 border rounded' placeholder='أدخل النص هنا...' required />
          <button type='submit' disabled={submitting} className='px-4 py-2 bg-blue-600 text-white rounded'>{submitting ? 'جاري الحفظ...' : 'حفظ المصدر'}</button>
        </form>
      </div>
      <div className='bg-white p-6 rounded shadow space-y-3'>
        <h2 className='font-bold'>المصادر ({sources.length})</h2>
        {sources.map(src => <div key={src.id} className='p-3 bg-gray-50 rounded border text-sm'><p>{src.raw_text}</p></div>)}
      </div>
    </div>
  );
}
export default function WorkspacePage() {
  return (<Suspense fallback={<div className='p-8 text-center'>جاري التحميل...</div>}><WorkspaceContent /></Suspense>);
}
