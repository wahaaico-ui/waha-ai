import { NextResponse } from 'next/server';
import { ownsProject, requireAuthenticatedUser } from '@/lib/supabase/authorization';
import { normaliseDoi } from '@/lib/academic/integrations/normalization';
import type { CitationItem } from '@/lib/citations';
import { BibliographyEngine, CITATION_STYLES } from '@/lib/citations';

type ReferenceRow = { id: string; project_id: string; provider: string; external_item_key: string; doi: string | null; title: string; authors: unknown; publication_year: number | null; publication_title: string | null; url: string | null; citation_data: unknown };

function authors(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((author) => typeof author === 'string' ? [author] : author && typeof author === 'object' && typeof (author as { name?: unknown }).name === 'string' ? [(author as { name: string }).name] : []).filter(Boolean);
}

function toItem(row: ReferenceRow): CitationItem {
  const metadata = row.citation_data && typeof row.citation_data === 'object' && !Array.isArray(row.citation_data) ? row.citation_data as Partial<CitationItem> : {};
  return {
    id: row.id, title: row.title, authors: authors(row.authors), year: row.publication_year,
    journal: metadata.journal || row.publication_title, publisher: metadata.publisher || null,
    volume: metadata.volume || null, issue: metadata.issue || null, pages: metadata.pages || null,
    doi: normaliseDoi(row.doi), url: row.url, type: metadata.type || 'article',
    verificationStatus: metadata.verificationStatus || 'unverified', confidenceScore: Number(metadata.confidenceScore) || 0,
    provenance: Array.isArray(metadata.provenance) ? metadata.provenance : [row.provider],
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

export async function POST(request: Request) {
  try {
    const access = await requireAuthenticatedUser();
    if (!access) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const body: unknown = await request.json();
    if (!body || typeof body !== 'object' || Array.isArray(body)) return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    const { projectId, item } = body as { projectId?: unknown; item?: unknown };
    if (typeof projectId !== 'string' || !item || typeof item !== 'object' || Array.isArray(item)) return NextResponse.json({ error: 'Project and reference are required' }, { status: 400 });
    if (!(await ownsProject(projectId, access.user.id, access.supabase))) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    const candidate = item as Partial<CitationItem>;
    if (typeof candidate.title !== 'string' || candidate.title.trim().length < 3) return NextResponse.json({ error: 'Reference title is required' }, { status: 400 });
    const doi = normaliseDoi(candidate.doi);
    const externalKey = String(doi || candidate.id || candidate.title).slice(0, 500);
    const provenance = Array.isArray(candidate.provenance) ? candidate.provenance.filter((value): value is string => typeof value === 'string').slice(0, 20) : [];
    const row = {
      project_id: projectId, user_id: access.user.id, provider: provenance[0] || 'waha', external_item_key: externalKey,
      doi, title: candidate.title.trim().slice(0, 1_000), authors: (candidate.authors || []).filter((value): value is string => typeof value === 'string').slice(0, 100).map((name) => ({ type: 'author', name: name.slice(0, 300) })),
      publication_year: typeof candidate.year === 'number' && candidate.year > 0 ? candidate.year : null,
      publication_title: candidate.journal?.slice(0, 500) || null, url: candidate.url?.slice(0, 2_000) || null,
      citation_data: { ...candidate, id: externalKey, doi, title: candidate.title.trim(), provenance }, synced_at: new Date().toISOString(),
    };
    const { data, error } = await access.supabase.from('project_references').upsert(row, { onConflict: 'project_id,provider,external_item_key' }).select('id, project_id, provider, external_item_key, doi, title, authors, publication_year, publication_title, url, citation_data').single();
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
