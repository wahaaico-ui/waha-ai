import type { SupabaseClient } from '@supabase/supabase-js';
import { readWritingSource } from '@/lib/evidence-writing-server';
import { readSavedWriting, WRITING_DOCUMENT_TYPE } from '@/lib/evidence-writing';
import { UnifiedResearchEngine } from '@/lib/academic/services/UnifiedResearchEngine';
import type { OverlapSource } from '@/lib/originality/text-match';
import type { ReportCitation } from '@/lib/originality/report';

/** Bounds the work of one check; a project rarely holds more saved sources. */
export const MAX_PROJECT_SOURCES = 80;
export const MAX_OPEN_QUERIES = 3;
const QUERY_WORDS = 12;
const MISSING_ABSTRACT = /^(?:المستخلص غير متوفر|no abstract available)?$/i;

/** The latest saved evidence-writing draft, with its server-held citations. */
export async function readLatestWritingDraft(db: SupabaseClient, projectId: string): Promise<{ text: string; citations: ReportCitation[] } | null> {
  const result = await db.from('documents').select('content').eq('project_id', projectId).eq('type', WRITING_DOCUMENT_TYPE)
    .order('created_at', { ascending: false }).order('id', { ascending: false }).limit(1).maybeSingle();
  if (result.error) throw result.error;
  const draft = result.data ? readSavedWriting(result.data.content) : null;
  if (!draft) return null;
  return {
    text: draft.text,
    citations: draft.citations.map(c => ({ sourceKind: c.sourceKind, sourceId: c.sourceId, claimStart: c.claimStart, claimEnd: c.claimEnd })),
  };
}

/** Full text of the project's saved references and PDFs, read with the owner's session. */
export async function loadProjectSources(db: SupabaseClient, projectId: string): Promise<OverlapSource[]> {
  const [references, pdfs] = await Promise.all([
    db.from('project_references').select('id').eq('project_id', projectId).order('created_at', { ascending: false }).limit(MAX_PROJECT_SOURCES),
    db.from('sources').select('id').eq('project_id', projectId).order('created_at', { ascending: false }).limit(MAX_PROJECT_SOURCES),
  ]);
  if (references.error) throw references.error;
  if (pdfs.error) throw pdfs.error;
  const wanted = [
    ...(pdfs.data || []).map(row => ({ kind: 'pdf' as const, id: String(row.id) })),
    ...(references.data || []).map(row => ({ kind: 'reference' as const, id: String(row.id) })),
  ].slice(0, MAX_PROJECT_SOURCES);

  const sources: OverlapSource[] = [];
  for (const item of wanted) {
    const source = await readWritingSource(db, projectId, item.kind, item.id);
    if (!source?.text.trim()) continue;
    sources.push({
      id: source.id, origin: item.kind === 'pdf' ? 'project-pdf' : 'project-reference',
      title: source.title, url: source.url, year: source.year ?? null, text: source.text,
    });
  }
  return sources;
}

/** Up to three short phrases from the longest sentences: the only text sent outside. */
export function openSourceQueries(text: string): string[] {
  const sentences = text.split(/[.!?؟\n]+/).map(s => s.trim().split(/\s+/).filter(Boolean)).filter(words => words.length >= 8);
  return [...sentences].sort((a, b) => b.length - a.length).slice(0, MAX_OPEN_QUERIES).map(words => words.slice(0, QUERY_WORDS).join(' '));
}

/** Titles and abstracts of open scholarly records matching phrases from the text. */
export async function loadOpenSources(text: string): Promise<{ sources: OverlapSource[]; providers: string[] }> {
  const sources = new Map<string, OverlapSource>();
  const providers = new Set<string>();
  for (const query of openSourceQueries(text)) {
    const result = await UnifiedResearchEngine.searchDetailed({ query, limit: 10 });
    for (const provider of result.providers) if (provider.available) providers.add(provider.provider);
    for (const paper of result.papers) {
      const abstract = paper.abstract?.trim() || '';
      const key = (paper.doi || paper.id).toLowerCase();
      if (sources.has(key) || MISSING_ABSTRACT.test(abstract)) continue;
      sources.set(key, {
        id: paper.doi || paper.id, origin: 'open-source', title: paper.title,
        url: paper.url || (paper.doi ? `https://doi.org/${paper.doi}` : null), year: paper.year || null,
        text: `${paper.title}. ${abstract}`,
      });
    }
  }
  return { sources: [...sources.values()], providers: [...providers].sort() };
}
