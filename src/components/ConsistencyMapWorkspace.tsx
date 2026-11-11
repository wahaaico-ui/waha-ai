'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Network } from 'lucide-react';
import SiteHeader from '@/components/SiteHeader';
import { useUiTranslation } from '@/lib/use-ui-translation';
import { useProjectId } from '@/lib/use-project-id';
import type { ConsistencyMap, MapLink, MapNode, MapSignal } from '@/lib/research-objects/consistency-map';

const SIGNAL_STYLE: Record<MapSignal, { label: string; className: string }> = {
  sound: { label: 'سليمة', className: 'border-emerald-200 bg-emerald-50 text-emerald-800' },
  review: { label: 'تستحق المراجعة', className: 'border-amber-300 bg-amber-50 text-amber-900' },
  conflict: { label: 'متعارضة', className: 'border-rose-300 bg-rose-50 text-rose-800' },
  not_checked: { label: 'لم تُفحص', className: 'border-slate-200 bg-slate-100 text-slate-600' },
};
const LEGEND: MapSignal[] = ['sound', 'review', 'conflict', 'not_checked'];

const APPROACH_LABELS: Record<string, string> = { quantitative: 'منهج كمي', qualitative: 'منهج نوعي', mixed: 'منهج مختلط', descriptive: 'منهج وصفي' };

const NODE_NAMES: Record<MapNode['kind'], string> = {
  problem: 'مشكلة البحث', objective: 'الهدف {0}', question: 'السؤال {0}', hypothesis: 'الفرضية {0}', methodology: 'المنهج',
};

