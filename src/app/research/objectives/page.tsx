'use client';

import Link from 'next/link';
import { useState } from 'react';
import JourneyProgress from '@/components/JourneyProgress';
import SiteHeader from '@/components/SiteHeader';
import { saveJourneyStage } from '@/lib/research-journey';

type JourneySnapshot = {
  selectedTitle?: string;
  problemStatement?: string;
  researchGap?: string;
  objectives?: string[];
  nextStage?: 'title' | 'objectives' | 'questions' | null;
  updatedAt: string;
};

const JOURNEY_SNAPSHOT_KEY = 'waha_active_journey';
const EMPTY_OBJECTIVES = ['', ''];

export default function ResearchObjectivesPage() {
  const [journey, setJourney] = useState<JourneySnapshot | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      const stored = localStorage.getItem(JOURNEY_SNAPSHOT_KEY);
      return stored ? JSON.parse(stored) as JourneySnapshot : null;
    } catch {
      return null;
    }
  });
  const [objectives, setObjectives] = useState<string[]>(() => journey?.objectives?.length ? journey.objectives : EMPTY_OBJECTIVES);
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [projectId] = useState(() => typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get('projectId'));
  const canEnter = Boolean(journey?.problemStatement && journey?.researchGap);
  const validObjectives = objectives.map((objective) => objective.trim()).filter((objective) => objective.length >= 20);
  const canSave = validObjectives.length >= 2;

  const updateObjective = (index: number, value: string) => setObjectives((current) => current.map((objective, objectiveIndex) => objectiveIndex === index ? value : objective));
  const addObjective = () => setObjectives((current) => [...current, '']);
  const removeObjective = (index: number) => setObjectives((current) => current.length > 2 ? current.filter((_, objectiveIndex) => objectiveIndex !== index) : current);

  const saveObjectives = async () => {
    if (!journey || !canSave) return;
    setStatus('saving');
    const nextJourney: JourneySnapshot = { ...journey, objectives: validObjectives, nextStage: 'questions', updatedAt: new Date().toISOString() };
    localStorage.setItem(JOURNEY_SNAPSHOT_KEY, JSON.stringify(nextJourney));
    setJourney(nextJourney);

    try { if (projectId) await saveJourneyStage(projectId, 'objectives', { objectives: validObjectives }); }
    catch { setStatus('error'); return; }
    setStatus('saved');
  };

  return (
    <div dir="rtl" className="min-h-screen bg-[#0A0F1C] pb-20 text-white">
      <SiteHeader />
      <JourneyProgress current="objectives" lang="ar" />
      <main className="mx-auto mt-8 max-w-3xl space-y-6 px-4">
        {!canEnter ? <section className="rounded-2xl border border-amber-400/30 bg-amber-400/10 p-7 text-center"><h1 className="text-xl font-bold text-amber-100">الأهداف مقفلة حالياً</h1><p className="mt-3 text-sm leading-7 text-amber-100/80">اعتمد مشكلة البحث والفجوة أولاً؛ الأهداف ليست قائمة رغبات، بل ما يمكن للبحث أن ينجزه لمعالجة المشكلة.</p><Link href="/research/problem" className="mt-5 inline-flex rounded-xl bg-amber-300 px-5 py-3 text-sm font-bold text-slate-950">اذهب إلى مشكلة البحث</Link></section> : <>
          <section className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-5"><p className="text-xs font-bold text-emerald-300">بوابة المشكلة مفتوحة · المرحلة 4 من 6</p><h1 className="mt-2 text-lg font-bold">صياغة أهداف البحث</h1><p className="mt-2 text-sm leading-6 text-slate-300">اكتب هدفين محددين على الأقل. يجب أن يصف كل هدف نتيجة يمكن فحصها، لا نشاطاً عاماً.</p></section>
          <section className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-7">
            {objectives.map((objective, index) => <div key={index} className="rounded-xl border border-white/10 bg-slate-950/50 p-4"><div className="mb-2 flex items-center justify-between"><label htmlFor={`objective-${index}`} className="text-sm font-bold text-white">الهدف {index + 1}</label>{objectives.length > 2 && <button type="button" onClick={() => removeObjective(index)} className="text-xs text-rose-300 hover:text-rose-200">حذف</button>}</div><textarea id={`objective-${index}`} value={objective} onChange={(event) => updateObjective(index, event.target.value)} className="min-h-24 w-full bg-transparent text-sm leading-7 text-white outline-none placeholder:text-slate-600" placeholder="مثال: تحديد أثر ... على ... لدى ..." /></div>)}
            <button type="button" onClick={addObjective} className="w-full rounded-xl border border-dashed border-emerald-400/40 py-3 text-sm font-bold text-emerald-300 hover:bg-emerald-400/10">+ إضافة هدف</button>
            <p className="text-xs text-slate-500">المطلوب: هدفان واضحان على الأقل، لا يقل كل منهما عن 20 حرفاً.</p>
            {status === 'error' && <p className="text-sm text-rose-300">حُفظت الأهداف محلياً، لكن تعذر حفظها داخل المشروع.</p>}
            <button type="button" disabled={!canSave || status === 'saving'} onClick={saveObjectives} className="w-full rounded-xl bg-gradient-to-l from-emerald-400 to-teal-300 py-3.5 text-sm font-bold text-slate-950 transition disabled:cursor-not-allowed disabled:opacity-40">{status === 'saving' ? 'جارٍ حفظ الأهداف…' : 'اعتماد الأهداف وفتح الأسئلة'}</button>
            {status === 'saved' && <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-4 text-sm text-emerald-100">تم اعتماد الأهداف. <Link href={`/research/questions${projectId ? `?projectId=${projectId}` : ''}`} className="mt-2 inline-flex font-bold text-emerald-300 hover:text-emerald-200">انتقل إلى أسئلة البحث ←</Link></div>}
          </section>
        </>}
      </main>
    </div>
  );
}
