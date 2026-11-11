'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import { useUiTranslation } from '@/lib/use-ui-translation';
import type { IndicatorState, ProjectIndicator } from '@/lib/project-indicators';

const TITLES: Record<ProjectIndicator['id'], string> = {
  guide: 'الالتزام بدليل الجامعة',
  time: 'الوقت',
  publication: 'قابلية النشر في مجلة',
};
const STATES: Record<IndicatorState, { label: string; className: string }> = {
  met: { label: 'مستوفى', className: 'border-emerald-200 bg-emerald-50 text-emerald-800' },
  attention: { label: 'يحتاج متابعة', className: 'border-amber-300 bg-amber-50 text-amber-900' },
  not_assessed: { label: 'غير مُقيَّم', className: 'border-slate-200 bg-slate-100 text-slate-700' },
};

/** The three indicators as measured, without loading, so it can be rendered and tested on its own. */
export function ProjectIndicatorsView({ indicators }: { indicators: ProjectIndicator[] }) {
  const { text: ui } = useUiTranslation();
  const show = (text: string, values?: Array<string | number>) => ui(text, values?.map(value => (typeof value === 'number' ? value : ui(value))));
  return <div className="grid gap-3 lg:grid-cols-3">{indicators.map(indicator => <article key={indicator.id} aria-label={ui(TITLES[indicator.id])} className="rounded-2xl border border-slate-200 bg-white p-5">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h3 className="text-sm font-black text-slate-950">{ui(TITLES[indicator.id])}</h3>
      <span className={`rounded-full border px-2.5 py-1 text-xs font-bold ${STATES[indicator.state].className}`}>{ui(STATES[indicator.state].label)}</span>
    </div>
    {indicator.lines.length > 0 && <ul className="mt-3 space-y-2 text-sm leading-6">{indicator.lines.map(item => <li key={`${item.text}:${(item.values || []).join('|')}`} className="flex items-start gap-2">
      {item.state === 'met' ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
        : item.state === 'attention' ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
          : <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />}
      <span className={item.state === 'attention' ? 'text-amber-900' : 'text-slate-700'}>{show(item.text, item.values)}</span>
    </li>)}</ul>}
    {indicator.missing.length > 0 && <div className="mt-3 rounded-xl bg-slate-50 p-3">
      <p className="text-xs font-bold text-slate-600">{ui('ما ينقص هذا المؤشر')}</p>
      <ul className="mt-1 list-disc space-y-1 ps-5 text-xs leading-6 text-slate-700">{indicator.missing.map(item => <li key={item.text}>{show(item.text, item.values)}</li>)}</ul>
    </div>}
  </article>)}</div>;
}

/** Guide, time and publishability indicators of the project (DOC-38-01). */
export default function ProjectIndicatorsPanel({ projectId }: { projectId: string }) {
  const { text: ui } = useUiTranslation();
  const [result, setResult] = useState<{ projectId: string; indicators: ProjectIndicator[] | null; message: string } | null>(null);

  useEffect(() => {
    let active = true;
    fetch(`/api/projects/${encodeURIComponent(projectId)}/indicators`, { cache: 'no-store' })
      .then(async response => {
        const data = await response.json() as { indicators?: ProjectIndicator[]; error?: string };
        if (!active) return;
        setResult(response.ok && data.indicators
          ? { projectId, indicators: data.indicators, message: '' }
          : { projectId, indicators: null, message: data.error || 'تعذر حساب مؤشرات المشروع الآن. أعد المحاولة.' });
      })
      .catch(() => { if (active) setResult({ projectId, indicators: null, message: 'تعذر الاتصال بالخادم. حاول مرة أخرى.' }); });
    return () => { active = false; };
  }, [projectId]);

  const current = result?.projectId === projectId ? result : null;
  return <section aria-label={ui('مؤشرات المشروع')} className="rounded-2xl border border-slate-200 bg-slate-50 p-5 sm:p-6">
    <h2 className="text-lg font-black text-slate-950">{ui('مؤشرات المشروع')}</h2>
    <p className="mt-1 text-sm leading-7 text-slate-600">{ui('يبيّن كل مؤشر ما قاسه وما ينقصه. حين تنقص بياناته يظهر «غير مُقيَّم»، ولا تُعرض درجة.')}</p>
    <div className="mt-4">
      {!current ? <p className="text-sm text-slate-500">{ui('جارٍ حساب المؤشرات…')}</p>
        : current.indicators ? <ProjectIndicatorsView indicators={current.indicators} />
          : <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{ui(current.message)}</p>}
    </div>
  </section>;
}
