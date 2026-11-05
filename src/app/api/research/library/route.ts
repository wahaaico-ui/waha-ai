import { NextResponse } from 'next/server';
import { ownsProject, requireAuthenticatedUser } from '@/lib/supabase/authorization';
import { createServiceClient } from '@/lib/supabase/service';
import { referenceOrigin } from '@/lib/research-references';
import { normaliseDoi } from '@/lib/academic/integrations/normalization';
import type { CitationItem } from '@/lib/citations';
import { BibliographyEngine, CITATION_STYLES } from '@/lib/citations';
import { sanitizeClientCitationItem } from '@/lib/research-trust';
import { logOperationalEvent } from '@/lib/observability';
import { bibliographyFromReference } from '@/lib/citations/writing-bibliography';
import { resolveStructuredAuthorNames } from '@/lib/citations/author-names';
import { readCompleteExportRows } from '@/lib/complete-export-rows';
import {
  citationItemFromDiscovered,
  literaturePaperFromReference,
  DISCOVERY_PROVIDER,
  resolveSearchResults,
  SERVER_DISCOVERED_METADATA,
  USER_ASSERTED_METADATA,
  USER_ASSERTED_PROVIDER,
} from '@/lib/research-search-results';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function jsonNoStore(body: unknown, init?: ResponseInit) {
  const headers = new Headers(init?.headers);
  headers.set('Cache-Control', 'private, no-store, max-age=0');
  return NextResponse.json(body, { ...init, headers });
}

function toLibraryItem(row: ReferenceRow) {
  // canonicalLinked says only whether the server linked the reference to a
  // canonical work (Slice 2B); the work id itself is not sent to the browser.
  return { ...toItem(row), origin: referenceOrigin(row), canonicalLinked: Boolean(row.work_id), literaturePaper: literaturePaperFromReference(row) };
}

type ReferenceRow = { id: string; project_id: string; provider: string; external_item_key: string; doi: string | null; title: string; authors: unknown; publication_year: number | null; publication_title: string | null; url: string | null; citation_data: unknown; work_id?: string | null };
const SELECT_COLUMNS = 'id, project_id, provider, external_item_key, doi, title, authors, publication_year, publication_title, url, citation_data, work_id';

// Verification is server-owned. No server-side verification exists for library
// rows yet, so every row is reported as unverified, including rows saved before
// Slice 0 whose citation_data carried a client-reported status.
function toItem(row: ReferenceRow): CitationItem {
  const metadata = row.citation_data && typeof row.citation_data === 'object' && !Array.isArray(row.citation_data) ? row.citation_data as Partial<CitationItem> : {};
  const bibliography = bibliographyFromReference(row);
  return {
    id: row.id, title: row.title, authors: bibliography.authors.map(name => 'literal' in name ? name.literal : [name.given, name.family].filter(Boolean).join(' ')), bibliography, year: row.publication_year,
    journal: metadata.journal || row.publication_title, publisher: metadata.publisher || null,
    volume: metadata.volume || null, issue: metadata.issue || null, pages: metadata.pages || null,
    doi: normaliseDoi(row.doi), url: row.url, type: metadata.type || 'article',
    verificationStatus: 'unverified', confidenceScore: 0,
    provenance: [row.provider],
  };
}

