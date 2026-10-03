'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import SiteHeader from '@/components/SiteHeader';
import JourneyProgress from '@/components/JourneyProgress';
import ClaimSupportBoard from '@/components/research-intelligence/ClaimSupportBoard';
import EvidenceCard from '@/components/research-intelligence/EvidenceCard';
import EvidenceForm from '@/components/research-intelligence/EvidenceForm';
import GapAssessmentCard from '@/components/research-intelligence/GapAssessmentCard';
import IntelligenceNav, { INTELLIGENCE_SECTIONS, type IntelligenceSection } from '@/components/research-intelligence/IntelligenceNav';
import SearchScopePanel from '@/components/research-intelligence/SearchScopePanel';
import StatusBadge from '@/components/research-intelligence/StatusBadge';
import type { ClaimRecord, EvidenceRecord, GapRecord, LibrarySource, SearchRunRecord } from '@/components/research-intelligence/types';
import {
  CLAIM_STATUS_LABELS, CLAIM_TYPE_LABELS, claimCreateBody, evidenceUpdateBody, gapAssessBody, gapDecisionBody,
  RELATION_LABELS, RELATIONS, RESEARCHER_EVIDENCE_ACTIONS, supportCreateBody, type ClaimTypeValue, type RelationValue,
} from '@/lib/research-intelligence-ui';
import { useProjectId } from '@/lib/use-project-id';

// Research Intelligence workspace: المصادر ← الأدلة ← الادعاءات ← الدعم والتعارض
// ← تقييم الفجوة ← قرار الباحث. Every write goes through the project APIs; the
// server sets states, origins, canonical works, classifications and scope.

type Data = { sources: LibrarySource[]; evidence: EvidenceRecord[]; claims: ClaimRecord[]; runs: SearchRunRecord[]; gaps: GapRecord[] };
const EMPTY: Data = { sources: [], evidence: [], claims: [], runs: [], gaps: [] };

async function call(url: string, init?: RequestInit) {
  const response = await fetch(url, { cache: 'no-store', ...init, headers: init?.body ? { 'Content-Type': 'application/json' } : undefined });
  const data = await response.json().catch(() => ({})) as Record<string, unknown>;
  return { ok: response.ok, status: response.status, data };
}

function initialSection(): IntelligenceSection {
  if (typeof window === 'undefined') return 'evidence';
  const requested = new URLSearchParams(window.location.search).get('section');
  return INTELLIGENCE_SECTIONS.some((section) => section.id === requested) ? requested as IntelligenceSection : 'evidence';
}

