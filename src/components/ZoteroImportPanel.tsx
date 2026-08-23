'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BookOpen, CheckCircle2, Loader2 } from 'lucide-react';

type Collection = { key: string; name: string; parentCollection: string | null };
type Status = { entitled: boolean; integration: null | { status: string } };

export default function ZoteroImportPanel({ projectId, onImported }: { projectId: string; onImported: () => Promise<void> }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [collectionKey, setCollectionKey] = useState('');
  const [loadingCollections, setLoadingCollections] = useState(false);
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;
    fetch('/api/integrations/zotero/status', { cache: 'no-store' })
      .then((response) => response.ok ? response.json() as Promise<Status> : null)
      .then((result) => { if (active && result) setStatus(result); });
    return () => { active = false; };
  }, []);

  async function loadCollections() {
    setLoadingCollections(true);
    setMessage('');
    const response = await fetch('/api/integrations/zotero/collections', { cache: 'no-store' });
    setLoadingCollections(false);
    if (!response.ok) return setMessage('تعذر تحميل مجموعات Zotero. أعد ربط الحساب إذا استمر الخطأ.');
    const data = await response.json() as { collections: Collection[] };
    setCollections(data.collections);
  }

  async function importReferences() {
    setImporting(true);
    setMessage('');
    const response = await fetch('/api/integrations/zotero/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, collectionKey: collectionKey || undefined }),
    });
    const data = await response.json() as { imported?: number; total?: number; error?: string };
    setImporting(false);
    if (!response.ok) return setMessage(data.error || 'تعذر استيراد المراجع');
    setMessage(`تمت مزامنة ${data.imported || 0} مرجعًا من أصل ${data.total || 0}.`);
    await onImported();
  }

  const connected = status?.integration?.status === 'connected';

  return (
    <section className="rounded-xl bg-white p-6 shadow dark:bg-gray-800">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-red-50 text-red-600 dark:bg-red-950/40"><BookOpen className="h-5 w-5" /></span>
        <div className="flex-1">
          <h2 className="text-lg font-semibold">استيراد المراجع من Zotero</h2>
          <p className="mt-1 text-sm leading-6 text-gray-500">استورد بيانات المراجع فقط؛ ملفات PDF تبقى في حساب Zotero الخاص بك.</p>
        </div>
      </div>

      {!status ? <Loader2 className="mt-5 animate-spin text-gray-400" /> : !status.entitled ? (
        <Link href="/pricing" className="mt-5 inline-flex rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white">الترقية إلى خطة الباحث</Link>
      ) : !connected ? (
        <Link href="/settings/integrations" className="mt-5 inline-flex rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white">ربط حساب Zotero</Link>
      ) : (
        <div className="mt-5 space-y-4">
          {collections.length === 0 ? (
            <button onClick={loadCollections} disabled={loadingCollections} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-bold disabled:opacity-50">
              {loadingCollections ? 'جاري تحميل المجموعات...' : 'تحميل مجموعات Zotero'}
            </button>
          ) : (
            <>
              <label className="block text-sm font-medium">المصدر</label>
              <select value={collectionKey} onChange={(event) => setCollectionKey(event.target.value)} className="w-full rounded-lg border border-gray-300 bg-white p-3 text-sm text-gray-900 dark:bg-gray-900 dark:text-white">
                <option value="">المكتبة كاملة — أول 100 مرجع</option>
                {collections.map((collection) => <option key={collection.key} value={collection.key}>{collection.name}</option>)}
              </select>
              <button onClick={importReferences} disabled={importing} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">
                {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                {importing ? 'جاري الاستيراد...' : 'استيراد إلى هذا المشروع'}
              </button>
            </>
          )}
        </div>
      )}
      {message && <p className="mt-4 text-sm text-blue-600 dark:text-blue-300">{message}</p>}
    </section>
  );
}
