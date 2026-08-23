'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ArrowLeft, CheckCircle2, Circle, LockKeyhole } from 'lucide-react';
import SiteHeader from '@/components/SiteHeader';
import { JOURNEY_STAGES, type ResearchJourney, nextJourneyStage, readJourney, stageIsComplete } from '@/lib/research-journey';

export default function JourneyDashboardPage() {
  const [journey] = useState<ResearchJourney | null>(() => readJourney());

  const nextStage = nextJourneyStage(journey);
  const next = JOURNEY_STAGES.find((stage) => stage.id === nextStage)!;
  const completeCount = JOURNEY_STAGES.filter((stage) => stageIsComplete(journey, stage.id)).length;

  return (
    <div dir="rtl" className="min-h-screen bg-slate-50 text-slate-900">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <section className="rounded-3xl bg-gradient-to-l from-[#0b1f3a] to-[#102e59] p-7 text-white shadow-xl shadow-blue-950/15 sm:p-10">
          <p className="text-xs font-bold tracking-[0.16em] text-cyan-200">لوحة رحلة الباحث</p>
          <div className="mt-3 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
            <div>
              <h1 className="text-2xl font-bold sm:text-3xl">{journey?.selectedTitle || journey?.topic || 'ابدأ مشروعك البحثي'}</h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-blue-100">هذه اللوحة توضح أين وصلت، ما الذي اعتمدته، وما الذي يلزم لفتح الخطوة التالية.</p>
            </div>
            <div className="rounded-2xl border border-white/15 bg-white/10 px-5 py-3 text-center"><div className="text-2xl font-bold">{completeCount}/8</div><div className="mt-1 text-xs text-blue-100">مراحل مكتملة</div></div>
          </div>
        </section>

        <section className="mt-6 rounded-2xl border border-blue-100 bg-white p-5 shadow-sm sm:flex sm:items-center sm:justify-between">
          <div><p className="text-xs font-bold text-blue-700">الخطوة التالية</p><h2 className="mt-1 text-lg font-bold">{next.title}</h2></div>
          <Link href={next.href} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-blue-700 sm:mt-0">تابع الرحلة <ArrowLeft className="h-4 w-4" /></Link>
        </section>

        <section className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {JOURNEY_STAGES.map((stage, index) => {
            const complete = stageIsComplete(journey, stage.id);
            const active = stage.id === nextStage;
            const locked = !complete && !active;
            return <div key={stage.id} className={`rounded-2xl border p-4 ${complete ? 'border-emerald-200 bg-emerald-50' : active ? 'border-blue-300 bg-blue-50 ring-2 ring-blue-100' : 'border-slate-200 bg-white'}`}>
              <div className="flex items-center justify-between"><span className="text-xs font-bold text-slate-400">0{index + 1}</span>{complete ? <CheckCircle2 className="h-5 w-5 text-emerald-600" /> : locked ? <LockKeyhole className="h-4 w-4 text-slate-400" /> : <Circle className="h-5 w-5 text-blue-600" />}</div>
              <p className={`mt-4 text-sm font-bold ${complete ? 'text-emerald-800' : active ? 'text-blue-900' : 'text-slate-500'}`}>{stage.title}</p>
              <p className="mt-1 text-xs text-slate-500">{complete ? 'معتمدة' : active ? 'مفتوحة الآن' : 'تُفتح بالتسلسل'}</p>
            </div>;
          })}
        </section>
      </main>
    </div>
  );
}
