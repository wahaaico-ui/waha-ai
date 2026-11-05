'use client';

import { useUiTranslation } from '@/lib/use-ui-translation';
import PdfProjectResults from '@/components/PdfProjectResults';

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
  const { text: ui, direction: uiDirection } = useUiTranslation();

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
  const [extractedText, setExtractedText] = useState('');
  const [reading, setReading] = useState<{ totalPages: number; processedPages: number; complete: boolean; method: string } | null>(null);
  const [readingRefresh, setReadingRefresh] = useState(0);
  const [allowExternalOcr, setAllowExternalOcr] = useState(false);
  const [analysisOutput, setAnalysisOutput] = useState('');
  const [analysisSaved, setAnalysisSaved] = useState(false);

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
      formData.append('projectId', projectId);
      formData.append('allowExternalOcr', String(allowExternalOcr));

      const parseRes = await fetch('/api/academic/parse-pdf', { method: 'POST', body: formData });

      const parseData = await parseRes.json();
      const extractedText = parseData.text;
      setExtractedText(extractedText); setReading(parseData.reading || null); setAnalysisOutput(''); setAnalysisSaved(false);
      if (!parseRes.ok) throw new Error(parseData.error || 'فشل استخراج النص');
      if (parseData.reportSaved) setReadingRefresh((value) => value + 1);
      if (!extractedText?.trim() || (parseData.ocrAvailable && !allowExternalOcr)) throw new Error(parseData.message || 'لا يوجد نص كافٍ للاستخدام؛ لم يُحفظ كمستخلص.');

      // 2. تحليل بـ Gemini
      setUploadStatus('جارٍ حفظ النص ومحاولة إعداد تحليل أولي…');
      const analyzeRes = await fetch('/api/academic/pdf-analyzer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: extractedText, projectId })
      });
      const analyzeData = await analyzeRes.json();
      setAnalysisOutput(typeof analyzeData.output === 'string' ? analyzeData.output : '');
      setAnalysisSaved(analyzeData.saved === true); setReadingRefresh((value) => value + 1);
      if (!analyzeRes.ok) throw new Error(analyzeData.error || 'تعذر حفظ التحليل؛ النص المحفوظ باقٍ.');
      const sourceId = analyzeData.sourceId || analyzeData.id;
      if (!sourceId) throw new Error("لم يرجع sourceId");

      // 3. توليد مراجع حقيقية
      setUploadStatus('جاري البحث عن معرّف DOI لتوثيق المصدر...');
      const citeRes = await fetch('/api/academic/citations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceId })
      });
      if (!citeRes.ok) throw new Error("فشل توليد المراجع");

      const citationData = await citeRes.json();
      setUploadStatus(`حُفظ النص المستخرج.${(analyzeData.analysisStatus === 'unavailable' || analyzeData.analysisStatus === 'already_saved') ? ' التحليل غير متاح، لكن النص باقٍ.' : ' راجع التحليل الآلي.'} ${citationData.message || 'راجع التوثيق قبل الاستخدام.'}`);
      setSelectedFile(null);
      const fileInput = document.getElementById('pdf-upload') as HTMLInputElement;
      if (fileInput) fileInput.value = '';

      await fetchProjectData();

    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : 'حدث خطأ غير متوقع');
      setUploadStatus('');
    } finally {
      setSubmitting(false);
      // A citation/provider failure must not hide an already-saved raw source.
      await fetchProjectData();

    }
  };

  if (!projectId) {
    return (
      <div className="p-8 text-center space-y-4">
        <p className="text-gray-500">{ui("لا يوجد مشروع محدد بعد.")}</p>
        <Link
          href="/projects/create"
          className="inline-flex items-center justify-center px-6 py-3 bg-gradient-to-l from-blue-500 to-teal-400 text-gray-950 font-bold rounded-xl transition-all text-sm"
        >
          {ui("أنشئ مشروعاً")}</Link>
      </div>
    );
  }

  if (loading) return <div className="p-8 text-center">{ui("جاري التحميل...")}</div>;
  if (error || !project) return <div className="p-8 text-center text-red-500">{error || 'Project not found'}</div>;

  return (
    <div dir={uiDirection} className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white p-4 sm:p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow">
          <h1 className="text-2xl font-bold">{project.title}</h1>
          <Link href={`/research/tasks?projectId=${encodeURIComponent(project.id)}`} className="mt-2 block text-sm text-blue-700 underline">{ui("العودة إلى المهام والمخرجات")}</Link>
        </div>
        <PdfProjectResults projectId={project.id} sources={sources} refreshKey={readingRefresh} currentText={extractedText} currentAnalysis={analysisOutput} analysisSaved={analysisSaved} partial={Boolean(reading && !reading.complete)} />

        {references.length > 0 && <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow">
          <h2 className="text-lg font-semibold mb-4">{ui("مراجع Zotero (")}{' '}{references.length})</h2>
          <div className="space-y-3">{references.map((reference) => <article key={reference.id} className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:bg-gray-900">
            <h3 className="font-semibold text-blue-700 dark:text-blue-300">{reference.title}</h3>
            <p className="mt-1 text-xs text-gray-500">{reference.authors.map((author) => author.name).filter(Boolean).join(ui("،")) || ui("مؤلف غير محدد")}{reference.publication_year ? ` · ${reference.publication_year}` : ''}</p>
            {reference.publication_title && <p className="mt-1 text-xs text-gray-500">{reference.publication_title}</p>}
            <div className="mt-2 flex flex-wrap gap-3 text-xs">{reference.doi && <span>DOI: {reference.doi}</span>}{reference.url && <a href={reference.url} target="_blank" rel="noopener noreferrer" className="font-bold text-blue-600 hover:underline">{ui("فتح المصدر ↗")}</a>}</div>
          </article>)}</div>
        </div>}

        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow">
          <h2 className="text-lg font-semibold mb-4">{ui("استخراج نص PDF وحفظه في المشروع")}</h2>
          <p className="mb-4 text-sm leading-7">{ui("اختر ملف PDF حتى 10 MB و50 صفحة. الملفات الأطول تُرفض دون اقتطاع صامت.")}</p>
          <label className="mb-4 flex items-start gap-3 text-sm leading-6"><input type="checkbox" checked={allowExternalOcr} onChange={(event) => setAllowExternalOcr(event.target.checked)} className="mt-1" />{ui("أوافق على إرسال الملف إلى Google لاستخراج النص إذا كان ممسوحًا ضوئيًا. دون الموافقة تبقى المعالجة محلية للنص.")}</label>
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
              {submitting ? ui("جارٍ استخراج النص وحفظه…") : ui("استخرج النص واحفظه")}
            </button>
            {uploadStatus && <p className="text-sm font-medium text-blue-600 mt-2">{uploadStatus}</p>}
            {uploadError && <div className="mt-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">{ui(uploadError)}</div>}
          </form>
        </div>

        <details className="rounded-xl border bg-white p-4"><summary className="cursor-pointer font-bold">{ui("استيراد مراجع Zotero والتوثيق")}</summary><ZoteroImportPanel projectId={project.id} onImported={fetchProjectData} />{sources.map((source) => <div key={source.id} className="mt-3 break-words text-sm"><p>APA: {source.parsed_citation_apa || ui("لا توثيق محفوظ")}</p><p>IEEE: {source.parsed_citation_ieee || ui("لا توثيق محفوظ")}</p></div>)}</details>
      </div>
    </div>
  );
}

export default function WorkspacePage() {
  const { text: ui } = useUiTranslation();

  return <Suspense fallback={<div className="p-8 text-center">{ui("جاري التحميل...")}</div>}><WorkspaceContent /></Suspense>;
}