export default function ResearchIntelligencePage() {
  const projectId = useProjectId();
  const [section, setSection] = useState<IntelligenceSection>('evidence');
  const [data, setData] = useState<Data>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [showEvidenceForm, setShowEvidenceForm] = useState(false);
  const [editing, setEditing] = useState<{ id: string; content: string } | null>(null);
  const [claimDraft, setClaimDraft] = useState<{ statement: string; claimType: ClaimTypeValue }>({ statement: '', claimType: 'gap' });
  const [linkDraft, setLinkDraft] = useState<{ claimId: string; evidenceItemId: string; relation: RelationValue; rationale: string }>({ claimId: '', evidenceItemId: '', relation: 'supports', rationale: '' });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // Read the requested section after hydration, as useProjectId does.
    const timer = window.setTimeout(() => setSection(initialSection()), 0);
    return () => window.clearTimeout(timer);
  }, []);

  const base = projectId ? `/api/projects/${encodeURIComponent(projectId)}` : '';
  const load = useCallback(async () => {
    if (!projectId) return;
    setError('');
    const [library, evidence, claims, runs, gaps] = await Promise.all([
      call(`/api/research/library?projectId=${encodeURIComponent(projectId)}`), call(`${base}/evidence`), call(`${base}/claims`), call(`${base}/search-runs`), call(`${base}/gaps`),
    ]);
    if (!evidence.ok || !claims.ok) { setError(evidence.status === 404 || claims.status === 404 ? 'المشروع غير موجود أو لا تملك صلاحية عليه.' : 'تعذر تحميل بيانات تحليل الأدلة.'); setLoading(false); return; }
    setData({
      sources: (library.data.items as LibrarySource[]) || [],
      evidence: (evidence.data.items as EvidenceRecord[]) || [],
      claims: (claims.data.claims as ClaimRecord[]) || [],
      runs: runs.ok ? (runs.data.runs as SearchRunRecord[]) || [] : [],
      gaps: gaps.ok ? (gaps.data.assessments as GapRecord[]) || [] : [],
    });
    setLoading(false);
  }, [projectId, base]);

  useEffect(() => {
    if (!projectId) return;
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [projectId, load]);

  const sourceById = useMemo(() => new Map(data.sources.map((source) => [source.id, source])), [data.sources]);
  const evidenceById = useMemo(() => new Map(data.evidence.map((item) => [item.id, item])), [data.evidence]);
  const gapClaims = data.claims.filter((claim) => claim.claim_type === 'gap');

  const run = async (action: () => Promise<{ ok: boolean; status: number; data: Record<string, unknown> }>, conflictMessage?: string) => {
    setBusy(true); setNotice('');
    try {
      const result = await action();
      if (!result.ok) setNotice(result.status === 409 && conflictMessage ? conflictMessage : String(result.data.error || 'تعذر تنفيذ الإجراء.'));
      await load();
      return result.ok;
    } finally { setBusy(false); }
  };

  const select = (next: IntelligenceSection) => {
    setSection(next);
    if (typeof window !== 'undefined') window.history.replaceState(null, '', `?projectId=${encodeURIComponent(projectId)}&section=${next}`);
  };

  return <div dir="rtl" className="min-h-screen bg-[#F8FAFC] pb-20 text-slate-950"><SiteHeader /><JourneyProgress current="analysis" lang="ar" />
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6">
      <header>
        <p className="text-xs font-bold text-blue-700">تحليل الأدلة والفجوات</p>
        <h1 className="mt-1 text-2xl font-black leading-10 sm:text-3xl">من المصادر إلى فجوة مدعومة بالأدلة</h1>
        <p className="mt-2 text-sm leading-7 text-slate-600">سجّل الأدلة من مصادرك، واكتب الادعاءات التي تريد فحصها، واربط كل دليل بالادعاء: يدعمه أو يعارضه أو يوفر سياقاً. تقيّم الواحة الفجوة ضمن نطاق البحث المسجل فقط، والقرار النهائي لك.</p>
      </header>
      {!projectId ? <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center"><h2 className="font-black text-amber-950">افتح هذه الصفحة من مشروع محفوظ</h2><Link href="/dashboard" className="mt-4 inline-flex rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white">الذهاب إلى مشاريعي</Link></section>
        : loading ? <section className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">جارٍ التحميل…</section>
        : error ? <section role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800">{error}</section>
        : <>
          <IntelligenceNav projectId={projectId} current={section} onSelect={select} />
          {notice && <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{notice}</p>}

          {section === 'evidence' && <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-black">الأدلة ({data.evidence.length})</h2>
              {!showEvidenceForm && <button type="button" onClick={() => setShowEvidenceForm(true)} className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white">تسجيل دليل</button>}</div>
            {showEvidenceForm && <EvidenceForm projectId={projectId} sources={data.sources} onCreated={() => { setShowEvidenceForm(false); void load(); }} onCancel={() => setShowEvidenceForm(false)} />}
            {data.evidence.length === 0 ? <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-sm leading-7 text-slate-600">ابدأ بتحويل أحد المصادر المحفوظة إلى دليل مرتبط بسؤالك البحثي. من <Link href={`/research/library?projectId=${encodeURIComponent(projectId)}`} className="font-bold text-blue-700 underline">مكتبة المشروع</Link> اختر «استخدام كدليل».</p>
              : <div className="grid gap-4 md:grid-cols-2">{data.evidence.map((item) => <EvidenceCard key={item.id} evidence={item} source={item.project_reference_id ? sourceById.get(item.project_reference_id) : undefined} actions={
                editing?.id === item.id
                  ? <div className="w-full space-y-2"><textarea value={editing.content} onChange={(event) => setEditing({ id: item.id, content: event.target.value })} rows={3} maxLength={4000} className="w-full rounded-xl border border-slate-300 p-2 text-sm leading-7" /><p className="text-[11px] text-slate-500">تعديل النص يعيد الدليل إلى «يحتاج مراجعة» إن كنت قد أكدته أو رفضته.</p><div className="flex gap-2"><button type="button" disabled={busy} onClick={() => void run(() => call(`${base}/evidence`, { method: 'PATCH', body: JSON.stringify(evidenceUpdateBody(item.id, { content: editing.content })) })).then((ok) => ok && setEditing(null))} className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white">حفظ</button><button type="button" onClick={() => setEditing(null)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-bold">إلغاء</button></div></div>
                  : <div className="flex flex-wrap gap-1.5">
                    {RESEARCHER_EVIDENCE_ACTIONS.filter((action) => action.state !== item.state && (!action.requiresSource || item.project_reference_id)).map((action) => <button key={action.state} type="button" disabled={busy} onClick={() => void run(() => call(`${base}/evidence`, { method: 'PATCH', body: JSON.stringify(evidenceUpdateBody(item.id, { state: action.state })) }))} className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-[11px] font-bold text-slate-700 hover:bg-slate-50">{action.label}</button>)}
                    <button type="button" onClick={() => setEditing({ id: item.id, content: item.content })} className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-[11px] font-bold text-slate-700">تعديل</button>
                    <button type="button" disabled={busy} onClick={() => void run(() => call(`${base}/evidence?evidenceId=${encodeURIComponent(item.id)}`, { method: 'DELETE' }), 'هذا الدليل مرتبط بادعاء. احذف الربط أولاً من قسم الادعاءات.')} className="rounded-lg border border-rose-200 px-2.5 py-1.5 text-[11px] font-bold text-rose-700">حذف</button>
                  </div>
              } />)}</div>}
          </section>}

          {section === 'claims' && <section className="space-y-5">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="text-lg font-black">ادعاء بحثي جديد</h2>
              <p className="mt-1 text-xs leading-6 text-slate-500">الادعاء عبارة تريد فحصها في ضوء الأدلة، وليس استنتاجاً نهائياً. لتقييم فجوة، اختر النوع «فجوة بحثية».</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]">
                <textarea value={claimDraft.statement} onChange={(event) => setClaimDraft({ ...claimDraft, statement: event.target.value })} rows={2} maxLength={2000} className="rounded-xl border border-slate-300 p-3 text-sm leading-7" placeholder="مثال: قلة الدراسات التي تتناول استخدام الذكاء الاصطناعي لدى طلبة الدراسات العليا في الجامعات العربية." />
                <select value={claimDraft.claimType} onChange={(event) => setClaimDraft({ ...claimDraft, claimType: event.target.value as ClaimTypeValue })} className="rounded-xl border border-slate-300 bg-white p-2.5 text-sm">{Object.entries(CLAIM_TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
              </div>
              <button type="button" disabled={busy || !claimDraft.statement.trim()} onClick={() => void run(() => call(`${base}/claims`, { method: 'POST', body: JSON.stringify(claimCreateBody(claimDraft)) })).then((ok) => ok && setClaimDraft({ statement: '', claimType: claimDraft.claimType }))} className="mt-3 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">إضافة الادعاء</button>
            </div>
            {data.claims.length === 0 ? <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-sm leading-7 text-slate-600">أنشئ ادعاءً بحثياً تريد فحصه في ضوء الأدلة.</p>
              : data.claims.map((claim) => <article key={claim.id} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-center gap-1.5"><StatusBadge label={CLAIM_TYPE_LABELS[claim.claim_type as ClaimTypeValue] || claim.claim_type} tone="info" /><StatusBadge label={CLAIM_STATUS_LABELS[claim.status] || claim.status} tone={claim.status === 'active' ? 'neutral' : 'caution'} />{claim.origin === 'system' && <StatusBadge label="مقترح آلياً" tone="caution" />}</div>
                <p className="break-words text-base font-bold leading-8 [overflow-wrap:anywhere]">{claim.statement}</p>
                <ClaimSupportBoard claim={claim} evidenceById={evidenceById} renderLinkActions={(supportId, confirmation) => <>
                  {confirmation === 'suggested' && <><button type="button" disabled={busy} onClick={() => void run(() => call(`${base}/claims/supports`, { method: 'PATCH', body: JSON.stringify({ supportId, decision: 'confirm' }) }))} className="rounded-md border border-emerald-300 px-2 py-0.5 text-[11px] font-bold text-emerald-800">تأكيد</button><button type="button" disabled={busy} onClick={() => void run(() => call(`${base}/claims/supports`, { method: 'PATCH', body: JSON.stringify({ supportId, decision: 'reject' }) }))} className="rounded-md border border-rose-300 px-2 py-0.5 text-[11px] font-bold text-rose-700">رفض</button></>}
                  <button type="button" disabled={busy} onClick={() => void run(() => call(`${base}/claims/supports?supportId=${encodeURIComponent(supportId)}`, { method: 'DELETE' }))} className="rounded-md border border-slate-300 px-2 py-0.5 text-[11px] font-bold text-slate-600">إزالة الربط</button>
                </>} />
                {data.evidence.length > 0 && <div className="grid gap-2 rounded-xl bg-slate-50 p-3 sm:grid-cols-[1fr_auto_auto]">
                  <select aria-label="الدليل" value={linkDraft.claimId === claim.id ? linkDraft.evidenceItemId : ''} onChange={(event) => setLinkDraft({ ...linkDraft, claimId: claim.id, evidenceItemId: event.target.value })} className="rounded-lg border border-slate-300 bg-white p-2 text-sm"><option value="">اختر دليلاً لربطه…</option>{data.evidence.filter((item) => !claim.supports.some((support) => support.evidence_item_id === item.id)).map((item) => <option key={item.id} value={item.id}>{item.content.slice(0, 90)}</option>)}</select>
                  <select aria-label="نوع العلاقة" value={linkDraft.claimId === claim.id ? linkDraft.relation : 'supports'} onChange={(event) => setLinkDraft({ ...linkDraft, claimId: claim.id, relation: event.target.value as RelationValue })} className="rounded-lg border border-slate-300 bg-white p-2 text-sm">{RELATIONS.map((relation) => <option key={relation} value={relation}>{RELATION_LABELS[relation].label}</option>)}</select>
                  <button type="button" disabled={busy || linkDraft.claimId !== claim.id || !linkDraft.evidenceItemId} onClick={() => void run(() => call(`${base}/claims/supports`, { method: 'POST', body: JSON.stringify(supportCreateBody(linkDraft)) }), 'هذا الدليل مرتبط بالادعاء مسبقاً. أزل الربط الحالي لتسجيل علاقة مختلفة.').then((ok) => ok && setLinkDraft({ claimId: '', evidenceItemId: '', relation: 'supports', rationale: '' }))} className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-bold text-white disabled:opacity-50">ربط</button>
                  {linkDraft.claimId === claim.id && <input value={linkDraft.rationale} onChange={(event) => setLinkDraft({ ...linkDraft, rationale: event.target.value })} maxLength={2000} placeholder="مبرر العلاقة (اختياري)" className="rounded-lg border border-slate-300 bg-white p-2 text-sm sm:col-span-3" />}
                </div>}
                <div className="flex flex-wrap gap-2 text-xs">
                  {claim.status !== 'active' && <button type="button" disabled={busy} onClick={() => void run(() => call(`${base}/claims`, { method: 'PATCH', body: JSON.stringify({ claimId: claim.id, status: 'active' }) }))} className="rounded-lg border border-slate-300 px-3 py-1.5 font-bold">تفعيل للفحص</button>}
                  {claim.status === 'active' && <button type="button" disabled={busy} onClick={() => void run(() => call(`${base}/claims`, { method: 'PATCH', body: JSON.stringify({ claimId: claim.id, status: 'retired' }) }))} className="rounded-lg border border-slate-300 px-3 py-1.5 font-bold">استبعاد</button>}
                  <button type="button" disabled={busy} onClick={() => void run(() => call(`${base}/claims?claimId=${encodeURIComponent(claim.id)}`, { method: 'DELETE' }))} className="rounded-lg border border-rose-200 px-3 py-1.5 font-bold text-rose-700">حذف الادعاء</button>
                </div>
              </article>)}
          </section>}

          {section === 'scope' && <SearchScopePanel runs={data.runs} />}

          {section === 'gaps' && <section className="space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="text-lg font-black">تقييم الفجوات</h2>
              <p className="mt-1 text-xs leading-6 text-slate-600">تقيّم الواحة ادعاء الفجوة من الأدلة التي أكدت علاقتها به ومن نطاق البحث المسجل. التصنيفات: إشارة بحثية، تحتاج أدلة إضافية، فجوة محتملة، فجوة مدعومة بالأدلة ضمن نطاق البحث المسجل.</p>
              {gapClaims.length === 0 ? <p className="mt-3 text-sm leading-7 text-slate-600">لا توجد ادعاءات من نوع «فجوة بحثية». أنشئ واحداً في قسم الادعاءات واربطه بالأدلة أولاً.</p>
                : <ul className="mt-3 space-y-2">{gapClaims.map((claim) => <li key={claim.id} className="flex flex-col gap-2 rounded-xl border border-slate-200 p-3 sm:flex-row sm:items-center sm:justify-between">
                  <span className="break-words text-sm leading-7 [overflow-wrap:anywhere]">{claim.statement}</span>
                  <button type="button" disabled={busy || claim.status !== 'active'} onClick={() => void run(() => call(`${base}/gaps`, { method: 'POST', body: JSON.stringify(gapAssessBody(claim.id)) }), 'فعّل الادعاء أولاً.')} className="shrink-0 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{claim.status === 'active' ? 'تقييم الآن' : 'فعّل الادعاء أولاً'}</button>
                </li>)}</ul>}
            </div>
            {data.gaps.length === 0 ? <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-sm leading-7 text-slate-600">لا توجد تقييمات بعد. التقييم يحتاج أدلة مرتبطة بالادعاء ونطاق بحث مسجلاً؛ ومن دونهما يبقى في حدود «إشارة بحثية» أو «فجوة محتملة».</p>
              : data.gaps.map((assessment) => <div key={assessment.id} className="space-y-2">
                <p className="text-xs font-bold text-slate-500">الادعاء: {data.claims.find((claim) => claim.id === assessment.claim_id)?.statement || 'ادعاء محذوف'}</p>
                <GapAssessmentCard assessment={assessment} evidenceById={evidenceById} decisionActions={<>
                  <button type="button" disabled={busy || assessment.researcher_confirmation === 'accepted'} onClick={() => void run(() => call(`${base}/gaps`, { method: 'PATCH', body: JSON.stringify(gapDecisionBody(assessment.id, 'accept')) }))} className="rounded-xl border border-emerald-300 px-4 py-2 text-sm font-bold text-emerald-800 disabled:opacity-50">أقبل هذا التقييم لمشروعي</button>
                  <button type="button" disabled={busy || assessment.researcher_confirmation === 'rejected'} onClick={() => void run(() => call(`${base}/gaps`, { method: 'PATCH', body: JSON.stringify(gapDecisionBody(assessment.id, 'reject')) }))} className="rounded-xl border border-rose-300 px-4 py-2 text-sm font-bold text-rose-700 disabled:opacity-50">أرفضه</button>
                </>} />
              </div>)}
          </section>}
        </>}
    </main></div>;
}
