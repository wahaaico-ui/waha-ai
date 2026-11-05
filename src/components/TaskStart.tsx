'use client';

import { useUiTranslation } from '@/lib/use-ui-translation';
import Link from 'next/link';
import { BookSearch, FileText, Languages, MessageSquareText, Search, PenLine } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { loadJourney, saveJourneyDraft } from '@/lib/research-journey';
import { useAuthSession } from '@/components/AuthSessionProvider';
import { isResearchEntryTask, researchEntryTasks, type ResearchEntryTask } from '@/lib/research-entry-tasks';
import { saveWritingEntry, writingEntryStorageKey } from '@/lib/writing-entry';
import { isUuid } from '@/lib/research-evidence';

const tasks = researchEntryTasks;
type Task = ResearchEntryTask;
const taskIcons = { writing: PenLine, sources: Search, compare: BookSearch, language: Languages, supervisor: MessageSquareText, files: FileText };
const ENTRY_DRAFT_KEY = 'waha_task_entry_draft';

function readRequestedTask(): Task | null {
  const value = new URLSearchParams(window.location.search).get('task');
  return isResearchEntryTask(value) ? value : null;
}
function subscribeRequestedTask(notify: () => void) {
  window.addEventListener('popstate', notify);
  return () => window.removeEventListener('popstate', notify);
}

function entryDraftKey(userId?: string) {
  return userId ? `${ENTRY_DRAFT_KEY}:${encodeURIComponent(userId)}` : ENTRY_DRAFT_KEY;
}
function readEntryDraft(userId?: string) {
  try { return (userId && sessionStorage.getItem(entryDraftKey(userId))) || sessionStorage.getItem(ENTRY_DRAFT_KEY); } catch { return null; }
}
function subscribeEntryDraft(notify: () => void) {
  window.addEventListener('storage', notify);
  return () => window.removeEventListener('storage', notify);
}
const serverEntryDraft = () => null;
function parseEntryDraft(value: string | null): { task: Task; request: string; projectId?: string } | null {
  if (!value || value.length > 80000) return null;
  try {
    const draft: unknown = JSON.parse(value);
    if (draft && typeof draft === 'object' && 'task' in draft && typeof draft.task === 'string' && Object.hasOwn(tasks, draft.task) && 'request' in draft && typeof draft.request === 'string' && draft.request.length <= 12000) return { task: draft.task as Task, request: draft.request, ...('projectId' in draft && isUuid(draft.projectId) ? { projectId: draft.projectId } : {}) };
  } catch { /* Ignore an invalid browser draft. */ }
  return null;
}

export default function TaskStart() {
  const { user } = useAuthSession();
  return <TaskStartContent key={user?.id || 'guest'} />;
}

