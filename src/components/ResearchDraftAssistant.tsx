'use client';

import { Sparkles } from 'lucide-react';
import { useState } from 'react';
import type { JourneyStage } from '@/lib/research-journey';

export default function ResearchDraftAssistant({ projectId, stage, onDraft }: {
  projectId: string;
  stage: Extract<JourneyStage, 'problem' | 'objectives' | 'questions' | 'methodology'>;
  onDraft: (draft: Record<string, unknown>) => void;
}) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'error' | 'ready'>('idle');
  const [message, setMessage] = useState('');

  const generate = async () => {
    setStatus('loading'); setMessage('');
    try {
      const response = await fetch('/api/research/draft', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectId, stage }) });
      const data = await response.json() as { draft?: Record<string, unknown>; notice?: string; error?: string };
      if (!response.ok || !data.draft) throw new Error(data.error || 'تعذر إعداد المسودة.');
      onDraft(data.draft);
      setMessage(data.notice || 'أعددنا مسودة قابلة للتعديل.');
      setStatus('ready');
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : 'تعذر إعداد المسودة.');
      setStatus('error');
    }
  };

  return <section className="rounded-2xl border border-blue-200 bg-gradient-to-l from-blue-50 to-white p-5">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div><h2 className="font-black text-slate-950">لا تبدأ من صفحة فارغة</h2><p className="mt-1 text-xs leading-6 text-slate-600">نُعد مسودة من المراحل التي اعتمدتها، ثم تراجعها وتصححها قبل الحفظ.</p></div>
      <button type="button" onClick={() => void generate()} disabled={status === 'loading'} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white disabled:opacity-50"><Sparkles className="h-4 w-4" />{status === 'loading' ? 'جارٍ إعداد المسودة…' : 'اقترح مسودة من مشروعي'}</button>
    </div>
    {message && <p role={status === 'error' ? 'alert' : undefined} className={`mt-3 rounded-xl p-3 text-xs leading-6 ${status === 'error' ? 'bg-rose-50 text-rose-800' : 'bg-emerald-50 text-emerald-800'}`}>{message}</p>}
  </section>;
}