export async function GET(request: Request) {
  try {
    const access = await requireAuthenticatedUser();
    if (!access) return jsonNoStore({ error: 'Unauthorized' }, { status: 401 });
    const params = new URL(request.url).searchParams;
    const projectId = params.get('projectId')?.trim() || '';
    if (!projectId || !(await ownsProject(projectId, access.user.id, access.supabase))) return jsonNoStore({ error: 'Project not found' }, { status: 404 });
    const view = params.get('view');
    if (view !== null && view !== 'items') return jsonNoStore({ error: 'Invalid library view' }, { status: 400 });
    if (view === 'items') {
      const value = params.get('offset') ?? '0';
      const offset = Number(value);
      if (!/^(0|[1-9]\d*)$/.test(value) || !Number.isSafeInteger(offset) || offset > Number.MAX_SAFE_INTEGER - 199) return jsonNoStore({ error: 'Invalid library page' }, { status: 400 });
      const page = await access.supabase.from('project_references').select(SELECT_COLUMNS, { count: 'exact' })
        .eq('project_id', projectId).eq('user_id', access.user.id)
        .order('created_at', { ascending: false }).order('id', { ascending: false }).range(offset, offset + 199);
      if (page.error || !Array.isArray(page.data) || !Number.isSafeInteger(page.count) || page.count === null || page.count < 0
        || page.data.length > 200 || offset + page.data.length > page.count || (!page.data.length && offset < page.count)) throw new Error('Library page unavailable');
      const nextOffset = offset + page.data.length;
      return jsonNoStore({ success: true, items: page.data.map(row => toLibraryItem(row as ReferenceRow)), total: page.count, offset,
        nextOffset: nextOffset < page.count ? nextOffset : null });
    }
    // Keep RLS and explicit owner/project filters. Database failures must be
    // reported as failures, never as a successful empty library.
    const rows = await readCompleteExportRows<ReferenceRow>((from, to) => access.supabase
      .from('project_references').select(SELECT_COLUMNS, { count: 'exact' })
      .eq('project_id', projectId).eq('user_id', access.user.id)
      .order('created_at', { ascending: false }).order('id', { ascending: false }).range(from, to));
    const items = rows.map(toLibraryItem);
    const bibliographies = Object.fromEntries(CITATION_STYLES.map((style) => [style, BibliographyEngine.build(items, style)]));
    return jsonNoStore({ success: true, items, bibliographies, total: items.length });
  } catch { return jsonNoStore({ error: 'Unable to load project library' }, { status: 500 }); }
}

