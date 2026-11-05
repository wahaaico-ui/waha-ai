'use client';

import { useEffect, useState } from 'react';
import type { CitationStyle } from './citations/types';
import type { ProjectLibraryItem } from './project-library-client';

type Entry = { itemId: string; number: number; text: string };
const EMPTY: Entry[] = [];
export function useLibraryBibliography(items: ProjectLibraryItem[] | null, style: CitationStyle, requestKey: string) {
  const [retry, setRetry] = useState(0);
  const key = `${requestKey}:${style}:${retry}`;
  const [snapshot, setSnapshot] = useState<{ key: string; entries: Entry[]; error: boolean } | null>(null);
  useEffect(() => {
    if (!items?.length) return;
    let active = true;
    let worker: Worker | undefined;
    const fail = () => { if (active) setSnapshot({ key, entries: EMPTY, error: true }); worker?.terminate(); };
    try {
      worker = new Worker(new URL('./library-bibliography.worker.ts', import.meta.url));
      worker.onmessage = ({ data }: MessageEvent<{ success?: boolean; entries?: Entry[] }>) => {
        if (!active) return;
        if (!data.success || !Array.isArray(data.entries)) { fail(); return; }
        setSnapshot({ key, entries: data.entries, error: false });
        worker?.terminate();
      };
      worker.onerror = fail;
      worker.onmessageerror = fail;
      // Abstracts and retained discovery details are not needed for formatting.
      worker.postMessage({ style, items: items.map(item => ({ ...item, literaturePaper: undefined })) });
    } catch { fail(); }
    return () => { active = false; worker?.terminate(); };
  }, [items, style, key]);
  const current = snapshot?.key === key ? snapshot : null;
  return { entries: current?.entries || EMPTY, error: Boolean(current?.error), loading: Boolean(items?.length) && !current, retry: () => setRetry(value => value + 1) };
}
