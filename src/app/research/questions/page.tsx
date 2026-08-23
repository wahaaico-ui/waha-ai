'use client';

import Link from 'next/link';
import { useState } from 'react';
import JourneyProgress from '@/components/JourneyProgress';
import SiteHeader from '@/components/SiteHeader';
import { supabase } from '@/lib/supabase/client';

type JourneySnapshot = { objectives?: string[]; questions?: string[]; nextStage?: 'questions' | 'methodology' | null; updatedAt: string };
const JOURNEY_SNAPSHOT_KEY = 'waha_active_journey';

export default function ResearchQuestionsPage() {
  const [journey, setJourney] = useState<JourneySnapshot | null>(() => {
    if (typeof window === 'undefined') return null;
    try { const saved = localStorage.getItem(JOURNEY_SNAPSHOT_KEY); return saved ? JSON.parse(saved) as JourneySnapshot : null; } catch { return null; }
  });
  const [questions, setQuestions] = useState<string[]>(() => journey?.questions?.length ? journey.questions : (journey?.objectives || []).map(() => ''));
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [projectId] = useState(() => typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get('projectId'));
  const objectives = journey?.objectives || [];
  const canEnter = objectives.length >= 2;
  const canSave = questions.length === objectives.length && questions.every((question) => question.trim().length >= 15);

  const saveQuestions = async () => {
    if (!journey || !canSave) return;
    setStatus('saving');
    const nextJourney: JourneySnapshot = { ...journey, questions: questions.map((question) => question.trim()), nextStage: 'methodology', updatedAt: new Date().toISOString() };
    localStorage.setItem(JOURNEY_SNAPSHOT_KEY, JSON.stringify(nextJourney));
    setJourney(nextJourney);
    const { data: { user } } = await supabase.auth.getUser();
    if (user && projectId) {
      const { error } = await supabase.from('documents').insert({ project_id: projectId, type: 'research_questions', content: JSON.stringify(nextJourney.questions), version: 1 });
      if (error) { setStatus('error'); return; }
      await supabase.from('projects').update({ status: 'questions_defined' }).eq('id', projectId);
    }
    setStatus('saved');
  };

  return <div dir="rtl" className="min-h-screen bg-[#0A0F1C] pb-20 text-white"><SiteHeader /><JourneyProgress current="questions" lang="ar" /><main className="mx-auto mt-8 max-w-3xl space-y-6 px-4">
    {!canEnter ? <section className="rounded-2xl border border-amber-400/30 bg-amber-400/10 p-7 text-center"><h1 className="text-xl font-bold text-amber-100">أسئلة البحث مقفلة حالياً</h1><p className="mt-3 text-sm leading-7 text-amber-100/80">اعتمد هدفين بحثيين واضحين على الأقل؛ كل سؤال يجب أن يخدم هدفاً محدداً.</p><Link href="/research/objectives" className="mt-5 inline-flex rounded-xl bg-amber-300 px-5 py-3 text-sm font-bold text-slate-950">اذهب إلى الأهداف</Link></section> : <>
      <section className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-5"><p className="text-xs font-bold text-emerald-300">بوابة الأهداف مفتوحة · المرحلة 5 من 6</p><h1 className="mt-2 text-lg font-bold">أسئلة البحث</h1><p className="mt-2 text-sm leading-6 text-slate-300">صغ سؤالاً واحداً قابلاً للإجابة عن كل هدف؛ لا تنتج أسئلة لا تخدم هدفاً معتمداً.</p></section>
      <section className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-7">{objectives.map((objective, index) => <div key={objective} className="rounded-xl border border-white/10 bg-slate-950/50 p-4"><p className="text-xs font-bold text-emerald-300">الهدف {index + 1}</p><p className="mt-1 text-sm leading-6 text-slate-300">{objective}</p><label htmlFor={`question-${index}`} className="mt-4 block text-sm font-bold">سؤال البحث المقابل</label><textarea id={`question-${index}`} value={questions[index] || ''} onChange={(event) => setQuestions((current) => current.map((question, questionIndex) => questionIndex === index ? event.target.value : question))} className="mt-2 min-h-24 w-full rounded-xl border border-white/10 bg-slate-900/60 p-3 text-sm leading-7 outline-none focus:border-emerald-400/60" placeholder="مثال: ما أثر ... على ... لدى ...؟" /></div>)}
        {status === 'error' && <p className="text-sm text-rose-300">حُفظت الأسئلة محلياً، لكن تعذر حفظها داخل المشروع.</p>}<button type="button" disabled={!canSave || status === 'saving'} onClick={saveQuestions} className="w-full rounded-xl bg-gradient-to-l from-emerald-400 to-teal-300 py-3.5 text-sm font-bold text-slate-950 disabled:cursor-not-allowed disabled:opacity-40">{status === 'saving' ? 'جارٍ حفظ الأسئلة…' : 'اعتماد الأسئلة وفتح المنهجية'}</button>{status === 'saved' && <Link href={`/research/methodology${projectId ? `?projectId=${projectId}` : ''}`} className="block rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-4 text-center text-sm font-bold text-emerald-200">انتقل إلى اختيار المنهجية ←</Link>}</section>
    </>}</main></div>;
}
