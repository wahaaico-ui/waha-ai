'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { saveJourneyDraft, type JourneyStage } from '@/lib/research-journey';

export type JourneyAutosaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'error';
export const JOURNEY_AUTOSAVE_EVENT = 'waha:journey-autosave';

export type JourneyAutosaveDetail = {
  stage: JourneyStage;
  status: JourneyAutosaveStatus;
  savedAt?: string;
  message?: string;
};

function announce(detail: JourneyAutosaveDetail) {
  window.dispatchEvent(new CustomEvent<JourneyAutosaveDetail>(JOURNEY_AUTOSAVE_EVENT, { detail }));
}

export function useJourneyAutosave({
  projectId,
  stage,
  content,
  enabled,
  delay = 900,
}: {
  projectId: string;
  stage: JourneyStage;
  content: Record<string, unknown>;
  enabled: boolean;
  delay?: number;
}) {
  const serialized = useMemo(() => JSON.stringify(content), [content]);
  const [status, setStatus] = useState<JourneyAutosaveStatus>('idle');
  const latestRef = useRef({ serialized, content });
  const lastSavedRef = useRef('');
  const scopeRef = useRef('');

  useEffect(() => {
    latestRef.current = { serialized, content };
  }, [content, serialized]);

  useEffect(() => {
    if (!enabled || !projectId || serialized === lastSavedRef.current) return;
    const scope = `${projectId}:${stage}`;
    if (scopeRef.current !== scope) {
      scopeRef.current = scope;
      lastSavedRef.current = serialized;
      setStatus('saved');
      announce({ stage, status: 'saved' });
      return;
    }
    let active = true;
    setStatus('pending');
    announce({ stage, status: 'pending' });
    const timer = window.setTimeout(async () => {
      const snapshot = latestRef.current;
      const clientUpdatedAt = new Date().toISOString();
      setStatus('saving');
      announce({ stage, status: 'saving' });
      try {
        const result = await saveJourneyDraft(projectId, stage, snapshot.content, clientUpdatedAt);
        if (!active) return;
        if (!result.success) {
          setStatus('error');
          announce({
            stage,
            status: 'error',
            message: result.draft
              ? 'توجد مسودة أحدث محفوظة من جلسة أخرى.'
              : 'تعذر تأكيد حفظ المسودة. أعد تحميل الصفحة قبل متابعة التحرير.',
          });
          return;
        }
        lastSavedRef.current = snapshot.serialized;
        setStatus('saved');
        announce({ stage, status: 'saved', savedAt: result.draft?.savedAt || new Date().toISOString() });
      } catch (reason) {
        if (!active) return;
        setStatus('error');
        announce({
          stage,
          status: 'error',
          message: reason instanceof Error ? reason.message : 'تعذر الحفظ التلقائي.',
        });
      }
    }, delay);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [delay, enabled, projectId, serialized, stage]);

  useEffect(() => {
    if (!enabled || !projectId) return;
    const flush = () => {
      if (latestRef.current.serialized === lastSavedRef.current) return;
      void saveJourneyDraft(projectId, stage, latestRef.current.content, new Date().toISOString(), true);
    };
    window.addEventListener('pagehide', flush);
    return () => window.removeEventListener('pagehide', flush);
  }, [enabled, projectId, stage]);

  return status;
}