export async function POST(request: Request) {
  try {
    const access = await requireAuthenticatedUser();
    if (!access) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const body: unknown = await request.json();
    if (!body || typeof body !== 'object' || Array.isArray(body)) return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    const { projectId, item, resultId } = body as { projectId?: unknown; item?: unknown; resultId?: unknown };
    const hasItem = Boolean(item && typeof item === 'object' && !Array.isArray(item));
    if (typeof projectId !== 'string' || (resultId === undefined && !hasItem) || (resultId !== undefined && hasItem)) return NextResponse.json({ error: 'A project and either a search result or a reference are required' }, { status: 400 });
    if (!(await ownsProject(projectId, access.user.id, access.supabase))) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    let candidate: CitationItem | null;
    let provider: string;
    let origin: Record<string, unknown>;
    // The canonical work comes only from the server-held search result
    // (Slice 2B); a work id in the request is never read.
    let workId: string | null = null;
    if (resultId !== undefined) {
      // A discovered source: metadata is rehydrated from the server-held search
      // result for this user and project; the request only names the result.
      const { resolved } = await resolveSearchResults({ userId: access.user.id, projectId, resultIds: [String(resultId)] });
      if (!resolved.length) return NextResponse.json({ error: 'Search result not found or expired' }, { status: 404 });
      const [result] = resolved;
      workId = result.workId;
      candidate = citationItemFromDiscovered(result.paper);
      provider = DISCOVERY_PROVIDER;
      origin = { metadataOrigin: SERVER_DISCOVERED_METADATA, discoveredPaper: result.paper, discovery: { resultId: result.resultId, searchRunId: result.searchRunId, providers: result.paper.providers, retrievedAt: result.retrievedAt } };
    } else {
      // A reference entered by the researcher: kept, but labelled user-asserted
      // and never treated as discovered. Verification fields are discarded.
      candidate = sanitizeClientCitationItem(item);
      provider = USER_ASSERTED_PROVIDER;
      origin = { metadataOrigin: USER_ASSERTED_METADATA };
    }
    if (!candidate || candidate.title.length < 3) return NextResponse.json({ error: 'Reference title is required' }, { status: 400 });
    const externalKey = String(candidate.doi || candidate.id || candidate.title).slice(0, 500);

    // An existing reference (for example a Zotero import) is never overwritten;
    // saving the same work again returns it unchanged.
    // A project holds one reference per canonical work, so the same work saved
    // from another search returns the existing reference.
    const findExisting = async () => {
      if (workId) {
        const byWork = await access.supabase.from('project_references').select(SELECT_COLUMNS).eq('project_id', projectId).eq('user_id', access.user.id).eq('work_id', workId).limit(1).maybeSingle();
        if (byWork.error) throw byWork.error;
        if (byWork.data) return byWork.data;
      }
      const byKey = await access.supabase.from('project_references').select(SELECT_COLUMNS).eq('project_id', projectId).eq('user_id', access.user.id).eq('external_item_key', externalKey).limit(1).maybeSingle();
      if (byKey.error) throw byKey.error;
      return byKey.data;
    };
    const existing = await findExisting();
    if (existing) return NextResponse.json({ success: true, item: toLibraryItem(existing as ReferenceRow), existing: true });

    // Discovery indexes give display names only. A discovered DOI's registry
    // record may supply family and given names; a manual entry is kept as typed.
    const structured = resultId !== undefined ? await resolveStructuredAuthorNames(candidate.doi, candidate.authors) : null;
    const authors = candidate.authors.map((name, index) => {
      const parts = structured?.names[index];
      return parts && 'family' in parts ? { type: 'author', name, family: parts.family, ...(parts.given ? { given: parts.given } : {}) } : { type: 'author', name };
    });
    const row = {
      project_id: projectId, user_id: access.user.id, provider, external_item_key: externalKey,
      doi: candidate.doi, title: candidate.title, authors,
      publication_year: candidate.year, publication_title: candidate.journal, url: candidate.url,
      citation_data: { ...candidate, id: externalKey, ...origin, ...(structured ? { authorNamesSource: structured.source } : {}) }, synced_at: new Date().toISOString(),
      ...(workId ? { work_id: workId } : {}),
    };
    // project_references is written only by the server (migration
    // 20261004000000). The project was verified as the caller's above, and
    // project_id and user_id come from that check, not from the request.
    const { data, error } = await createServiceClient().from('project_references').insert(row).select(SELECT_COLUMNS).single();
    if (error?.code === '23505') {
      // A concurrent save created the same reference first; return that row.
      const saved = await findExisting();
      if (!saved) throw error;
      return NextResponse.json({ success: true, item: toLibraryItem(saved as ReferenceRow), existing: true });
    }
    if (error) throw error;
    return NextResponse.json({ success: true, item: toLibraryItem(data as ReferenceRow) });
  } catch (error) {
    logOperationalEvent('error', {
      event: 'research.library.save_failed',
      route: 'POST /api/research/library',
      outcome: 'failed',
      errorCode: error instanceof Error ? error.message.slice(0, 120) : 'unknown_error',
    });
    return NextResponse.json({ error: 'Unable to save reference' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const access = await requireAuthenticatedUser();
    if (!access) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const url = new URL(request.url); const projectId = url.searchParams.get('projectId') || ''; const referenceId = url.searchParams.get('referenceId') || '';
    if (!projectId || !referenceId || !(await ownsProject(projectId, access.user.id, access.supabase))) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    const { error } = await access.supabase.from('project_references').delete().eq('id', referenceId).eq('project_id', projectId).eq('user_id', access.user.id);
    // A reference cited by project evidence is kept until that evidence is removed.
    if (error?.code === '23503') return NextResponse.json({ error: 'This reference is cited by project evidence. Remove that evidence first.' }, { status: 409 });
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch { return NextResponse.json({ error: 'Unable to remove reference' }, { status: 500 }); }
}
