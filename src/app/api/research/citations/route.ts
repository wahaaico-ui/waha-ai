import { NextResponse } from 'next/server';
import { ownsProject, requireAuthenticatedUser } from '@/lib/supabase/authorization';
import { CitationEngine, CitationResolver, CITATION_STYLES, type CitationItem, type CitationStyle } from '@/lib/citations';
import type { AcademicPaper } from '@/lib/academic/integrations/types';
import { sanitizeClientCitationItem } from '@/lib/research-trust';
import { citationItemFromDiscovered, resolveSearchResults, SERVER_DISCOVERED_METADATA, USER_ASSERTED_METADATA } from '@/lib/research-search-results';

export async function POST(request: Request) {
  try {
    const access = await requireAuthenticatedUser();
    if (!access) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const body: unknown = await request.json();
    if (!body || typeof body !== 'object' || Array.isArray(body)) return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    const { projectId, paper, item, resultId, style, locator, context, number } = body as { projectId?: unknown; paper?: unknown; item?: unknown; resultId?: unknown; style?: unknown; locator?: unknown; context?: unknown; number?: unknown };
    if (typeof projectId !== 'string' || !(await ownsProject(projectId, access.user.id, access.supabase))) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    if (typeof style !== 'string' || !CITATION_STYLES.includes(style as CitationStyle)) return NextResponse.json({ error: 'Unsupported citation style' }, { status: 400 });
    let resolved: CitationItem | null;
    let origin: string;
    if (resultId !== undefined) {
      // A discovered source is formatted from the server-held search result for
      // this user and project, never from a browser copy of it.
      const results = await resolveSearchResults({ userId: access.user.id, projectId, resultIds: [String(resultId)] });
      if (!results.resolved.length) return NextResponse.json({ error: 'Search result not found or expired' }, { status: 404 });
      resolved = citationItemFromDiscovered(results.resolved[0].paper);
      origin = SERVER_DISCOVERED_METADATA;
    } else {
      // A source supplied by the browser is formatted from its bibliographic
      // fields only, as a user-asserted reference. Any verification state or
      // provenance in the request is discarded.
      const clientSource = paper && typeof paper === 'object' && !Array.isArray(paper) ? paper
        : item && typeof item === 'object' && !Array.isArray(item) ? item : null;
      if (!clientSource) return NextResponse.json({ error: 'A structured source is required' }, { status: 400 });
      resolved = sanitizeClientCitationItem(clientSource === paper ? CitationResolver.fromPaper(paper as AcademicPaper) : clientSource);
      origin = USER_ASSERTED_METADATA;
    }
    if (!resolved) return NextResponse.json({ error: 'Incomplete source metadata' }, { status: 422 });
    const citation = CitationEngine.create(resolved, style as CitationStyle, { number: typeof number === 'number' ? number : 1, locator: typeof locator === 'string' ? locator.slice(0, 100) : null, context: typeof context === 'string' ? context.slice(0, 1_000) : null });
    return NextResponse.json({ success: true, citation, item: resolved, origin, warning: citation.verificationStatus === 'unverified' ? 'هذا السجل غير متحقق منه بعد؛ راجع بياناته قبل الاستخدام الأكاديمي.' : null });
  } catch { return NextResponse.json({ error: 'Unable to create citation' }, { status: 500 }); }
}
