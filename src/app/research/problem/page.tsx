'use client';

import Link from 'next/link';
import { useState } from 'react';
import JourneyProgress from '@/components/JourneyProgress';
import SiteHeader from '@/components/SiteHeader';
import { saveJourneyStage } from '@/lib/research-journey';

type JourneySnapshot = {
  topic: string;
  selectedTitle?: string;
  problemStatement?: string;
  researchGap?: string;
  nextStage?: 'title' | 'objectives' | null;
  updatedAt: string;
};

const JOURNEY_SNAPSHOT_KEY = 'waha_active_journey';

export default function ResearchProblemPage() {
  const [journey, setJourney] = useState<JourneySnapshot | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      const stored = localStorage.getItem(JOURNEY_SNAPSHOT_KEY);
      return stored ? JSON.parse(stored) as JourneySnapshot : null;
    } catch {
      return null;
    }
  });
  const [statement, setStatement] = useState(() => journey?.problemStatement || '');
  const [gap, setGap] = useState(() => journey?.researchGap || '');
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [projectId] = useState(() => typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get('projectId'));

  const canEnter = Boolean(journey?.selectedTitle);
  const canSave = statement.trim().length >= 30 && gap.trim().length >= 15;

  const saveProblem = async () => {
    if (!journey || !canSave) return;
    setStatus('saving');
    const nextJourney: JourneySnapshot = { ...journey, problemStatement: statement.trim(), researchGap: gap.trim(), nextStage: 'objectives', updatedAt: new Date().toISOString() };
    localStorage.setItem(JOURNEY_SNAPSHOT_KEY, JSON.stringify(nextJourney));
    setJourney(nextJourney);

    try { if (projectId) await saveJourneyStage(projectId, 'problem', { problemStatement: nextJourney.problemStatement || '', researchGap: nextJourney.researchGap || '' }); }
    catch { setStatus('error'); return; }
    setStatus('saved');
  };

  return (
    <div dir="rtl" className="min-h-screen bg-[#0A0F1C] pb-20 text-white">
      <SiteHeader />
      <JourneyProgress current="problem" lang="ar" />
      <main className="mx-auto mt-8 max-w-3xl space-y-6 px-4">
        {!canEnter ? (
          <section className="rounded-2xl border border-amber-400/30 bg-amber-400/10 p-7 text-center">
            <h1 className="text-xl font-bold text-amber-100">مشكلة البحث مقفلة حالياً</h1>
            <p className="mt-3 text-sm leading-7 text-amber-100/80">اعتمد عنواناً بحثياً أولاً؛ فلا يمكن صياغة مشكلة دقيقة قبل تثبيت ما الذي يدرسه البحث.</p>
            <Link href="/research" className="mt-5 inline-flex rounded-xl bg-amber-300 px-5 py-3 text-sm font-bold text-slate-950">اذهب إلى صياغة العنوان</Link>
          </section>
        ) : (
          <>
            <section className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-5">
              <p className="text-xs font-bold text-emerald-300">بوابة العنوان مفتوحة · المرحلة 3 من 6</p>
              <h1 className="mt-2 text-lg font-bold text-white">صياغة مشكلة البحث</h1>
              <p className="mt-2 text-sm leading-6 text-slate-300">العنوان المعتمد: <span className="font-semibold text-white">{journey?.selectedTitle}</span></p>
            </section>
            <section className="space-y-5 rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-7">
              <div>
                <label htmlFor="problem-statement" className="text-sm font-bold text-white">ما المشكلة الواقعية أو المعرفية التي يعالجها البحث؟</label>
                <p className="mt-1 text-xs leading-5 text-slate-400">صف الواقع الحالي، من المتأثر، ولماذا لا تكفي المعرفة أو الممارسة المتاحة.</p>
                <textarea id="problem-statement" value={statement} onChange={(event) => setStatement(event.target.value)} className="mt-3 min-h-36 w-full rounded-xl border border-white/10 bg-slate-950/60 p-4 text-sm leading-7 text-white outline-none transition focus:border-emerald-400/60" placeholder="مثال: رغم انتشار ... ما زالت المؤسسات/الطلبة يواجهون ..." />
              </div>
              <div>
                <label htmlFor="research-gap" className="text-sm font-bold text-white">ما الفجوة التي سيعالجها البحث تحديداً؟</label>
                <p className="mt-1 text-xs leading-5 text-slate-400">اربطها بما أظهره فحص الفكرة، ولا تكتب ادعاءً بلا دليل.</p>
                <textarea id="research-gap" value={gap} onChange={(event) => setGap(event.target.value)} className="mt-3 min-h-28 w-full rounded-xl border border-white/10 bg-slate-950/60 p-4 text-sm leading-7 text-white outline-none transition focus:border-emerald-400/60" placeholder="مثال: ندرة الدراسات التي تناولت ... لدى ... في سياق ..." />
              </div>
              {status === 'error' && <p className="text-sm text-rose-300">حُفظت المسودة محلياً، لكن تعذر حفظها داخل المشروع.</p>}
              <button type="button" disabled={!canSave || status === 'saving'} onClick={saveProblem} className="w-full rounded-xl bg-gradient-to-l from-emerald-400 to-teal-300 py-3.5 text-sm font-bold text-slate-950 transition hover:from-emerald-300 hover:to-teal-200 disabled:cursor-not-allowed disabled:opacity-40">
                {status === 'saving' ? 'جارٍ حفظ المشكلة…' : 'اعتماد المشكلة وفتح الأهداف'}
              </button>
              {status === 'saved' && <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-4 text-sm text-emerald-100">تم اعتماد المشكلة والفجوة وحفظهما في سياق الرحلة. <Link href={`/research/objectives${projectId ? `?projectId=${projectId}` : ''}`} className="mt-2 inline-flex font-bold text-emerald-300 hover:text-emerald-200">انتقل إلى صياغة الأهداف ←</Link></div>}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
