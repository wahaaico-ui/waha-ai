'use client';

import Link from 'next/link';
import { useState } from 'react';
import JourneyProgress from '@/components/JourneyProgress';
import SiteHeader from '@/components/SiteHeader';
import { supabase } from '@/lib/supabase/client';

type Methodology = { approach: string; population: string; sample: string; instrument: string };
type JourneySnapshot = { questions?: string[]; methodology?: Methodology; nextStage?: 'methodology' | 'literature' | null; updatedAt: string };
const JOURNEY_SNAPSHOT_KEY = 'waha_active_journey';
const EMPTY_METHOD: Methodology = { approach: '', population: '', sample: '', instrument: '' };

export default function ResearchMethodologyPage() {
  const [journey, setJourney] = useState<JourneySnapshot | null>(() => { if (typeof window === 'undefined') return null; try { const saved = localStorage.getItem(JOURNEY_SNAPSHOT_KEY); return saved ? JSON.parse(saved) as JourneySnapshot : null; } catch { return null; } });
  const [methodology, setMethodology] = useState<Methodology>(() => journey?.methodology || EMPTY_METHOD);
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [projectId] = useState(() => typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get('projectId'));
  const canEnter = (journey?.questions?.length || 0) >= 2;
  const canSave = methodology.approach && methodology.population.trim().length >= 10 && methodology.sample.trim().length >= 10 && methodology.instrument.trim().length >= 10;
  const update = (field: keyof Methodology, value: string) => setMethodology((current) => ({ ...current, [field]: value }));
  const saveMethodology = async () => {
    if (!journey || !canSave) return;
    setStatus('saving');
    const nextJourney: JourneySnapshot = { ...journey, methodology, nextStage: 'literature', updatedAt: new Date().toISOString() };
    localStorage.setItem(JOURNEY_SNAPSHOT_KEY, JSON.stringify(nextJourney)); setJourney(nextJourney);
    const { data: { user } } = await supabase.auth.getUser();
    if (user && projectId) { const { error } = await supabase.from('documents').insert({ project_id: projectId, type: 'research_methodology', content: JSON.stringify(methodology), version: 1 }); if (error) { setStatus('error'); return; } await supabase.from('projects').update({ status: 'methodology_defined' }).eq('id', projectId); }
    setStatus('saved');
  };
  return <div dir="rtl" className="min-h-screen bg-[#0A0F1C] pb-20 text-white"><SiteHeader /><JourneyProgress current="method" lang="ar" /><main className="mx-auto mt-8 max-w-3xl space-y-6 px-4">{!canEnter ? <section className="rounded-2xl border border-amber-400/30 bg-amber-400/10 p-7 text-center"><h1 className="text-xl font-bold text-amber-100">المنهجية مقفلة حالياً</h1><p className="mt-3 text-sm leading-7 text-amber-100/80">اعتمد أسئلة البحث أولاً؛ المنهجية يجب أن تجيب عنها، لا أن تُختار بمعزل عنها.</p><Link href="/research/questions" className="mt-5 inline-flex rounded-xl bg-amber-300 px-5 py-3 text-sm font-bold text-slate-950">اذهب إلى الأسئلة</Link></section> : <><section className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-5"><p className="text-xs font-bold text-emerald-300">بوابة الأسئلة مفتوحة · المرحلة 6 من 6</p><h1 className="mt-2 text-lg font-bold">اختيار المنهجية</h1><p className="mt-2 text-sm leading-6 text-slate-300">حدد طريقة تحقق إجابات الأسئلة، ومجتمع الدراسة والعينة والأداة. لا تنفذ تحليلاً إحصائياً هنا؛ اختر التصميم المناسب فقط.</p></section><section className="space-y-5 rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-7"><div><label htmlFor="approach" className="text-sm font-bold">المنهج البحثي</label><select id="approach" value={methodology.approach} onChange={(event) => update('approach', event.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/60 p-3 text-sm outline-none focus:border-emerald-400/60"><option value="">اختر منهجاً مناسباً</option><option value="quantitative">كمي</option><option value="qualitative">نوعي</option><option value="mixed">مختلط</option><option value="descriptive">وصفي/تحليلي</option></select></div>{([['population', 'مجتمع الدراسة', 'مثال: طلبة البكالوريوس في الجامعات الفلسطينية'], ['sample', 'العينة المقترحة', 'مثال: عينة طبقية من 250 طالباً'], ['instrument', 'أداة جمع البيانات', 'مثال: استبانة محكّمة ومقابلات شبه منظمة']] as const).map(([field, label, placeholder]) => <div key={field}><label htmlFor={field} className="text-sm font-bold">{label}</label><input id={field} value={methodology[field]} onChange={(event) => update(field, event.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/60 p-3 text-sm outline-none focus:border-emerald-400/60" placeholder={placeholder} /></div>)}{status === 'error' && <p className="text-sm text-rose-300">حُفظت المنهجية محلياً، لكن تعذر حفظها داخل المشروع.</p>}<button type="button" disabled={!canSave || status === 'saving'} onClick={saveMethodology} className="w-full rounded-xl bg-gradient-to-l from-emerald-400 to-teal-300 py-3.5 text-sm font-bold text-slate-950 disabled:cursor-not-allowed disabled:opacity-40">{status === 'saving' ? 'جارٍ حفظ المنهجية…' : 'اعتماد المنهجية وفتح الأدبيات'}</button>{status === 'saved' && <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-4 text-sm text-emerald-100">تم اعتماد المنهجية. الخطوة التالية ستكون مراجعة الأدبيات الموثقة المرتبطة بهذه القرارات.</div>}</section></>}</main></div>;
}