/** The map itself, without loading, so it can be rendered and tested on its own. */
export function ConsistencyMapView({ map, selected, onSelect }: { map: ConsistencyMap; selected: string | null; onSelect: (id: string | null) => void }) {
  const { text: ui, direction } = useUiTranslation();
  const arrow = direction === 'rtl' ? '←' : '→';
  const affected = new Set(selected ? map.affected[selected] || [] : []);
  const name = (node: MapNode) => ui(NODE_NAMES[node.kind], [node.number ?? '']);
  const allNodes = [map.problem, map.methodology, ...map.chains.flatMap(chain => [chain.objective, ...chain.questions.flatMap(step => [step.question, step.hypothesis])])]
    .filter((node): node is MapNode => Boolean(node));
  const selectedNode = allNodes.find(node => node.id === selected) || null;

  const nodeButton = (node: MapNode) => <button type="button" onClick={() => onSelect(selected === node.id ? null : node.id)} aria-pressed={selected === node.id}
    className={`inline-flex min-h-9 items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-black ${selected === node.id ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300 bg-white text-slate-800'}`}>
    {name(node)}{map.flagged.includes(node.id) && <span className={selected === node.id ? 'text-white' : 'text-amber-700'}>· {ui(node.kind === 'hypothesis' ? 'تستحق المراجعة' : 'يستحق المراجعة')}</span>}
  </button>;

  const linkRow = (from: MapNode | null, to: MapNode | null, link: MapLink | null, fallback?: string) => {
    if (!from || !to) return null;
    const signal = link?.signal ?? 'not_checked';
    const highlighted = Boolean(link && affected.has(link.id));
    return <li className={`rounded-xl border p-3 ${highlighted ? 'border-blue-500 ring-2 ring-blue-500' : 'border-slate-200'}`}>
      <div className="flex flex-wrap items-center gap-2">
        {nodeButton(from)}<span aria-hidden="true" className="text-slate-400">{arrow}</span>{nodeButton(to)}
        <span className={`rounded-full border px-2.5 py-1 text-xs font-bold ${SIGNAL_STYLE[signal].className}`}>{ui(SIGNAL_STYLE[signal].label)}</span>
        {highlighted && <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-800">{ui('متأثرة بما اخترته')}</span>}
      </div>
      {link && link.reasons.length > 0 && <ul className="mt-2 list-disc space-y-1 ps-5 text-xs leading-6 text-slate-700">{link.reasons.map(reason => <li key={reason}>{ui(reason)}</li>)}</ul>}
      {link?.action && <p className="mt-1 text-xs leading-6 text-slate-500">{ui('ما يمكنك فعله')}: {ui(link.action)}</p>}
      {!link && fallback && <p className="mt-1 text-xs leading-6 text-slate-500">{ui(fallback)}</p>}
    </li>;
  };

  return <div className="space-y-6">
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <p className="text-sm font-black">{ui('معنى الإشارات')}</p>
      <ul className="mt-3 flex flex-wrap gap-2">{LEGEND.map(signal => <li key={signal} className={`rounded-full border px-3 py-1 text-xs font-bold ${SIGNAL_STYLE[signal].className}`}>{ui(SIGNAL_STYLE[signal].label)}</li>)}</ul>
      <p className="mt-3 text-xs leading-6 text-slate-500">{ui('اضغط هدفًا أو سؤالًا أو غيرهما لتظهر العلاقات التي تتأثر به.')}</p>
      {selectedNode && <p role="status" className="mt-3 rounded-xl bg-blue-50 p-3 text-sm text-blue-900">
        {ui('اخترت {0}، وتتأثر به {1} من العلاقات.', [name(selectedNode), affected.size])}{' '}
        <button type="button" onClick={() => onSelect(null)} className="font-bold underline">{ui('إلغاء الاختيار')}</button>
      </p>}
    </div>

    {map.notices.length > 0 && <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
      <p className="text-sm font-black text-amber-950">{ui('أجزاء لم تُفحص بعد')}</p>
      <ul className="mt-2 list-disc space-y-1 ps-5 text-sm leading-7 text-amber-900">{map.notices.map(notice => <li key={notice}>{ui(notice)}</li>)}</ul>
    </div>}

    {map.problem && <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-center gap-2">{nodeButton(map.problem)}</div>
      <p dir="auto" className="mt-2 text-sm leading-7 text-slate-800">{map.problem.statement}</p>
    </div>}

    {map.hypothesesDecision && <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-black">{ui('لا فرضيات: قرار منهجي من الباحث')}</p>
        <span className={`rounded-full border px-2.5 py-1 text-xs font-bold ${SIGNAL_STYLE[map.hypothesesDecision.signal].className}`}>{ui(SIGNAL_STYLE[map.hypothesesDecision.signal].label)}</span>
      </div>
      {map.hypothesesDecision.reasons.length > 0 && <ul className="mt-2 list-disc space-y-1 ps-5 text-xs leading-6 text-slate-700">{map.hypothesesDecision.reasons.map(reason => <li key={reason}>{ui(reason)}</li>)}</ul>}
    </div>}

    {map.chains.map(chain => <section key={chain.objective?.id ?? 'unlinked'} aria-label={chain.objective ? name(chain.objective) : ui('أسئلة غير مربوطة بهدف')} className="rounded-2xl border border-slate-200 bg-white p-5">
      <h2 className="text-sm font-black">{chain.objective ? name(chain.objective) : ui('أسئلة غير مربوطة بهدف')}</h2>
      {chain.objective && <p dir="auto" className="mt-1 text-sm leading-7 text-slate-700">{chain.objective.statement}</p>}
      <ul className="mt-3 space-y-2">
        {linkRow(map.problem, chain.objective, chain.problemLink)}
        {chain.questions.map(step => <li key={step.question.id} className="list-none">
          <ul className="space-y-2">
            {chain.objective ? linkRow(chain.objective, step.question, step.objectiveLink) : null}
            <li className="list-none"><p dir="auto" className="px-1 text-xs leading-6 text-slate-500">{name(step.question)}: {step.question.statement}</p></li>
            {step.hypothesis && linkRow(step.question, step.hypothesis, step.hypothesisLink)}
            {linkRow(step.question, map.methodology, step.methodologyLink, 'لم يُفحص هذا الرابط لأن المنهج لم يُحفظ أو لم يُقرأ.')}
          </ul>
        </li>)}
      </ul>
    </section>)}

    {map.methodology && <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-center gap-2">{nodeButton(map.methodology)}{map.methodology.approach && <span className="text-xs font-bold text-slate-600">{ui(APPROACH_LABELS[map.methodology.approach] ?? map.methodology.approach)}</span>}</div>
      <p dir="auto" className="mt-2 text-sm leading-7 text-slate-800">{map.methodology.statement}</p>
    </div>}
  </div>;
}

/** Loads the project's consistency map (DOC-26-01). */
export default function ConsistencyMapWorkspace() {
  const { text: ui, direction } = useUiTranslation();
  const projectId = useProjectId();
  // The answer for one project and attempt; state changes only when the server answers.
  const [result, setResult] = useState<{ key: string; map: ConsistencyMap | null; message: string } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const requestKey = projectId ? `${projectId}:${attempt}` : '';

  useEffect(() => {
    if (!projectId) return;
    let active = true;
    const key = `${projectId}:${attempt}`;
    fetch(`/api/projects/${encodeURIComponent(projectId)}/consistency/map`, { cache: 'no-store' })
      .then(async response => {
        const data = await response.json() as { map?: ConsistencyMap; error?: string };
        if (!active) return;
        setResult(response.ok && data.map
          ? { key, map: data.map, message: '' }
          : { key, map: null, message: data.error || 'تعذر بناء خريطة الاتساق الآن. أعد المحاولة.' });
      })
      .catch(() => { if (active) setResult({ key, map: null, message: 'تعذر الاتصال بالخادم. حاول مرة أخرى.' }); });
    return () => { active = false; };
  }, [projectId, attempt]);

  const current = result?.key === requestKey ? result : null;
  const loading = Boolean(projectId) && !current;
  const map = current?.map ?? null;
  const message = current && !current.map ? current.message : '';

  return <div dir={direction} className="min-h-screen bg-slate-50 pb-20 text-slate-950"><SiteHeader /><main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
    <section className="rounded-3xl bg-gradient-to-l from-[#0B2551] to-[#1D5FE9] p-7 text-white sm:p-10">
      <div className="flex items-center gap-3"><Network className="h-7 w-7" aria-hidden="true" /><h1 className="text-2xl font-black sm:text-3xl">{ui('خريطة الاتساق')}</h1></div>
      <p className="mt-3 max-w-3xl text-sm leading-7 text-blue-50">{ui('تربط مشكلة بحثك بكل هدف وسؤاله وفرضيته ومنهجه، وتضع على كل رابط إشارة آلية أولية مع سببها. الإشارات مبنية على تشابه الألفاظ، فهي مواضع تستحق نظرك وليست حكمًا على بحثك؛ والقرار لك.')}</p>
    </section>

    {!projectId && <p className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm">{ui('افتح مشروعًا من')} <Link href="/dashboard" className="font-bold underline">{ui('مشاريعي البحثية')}</Link> {ui('لترى خريطة اتساقه.')}</p>}
    {loading && <p className="mt-6 text-sm text-slate-500">{ui('جارٍ بناء الخريطة…')}</p>}
    {message && <div role="alert" className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
      <p>{ui(message)}</p>
      <button type="button" onClick={() => setAttempt(value => value + 1)} className="mt-3 rounded-xl border border-red-300 px-4 py-2 font-bold">{ui('إعادة المحاولة')}</button>
    </div>}
    {map && <div className="mt-6"><ConsistencyMapView map={map} selected={selected} onSelect={setSelected} /></div>}
  </main></div>;
}
