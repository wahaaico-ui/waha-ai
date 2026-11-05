import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { authoriseProject, type ProjectRouteContext } from '@/lib/research-project-access';
import { createServiceClient } from '@/lib/supabase/service';
import { attachWritingSource, parseWritingDraft, quoteMatchesSource, readSavedWriting, WRITING_DOCUMENT_TYPE, type SavedWritingCitation } from '@/lib/evidence-writing';
import { readWritingRequest, readWritingSources } from '@/lib/evidence-writing-server';
import { isUuid } from '@/lib/research-evidence';

const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } });

export async function GET(_request: Request, context: ProjectRouteContext) {
  try {
    const auth = await authoriseProject(context); if (!auth.ok) { auth.response.headers.set('Cache-Control', 'private, no-store'); return auth.response; }
    const result = await auth.access.supabase.from('documents').select('id, content, created_at').eq('project_id', auth.projectId).eq('type', WRITING_DOCUMENT_TYPE).order('created_at', { ascending: false }).order('id', { ascending: false }).limit(20);
    if (result.error) throw result.error;
    const versions = [];
    for (const row of result.data || []) {
      const draft = readSavedWriting(row.content); if (!draft) throw new Error('invalid_saved_writing');
      versions.push({ ...draft, documentId: row.id, savedAt: row.created_at });
    }
    return json({ versions });
  } catch { return json({ error: 'تعذر استرجاع الكتابة المحفوظة. أعد المحاولة.' }, 503); }
}

export async function POST(request: Request, context: ProjectRouteContext) {
  try {
    const auth = await authoriseProject(context); if (!auth.ok) { auth.response.headers.set('Cache-Control', 'private, no-store'); return auth.response; }
    const body = await readWritingRequest(request);
    if (!body.ok) return json({ error: body.status === 413 ? 'قسّم المسودة إلى أجزاء أصغر قبل الحفظ.' : 'تعذر قراءة المسودة.' }, body.status);
    const draft = parseWritingDraft(body.body);
    if (!draft) return json({ error: 'راجع النص ومواضع المقاطع المرتبطة قبل الحفظ.' }, 422);
    const requestedBase = (body.body as Record<string, unknown>).baseDocumentId ?? null;
    if (requestedBase !== null && !isUuid(requestedBase)) return json({ error: 'تعذر تحديد النسخة المحفوظة.' }, 422);
    const hash = createHash('sha256').update(JSON.stringify([WRITING_DOCUMENT_TYPE, auth.projectId, requestedBase, draft])).digest('hex');
    const documentId = `${hash.slice(0, 8)}-${hash.slice(8, 12)}-5${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
    const existing = await auth.access.supabase.from('documents').select('id, content, created_at').eq('project_id', auth.projectId).eq('type', WRITING_DOCUMENT_TYPE).eq('id', documentId).maybeSingle();
    if (existing.error) throw existing.error;
    if (existing.data) {
      const restored = readSavedWriting(existing.data.content);
      if (!restored || JSON.stringify(parseWritingDraft(restored)) !== JSON.stringify(draft)) throw new Error('invalid_writing_receipt');
      const current = await auth.access.supabase.from('documents').select('id').eq('project_id', auth.projectId).eq('type', WRITING_DOCUMENT_TYPE).order('created_at', { ascending: false }).order('id', { ascending: false }).limit(1).maybeSingle();
      if (current.error) throw current.error;
      if (current.data?.id !== documentId) return json({ error: 'حُفظت نسختك وتوجد نسخة أحدث في المشروع.', code: 'version_conflict', saved: true, documentId }, 409);
      return json({ saved: true, documentId, savedAt: existing.data.created_at, draft: restored });
    }
    const latest = await auth.access.supabase.from('documents').select('id').eq('project_id', auth.projectId).eq('type', WRITING_DOCUMENT_TYPE).order('created_at', { ascending: false }).order('id', { ascending: false }).limit(1).maybeSingle();
    if (latest.error) throw latest.error;
    if ((latest.data?.id ?? null) !== requestedBase) return json({ error: 'توجد نسخة أحدث في المشروع. احتفظ بنصك وافتح النسخة المحفوظة قبل الحفظ.', code: 'version_conflict' }, 409);
    const verified = new Map<string, SavedWritingCitation>();
    // Rehydrate each source once. Titles, origin, URLs and matched positions
    // come only from project-owned data; client "verified" flags are ignored.
    for await (const batch of readWritingSources(auth.access.supabase, auth.projectId, draft.citations)) {
      for (const c of draft.citations) {
        const key = `${c.sourceKind}:${c.sourceId}`;
        if (!batch.keys.has(key)) continue;
        const source = batch.sources.get(key);
        if (!source) return json({ error: 'أحد الأدلة لم يعد موجودًا في المشروع. أزل الربط أو اختر مصدرًا آخر.', code: 'source_missing', citationId: c.id }, 404);
        if (!quoteMatchesSource(c, source)) return json({ error: 'تغير النص المتاح للمصدر أو موضع المقطع. افتح المصدر واختر المقطع مجددًا.', code: 'source_changed', citationId: c.id }, 409);
        verified.set(c.id, attachWritingSource(c, source));
      }
    }
    const citations = draft.citations.map(c => verified.get(c.id)!);
    const savedDraft = { ...draft, citations };
    const content = JSON.stringify(savedDraft);
    const result = await createServiceClient().rpc('commit_evidence_writing', { p_project_id: auth.projectId, p_user_id: auth.access.user.id, p_document_id: documentId, p_base_document_id: requestedBase, p_content: content });
    if (result.error) throw result.error;
    if (result.data?.outcome === 'missing') return json({ code: 'project_missing' }, 404);
    if (result.data?.outcome === 'conflict') return json({ code: 'version_conflict', ...(result.data.saved === true ? { saved: true, documentId } : {}) }, 409);
    if (result.data?.outcome !== 'saved' || result.data.documentId !== documentId) throw new Error('invalid_commit_receipt');
    const saved = await auth.access.supabase.from('documents').select('id, content, created_at').eq('project_id', auth.projectId).eq('type', WRITING_DOCUMENT_TYPE).eq('id', documentId).maybeSingle();
    if (saved.error || !saved.data || saved.data.content !== content) throw new Error('saved_writing_unavailable');
    return json({ saved: true, documentId, savedAt: saved.data.created_at, draft: savedDraft });
  } catch { return json({ error: 'تعذر حفظ الكتابة الآن. احتفظ بالنص وأعد المحاولة.' }, 503); }
}