function TaskStartContent() {
  const { text: ui, direction: uiDirection } = useUiTranslation();
  const { user, isAuthenticated, authResolved } = useAuthSession();

  const readCurrentEntry = useCallback(() => readEntryDraft(user?.id), [user?.id]);
  const serializedDraft = useSyncExternalStore(subscribeEntryDraft, readCurrentEntry, serverEntryDraft);
  const requestedTask = useSyncExternalStore(subscribeRequestedTask, readRequestedTask, serverEntryDraft);
  const restoredDraft = useMemo(() => parseEntryDraft(serializedDraft), [serializedDraft]);
  const [requestOverride, setRequest] = useState<string | null>(null);
  const [taskOverride, setTask] = useState<Task | null>(null);
  const task = taskOverride ?? requestedTask ?? restoredDraft?.task ?? 'writing';
  const request = requestOverride ?? (restoredDraft?.task === task ? restoredDraft.request : '');
  const [projectOverride, setProjectId] = useState<string | null>(null);
  const projectId = projectOverride ?? (restoredDraft?.task === task ? restoredDraft.projectId || '' : '');
  const [projects, setProjects] = useState<Array<{ id: string; title: string }>>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [startedProjectId, setStartedProjectId] = useState('');
  const [recentOutput, setRecentOutput] = useState<{ text: string; href: string } | null>(null);
  const creation = useRef('');
  useEffect(() => { if (!isAuthenticated) return; let active = true; fetch('/api/projects', { cache: 'no-store' }).then(async (response) => { if (response.ok && active) setProjects((await response.json()).projects || []); }).catch(() => {}); return () => { active = false; }; }, [isAuthenticated]);
  useEffect(() => {
    let active = true; const latest = projects[0]; if (!latest) return;
    loadJourney(latest.id).then(async (journey) => {
      const draft = journey.drafts.analysis?.content;
      if (typeof draft?.thematicSynthesis === 'string') { if (active) setRecentOutput({ text: draft.thematicSynthesis, href: `/research/tasks?projectId=${encodeURIComponent(latest.id)}` }); return; }
      const response = await fetch(`/api/academic/language-tools?projectId=${encodeURIComponent(latest.id)}`, { cache: 'no-store' });
      if (!response.ok) return; const data = await response.json(); const task = data.tasks?.find((item: { status: string }) => item.status === 'completed');
      if (active && task) setRecentOutput({ text: task.output, href: `/research/tasks?projectId=${encodeURIComponent(latest.id)}&task=language` });
    }).catch(() => {}); return () => { active = false; };
  }, [projects]);
  const start = async () => {
    const minimum = task === 'language' || task === 'supervisor' ? 20 : task === 'files' || task === 'writing' ? 0 : 5;
    if (request.trim().length < minimum) { setError(ui(minimum <= 10 ? "أدخل {0} أحرف على الأقل." : "أدخل {0} حرفًا على الأقل.", [minimum])); return; }
    if (!authResolved) return;
    if (!isAuthenticated) {
      try { sessionStorage.setItem(ENTRY_DRAFT_KEY, JSON.stringify({ task, request })); }
      catch { setError('تعذر الاحتفاظ بالنص في هذا المتصفح. انسخه قبل تسجيل الدخول.'); return; }
      // Preserve the entry draft across a full navigation into the login flow.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign('/login?redirect=%2F%23start');
      return;
    }
    setBusy(true); setError('');
    try {
      const entryKey = entryDraftKey(user?.id);
      const rememberEntry = (id: string) => {
        if (!request.trim()) return;
        try { sessionStorage.setItem(entryKey, JSON.stringify({ task, request, projectId: id })); }
        catch { throw new Error('تعذر الاحتفاظ بالنص في هذا المتصفح. انسخه قبل المتابعة.'); }
      };
      rememberEntry(projectId);
      let id = projectId;
      let languageDocumentId = '';
      if (!id) {
        creation.current ||= new URLSearchParams(window.location.search).get('draftProjectId') || crypto.randomUUID();
        const url = new URL(window.location.href); url.searchParams.set('draftProjectId', creation.current); window.history.replaceState({}, '', url);
        const response = await fetch('/api/projects', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectId: creation.current, title: request.trim().slice(0, 500) || tasks[task].label }) });
        const data = await response.json(); if (!response.ok) throw new Error(data.error || 'تعذر حفظ المشروع.'); id = data.project.id;
      }
      setStartedProjectId(id);
      rememberEntry(id);
      if (task === 'writing' && request.trim()) {
        if (!user) throw new Error('سجّل الدخول لحفظ المشروع.');
        const key = writingEntryStorageKey(user.id, id);
        await saveWritingEntry({ projectId: id, userId: user.id, requestText: request, storage: { read: () => sessionStorage.getItem(key), write: value => sessionStorage.setItem(key, value), clear: () => sessionStorage.removeItem(key) } });
      } else if (task === 'language') {
        const response = await fetch('/api/academic/language-tools', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectId: id, operation: 'proofread', text: request.trim(), targetLanguage: /[\u0600-\u06ff]/.test(request) ? 'ar' : 'en', saveOnly: true }) });
        const data = await response.json(); if (!response.ok) throw new Error(data.error || 'تعذر حفظ المدخل.');
        languageDocumentId = data.documentId || '';
      } else if (task === 'supervisor') {
        const response = await fetch(`/api/projects/${encodeURIComponent(id)}/supervisor-review`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ originalText: request.trim(), revisedText: request.trim(), notes: [] }) });
        const data = await response.json(); if (!response.ok) throw new Error(data.error || 'تعذر حفظ النص.');
      } else if (task === 'sources' || task === 'compare') {
        const journey = await loadJourney(id);
        const saved = await saveJourneyDraft(id, 'literature', { ...journey.drafts.literature?.content, request: request.trim(), query: request.trim().slice(0, 500) });
        if (!saved.success) throw new Error("توجد مسودة أحدث؛ أعد المحاولة بعد الاسترجاع.");
      }
      const path = task === 'files' ? '/projects/workspace' : '/research/tasks';
      try { sessionStorage.removeItem(entryKey); sessionStorage.removeItem(ENTRY_DRAFT_KEY); } catch { /* Storage may be unavailable. */ }
      // Rehydrate the saved project on its own page after a successful write.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign(`${path}?projectId=${encodeURIComponent(id)}&task=${task}${languageDocumentId ? `&documentId=${encodeURIComponent(languageDocumentId)}` : ''}`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'تعذر بدء المهمة؛ مشروعك المحفوظ لا يُحذف.'); }
    finally { setBusy(false); }
  };
  const selected = tasks[task];
  return <section id="start" dir={uiDirection} aria-labelledby="task-start-heading" className="scroll-mt-24 rounded-3xl border border-line bg-white p-4 shadow-[0_16px_48px_rgba(30,94,255,.06)] sm:p-7">
    <h2 id="task-start-heading" className="text-xl font-black text-ink">{ui("ماذا تريد إنجازه؟")}</h2>
    <fieldset className="mt-4"><legend className="sr-only">{ui("اختر المهمة")}</legend><div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{Object.entries(tasks).map(([key, option]) => { const Icon = taskIcons[key as Task]; return <button key={key} type="button" disabled={busy} aria-pressed={task === key} onClick={() => { setTask(key as Task); setError(''); }} className={`flex min-h-12 items-center gap-2 rounded-xl border px-3 py-2.5 text-start text-xs font-bold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:text-sm ${task === key ? 'border-primary bg-primary-tint text-primary-dark' : 'border-line bg-white text-slate-700 hover:border-primary/40'}`}><Icon aria-hidden="true" className="h-4 w-4 shrink-0" />{ui(option.label)}</button>; })}</div></fieldset>
    <p aria-live="polite" className="mt-4 min-h-12 text-sm leading-6 text-slate-600">{ui(selected.description)}</p>
    <label htmlFor="task-request" className="mt-4 block text-sm font-bold text-ink">{ui(selected.input)}</label><textarea dir="auto" id="task-request" disabled={busy} value={request} onChange={(event) => { setRequest(event.target.value); setError(''); }} maxLength={12000} rows={3} className="mt-2 w-full resize-y rounded-xl border border-slate-300 bg-white p-3 text-sm leading-7 text-ink outline-none placeholder:text-slate-400 focus:border-primary focus:ring-4 focus:ring-primary/10" placeholder={ui(selected.placeholder)} />
    {isAuthenticated && projects.length > 0 && <details className="mt-4 text-sm"><summary className="cursor-pointer">{ui("استخدم مشروعًا موجودًا بدل مشروع جديد")}</summary><label htmlFor="task-project" className="mt-3 block font-bold">{ui("المشروع")}</label><select id="task-project" value={projectId} onChange={(event) => setProjectId(event.target.value)} className="mt-2 w-full rounded-xl border p-3"><option value="">{ui("مشروع مسودة جديد")}</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.title}</option>)}</select></details>}
    {task === 'files' && <p className="mt-3 text-sm">{ui("PDF نصي حتى 50 صفحة و10 MB؛ القراءة الخارجية للملف الممسوح تحتاج موافقتك. لا يُعامل نصه كمستخلص علمي.")}</p>}
    <button type="button" disabled={busy || !authResolved} onClick={() => void start()} className="mt-4 min-h-12 w-full rounded-xl bg-primary px-5 py-3 text-sm font-bold text-white transition hover:bg-primary-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-40">{busy ? ui("جارٍ حفظ المدخل…") : isAuthenticated ? ui(selected.action) : ui("تابع بتسجيل الدخول")}</button>
    {!isAuthenticated && <p className="mt-3 text-center text-xs leading-6 text-slate-500">{ui("حسابك يحفظ المراجع والنصوص والتعديلات لتعود إليها لاحقاً.")}</p>}
    <Link href="/verify-idea" className="mt-3 block text-center text-xs font-bold leading-6 text-primary-dark underline underline-offset-4 sm:hidden">{ui("لدي فكرة وأريد استكشافها")}</Link>
    {error && <div role="alert" className="mt-3 text-sm leading-7 text-rose-800"><p>{ui(error)}</p>{isAuthenticated && startedProjectId ? <Link href={`${task === 'files' ? '/projects/workspace' : '/research/tasks'}?projectId=${encodeURIComponent(startedProjectId)}&task=${task}`} className="mt-2 inline-block font-bold underline underline-offset-4">{ui('افتح المشروع المحفوظ')}</Link> : !isAuthenticated && <Link href="/login" className="underline">{ui("تسجيل الدخول")}</Link>}</div>}
    {isAuthenticated && projects.length > 0 && <details className="mt-5 border-t border-line pt-4"><summary className="cursor-pointer text-sm font-bold text-primary-dark">{ui("مشاريعك الأخيرة والمتابعة")}</summary>{recentOutput && <Link href={recentOutput.href} className="mt-3 block rounded-xl border border-emerald-200 bg-emerald-50 p-4"><span className="text-sm font-bold">{ui("مخرج محفوظ في آخر مشروع — متابعة")}</span><p className="mt-2 line-clamp-3 whitespace-pre-wrap break-words text-sm" dir="auto">{recentOutput.text}</p></Link>}<ul className="mt-3 space-y-2">{projects.slice(0, 3).map((project) => <li key={project.id}><Link href={`/research/tasks?projectId=${encodeURIComponent(project.id)}`} className="block break-words rounded-xl border border-line p-3 text-sm font-bold text-primary-dark">{project.title} {ui("← متابعة")}</Link></li>)}</ul></details>}
  </section>;
}
