'use client';

import { useEffect, useState } from 'react';
import { Cloud, CloudAlert, CloudCheck, LoaderCircle } from 'lucide-react';
import {
  JOURNEY_AUTOSAVE_EVENT,
  type JourneyAutosaveDetail,
  type JourneyAutosaveStatus,
} from '@/lib/use-journey-autosave';

const LABELS: Record<JourneyAutosaveStatus, string> = {
  idle: 'المسودة محفوظة عند الكتابة',
  pending: 'تغييرات غير محفوظة',
  saving: 'جارٍ حفظ المسودة…',
  saved: 'المسودة محفوظة',
  error: 'تعذر حفظ المسودة',
};

export default function JourneyAutosaveIndicator() {
  const [detail, setDetail] = useState<JourneyAutosaveDetail>({ stage: 'verify', status: 'idle' });

  useEffect(() => {
    const handle = (event: Event) => setDetail((event as CustomEvent<JourneyAutosaveDetail>).detail);
    window.addEventListener(JOURNEY_AUTOSAVE_EVENT, handle);
    return () => window.removeEventListener(JOURNEY_AUTOSAVE_EVENT, handle);
  }, []);

  const Icon = detail.status === 'saved' ? CloudCheck : detail.status === 'error' ? CloudAlert : detail.status === 'saving' ? LoaderCircle : Cloud;
  return (
    <div
      role="status"
      title={detail.message || LABELS[detail.status]}
      className={`flex min-w-32 items-center justify-center gap-2 rounded-xl px-3 py-2 text-[10px] font-bold ${detail.status === 'error' ? 'bg-rose-50 text-rose-700' : detail.status === 'pending' ? 'bg-amber-50 text-amber-700' : 'text-slate-600'}`}
    >
      <Icon className={`h-4 w-4 ${detail.status === 'saving' ? 'animate-spin' : ''}`} />
      {LABELS[detail.status]}
    </div>
  );
}
