'use client';

import { supabase } from '@/lib/supabase/client';
import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import ZoteroImportPanel from '@/components/ZoteroImportPanel';
type Project = {
  id: string;
  title: string;
};

type Source = {
  id: string;
  project_id: string;
  raw_text?: string | null;
  title?: string | null;
  authors?: string | null;
  parsed_citation_apa?: string | null;
  parsed_citation_ieee?: string | null;
  [key: string]: unknown;
};

type ProjectReference = {
  id: string;
  title: string;
  authors: Array<{ type: string; name: string }>;
  publication_year?: number | null;
  publication_title?: string | null;
  doi?: string | null;
  url?: string | null;
};

function WorkspaceContent() {
  const searchParams = useSearchParams();
  const projectId = searchParams.get('projectId');

  const [project, setProject] = useState<Project | null>(null);
  const [sources, setSources] = useState<Source[]>([]);
  const [references, setReferences] = useState<ProjectReference[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');
  const [uploadError, setUploadError] = useState('');

const fetchProjectData = async () => {
    try {
      setLoading(true);
      const { data: projData, error: projErr } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .single();
      if (projErr) throw projErr;
      setProject(projData);

      const { data: srcData, error: srcErr } = await supabase
        .from('sources')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });
      if (srcErr) throw srcErr;
      setSources(srcData || []);

      const { data: referenceData, error: referenceError } = await supabase
        .from('project_references')
        .select('id, title, authors, publication_year, publication_title, doi, url')
        .eq('project_id', projectId)
        .order('synced_at', { ascending: false });
      if (referenceError) throw referenceError;
      setReferences(referenceData || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'فشل في جلب البيانات');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!projectId) return;

    let cancelled = false;

    const loadProjectData = async () => {
      try {
        setLoading(true);

        const { data: projData, error: projErr } = await supabase
          .from('projects')
          .select('*')
          .eq('id', projectId)
          .single();

        if (projErr) throw projErr;

        const [{ data: srcData, error: srcErr }, { data: referenceData, error: referenceError }] = await Promise.all([
          supabase.from('sources').select('*').eq('project_id', projectId).order('created_at', { ascending: false }),
          supabase.from('project_references').select('id, title, authors, publication_year, publication_title, doi, url').eq('project_id', projectId).order('synced_at', { ascending: false }),
        ]);

        if (srcErr) throw srcErr;
        if (referenceError) throw referenceError;

        if (!cancelled) {
          setProject(projData);
          setSources(srcData || []);
          setReferences(referenceData || []);
          setError('');
          setLoading(false);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'فشل في جلب البيانات');
          setLoading(false);
        }
      }
    };

    loadProjectData();

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleFileUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile || !projectId) return;

    setSubmitting(true);
    setUploadError('');

    try {
      // 1. استخراج النص
      setUploadStatus('جاري استخراج النص من الـ PDF...');
      const formData = new FormData();
      formData.append('file', selectedFile);

      const parseRes = await fetch('/api/academic/parse-pdf', { method: 'POST', body: formData });
      if (!parseRes.ok) throw new Error('فشل استخراج النص');
      const parseData = await parseRes.json();
      const extractedText = parseData.text;

      // 2. تحليل بـ Gemini
      setUploadStatus('جاري التحليل واستخراج البيانات بـ Gemini...');
      const analyzeRes = await fetch('/api/academic/pdf-analyzer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: extractedText, projectId })
      });
      if (!analyzeRes.ok) throw new Error('فشل راوت التحليل pdf-analyzer');
      const analyzeData = await analyzeRes.json();
      const sourceId = analyzeData.sourceId || analyzeData.id;
      if (!sourceId) throw new Error('لم يرجع sourceId');

      // 3. توليد مراجع حقيقية
      setUploadStatus('جاري توليد مراجع APA/IEEE الحقيقية...');
      const citeRes = await fetch('/api/academic/citations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceId })
      });
      if (!citeRes.ok) throw new Error('فشل توليد المراجع');

      setUploadStatus('تم الرفع والتحليل بنجاح!');
      setSelectedFile(null);
      const fileInput = document.getElementById('pdf-upload') as HTMLInputElement;
      if (fileInput) fileInput.value = '';

      await fetchProjectData();

    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : 'حدث خطأ غير متوقع');
      setUploadStatus('');
    } finally {
      setSubmitting(false);
      setTimeout(() => setUploadStatus(''), 4000);
    }
  };

  if (!projectId) {
    return (
      <div className="p-8 text-center space-y-4">
        <p className="text-gray-500">لا يوجد مشروع محدد بعد.</p>
        <Link
          href="/projects/create"
          className="inline-flex items-center justify-center px-6 py-3 bg-gradient-to-l from-blue-500 to-teal-400 text-gray-950 font-bold rounded-xl transition-all text-sm"
        >
          أنشئ مشروعاً
        </Link>
      </div>
    );
  }

  if (loading) return <div className="p-8 text-center">جاري التحميل...</div>;
  if (error || !project) return <div className="p-8 text-center text-red-500">{error || 'Project not found'}</div>;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow">
          <h1 className="text-2xl font-bold">{project.title}</h1>
          <p className="text-sm text-gray-500 mt-1">ID: {project.id}</p>
        </div>

        <ZoteroImportPanel projectId={project.id} onImported={fetchProjectData} />

        {references.length > 0 && <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow">
          <h2 className="text-lg font-semibold mb-4">مراجع Zotero ({references.length})</h2>
          <div className="space-y-3">{references.map((reference) => <article key={reference.id} className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:bg-gray-900">
            <h3 className="font-semibold text-blue-700 dark:text-blue-300">{reference.title}</h3>
            <p className="mt-1 text-xs text-gray-500">{reference.authors.map((author) => author.name).filter(Boolean).join('، ') || 'مؤلف غير محدد'}{reference.publication_year ? ` · ${reference.publication_year}` : ''}</p>
            {reference.publication_title && <p className="mt-1 text-xs text-gray-500">{reference.publication_title}</p>}
            <div className="mt-2 flex flex-wrap gap-3 text-xs">{reference.doi && <span>DOI: {reference.doi}</span>}{reference.url && <a href={reference.url} target="_blank" rel="noopener noreferrer" className="font-bold text-blue-600 hover:underline">فتح المصدر ↗</a>}</div>
          </article>)}</div>
        </div>}

        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow">
          <h2 className="text-lg font-semibold mb-4">رفع ملف PDF للتحليل واستخراج المراجع (حقيقي)</h2>
          <form onSubmit={handleFileUpload} className="space-y-4">
            <input
              id="pdf-upload"
              type="file"
              accept="application/pdf"
              onChange={handleFileChange}
              className="w-full p-3 border rounded-lg bg-gray-50 dark:bg-gray-900 border-gray-300 cursor-pointer"
              required
            />
            <button
              type="submit"
              disabled={submitting || !selectedFile}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition disabled:opacity-50"
            >
              {submitting ? 'جاري المعالجة التسلسلية...' : 'رفع وتحليل ملف PDF'}
            </button>
            {uploadStatus && <p className="text-sm font-medium text-blue-600 mt-2">{uploadStatus}</p>}
            {uploadError && <div className="mt-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">{uploadError}</div>}
          </form>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow">
          <h2 className="text-lg font-semibold mb-4">المصادر المرفوعة ({sources.length})</h2>
          {sources.length === 0 && <p className="text-sm text-gray-500 dark:text-gray-400">لا توجد مصادر بعد. ارفع ملف PDF أعلاه لبدء التحليل.</p>}
          {sources.map(src => (
            <div key={src.id} className="p-4 mb-4 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200">
              <h3 className="font-semibold text-blue-600">النص المستخرج:</h3>
              <p className="text-sm text-gray-700 dark:text-gray-300 mt-1 line-clamp-3">{src.raw_text}</p>

              {src.title && <p className="text-sm mt-2"><strong>العنوان:</strong> {src.title}</p>}
              {src.authors && <p className="text-sm"><strong>المؤلفون:</strong> {src.authors}</p>}

              <div className="mt-4 pt-3 border-t border-gray-200">
                <p className="text-sm text-green-700"><strong>APA Citation:</strong> {src.parsed_citation_apa || 'قيد التوليد'}</p>
                <p className="text-sm text-green-700 mt-1"><strong>IEEE Citation:</strong> {src.parsed_citation_ieee || 'قيد التوليد'}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function WorkspacePage() {
  return <Suspense fallback={<div className="p-8 text-center">جاري التحميل...</div>}><WorkspaceContent /></Suspense>;
}
