import { NextResponse } from 'next/server';
import { ownsProject, requireAuthenticatedUser } from '@/lib/supabase/authorization';
import { normaliseDoi } from '@/lib/academic/integrations/normalization';
import type { CitationItem } from '@/lib/citations';
import { BibliographyEngine, CITATION_STYLES } from '@/lib/citations';
import { CLIENT_SUBMITTED_METADATA, sanitizeClientCitationItem } from '@/lib/research-trust';

// Provider value for references saved from the browser; it never comes from the request.
const CLIENT_SAVED_PROVIDER = 'waha';

type ReferenceRow = { id: string; project_id: string; provider: string; external_item_key: string; doi: string | null; title: string; authors: unknown; publication_year: number | null; publication_title: string | null; url: string | null; citation_data: unknown };

function authors(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((author) => typeof author === 'string' ? [author] : author && typeof author === 'object' && typeof (author as { name?: unknown }).name === 'string' ? [(author as { name: string }).name] : []).filter(Boolean);
}

// Verification is server-owned. No server-side verification exists for library
// rows yet, so every row is reported as unverified, including rows saved before
// Slice 0 whose citation_data carried a client-reported status.
function toItem(row: ReferenceRow): CitationItem {
  const metadata = row.citation_data && typeof row.citation_data === 'object' && !Array.isArray(row.citation_data) ? row.citation_data as Partial<CitationItem> : {};
  return {
    id: row.id, title: row.title, authors: authors(row.authors), year: row.publication_year,
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
    if (!access) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const projectId = new URL(request.url).searchParams.get('projectId')?.trim() || '';
    if (!projectId || !(await ownsProject(projectId, access.user.id, access.supabase))) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    const { data, error } = await access.supabase.from('project_references').select('id, project_id, provider, external_item_key, doi, title, authors, publication_year, publication_title, url, citation_data').eq('project_id', projectId).eq('user_id', access.user.id).order('created_at', { ascending: false });
    if (error) throw error;
    const items = ((data || []) as ReferenceRow[]).map(toItem);
    const bibliographies = Object.fromEntries(CITATION_STYLES.map((style) => [style, BibliographyEngine.build(items, style)]));
    return NextResponse.json({ success: true, items, bibliographies });
  } catch { return NextResponse.json({ error: 'Unable to load project library' }, { status: 500 }); }
}

const SELECT_COLUMNS = 'id, project_id, provider, external_item_key, doi, title, authors, publication_year, publication_title, url, citation_data';

export async function POST(request: Request) {
  try {
    const access = await requireAuthenticatedUser();
    if (!access) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const body: unknown = await request.json();
    if (!body || typeof body !== 'object' || Array.isArray(body)) return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    const { projectId, item } = body as { projectId?: unknown; item?: unknown };
    if (typeof projectId !== 'string' || !item || typeof item !== 'object' || Array.isArray(item)) return NextResponse.json({ error: 'Project and reference are required' }, { status: 400 });
    if (!(await ownsProject(projectId, access.user.id, access.supabase))) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    // Only bibliographic fields are accepted; verificationStatus, confidenceScore
    // and provenance from the request are discarded (src/lib/research-trust.ts).
    const candidate = sanitizeClientCitationItem(item);
    if (!candidate || candidate.title.length < 3) return NextResponse.json({ error: 'Reference title is required' }, { status: 400 });
    const externalKey = String(candidate.doi || candidate.id || candidate.title).slice(0, 500);

    // An existing reference (for example a Zotero import) is never overwritten by
    // client-supplied metadata; saving the same work again returns it unchanged.
    const existing = await access.supabase.from('project_references').select(SELECT_COLUMNS).eq('project_id', projectId).eq('user_id', access.user.id).eq('external_item_key', externalKey).limit(1).maybeSingle();
    if (existing.error) throw existing.error;
    if (existing.data) return NextResponse.json({ success: true, item: toItem(existing.data as ReferenceRow), existing: true });

    const row = {
      project_id: projectId, user_id: access.user.id, provider: CLIENT_SAVED_PROVIDER, external_item_key: externalKey,
      doi: candidate.doi, title: candidate.title, authors: candidate.authors.map((name) => ({ type: 'author', name })),
      publication_year: candidate.year, publication_title: candidate.journal, url: candidate.url,
      citation_data: { ...candidate, id: externalKey, metadataOrigin: CLIENT_SUBMITTED_METADATA }, synced_at: new Date().toISOString(),
    };
    const { data, error } = await access.supabase.from('project_references').insert(row).select(SELECT_COLUMNS).single();
    if (error?.code === '23505') {
      // A concurrent save created the same reference first; return that row.
      const saved = await access.supabase.from('project_references').select(SELECT_COLUMNS).eq('project_id', projectId).eq('user_id', access.user.id).eq('external_item_key', externalKey).limit(1).maybeSingle();
      if (saved.error || !saved.data) throw saved.error || error;
      return NextResponse.json({ success: true, item: toItem(saved.data as ReferenceRow), existing: true });
    }
    if (error) throw error;
    return NextResponse.json({ success: true, item: toItem(data as ReferenceRow) });
  } catch { return NextResponse.json({ error: 'Unable to save reference' }, { status: 500 }); }
}

export async function DELETE(request: Request) {
  try {
    const access = await requireAuthenticatedUser();
    if (!access) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const url = new URL(request.url); const projectId = url.searchParams.get('projectId') || ''; const referenceId = url.searchParams.get('referenceId') || '';
    if (!projectId || !referenceId || !(await ownsProject(projectId, access.user.id, access.supabase))) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    const { error } = await access.supabase.from('project_references').delete().eq('id', referenceId).eq('project_id', projectId).eq('user_id', access.user.id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch { return NextResponse.json({ error: 'Unable to remove reference' }, { status: 500 }); }
}
