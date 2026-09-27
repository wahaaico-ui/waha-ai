import { NextResponse } from 'next/server';
import { ownsProject, requireAuthenticatedUser } from '@/lib/supabase/authorization';
import { CitationEngine, CitationResolver, CITATION_STYLES, type CitationItem, type CitationStyle } from '@/lib/citations';
import type { AcademicPaper } from '@/lib/academic/integrations/types';
import { sanitizeClientCitationItem } from '@/lib/research-trust';

export async function POST(request: Request) {
  try {
    const access = await requireAuthenticatedUser();
    if (!access) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const body: unknown = await request.json();
    if (!body || typeof body !== 'object' || Array.isArray(body)) return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    const { projectId, paper, item, style, locator, context, number } = body as { projectId?: unknown; paper?: unknown; item?: unknown; style?: unknown; locator?: unknown; context?: unknown; number?: unknown };
    if (typeof projectId !== 'string' || !(await ownsProject(projectId, access.user.id, access.supabase))) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    if (typeof style !== 'string' || !CITATION_STYLES.includes(style as CitationStyle)) return NextResponse.json({ error: 'Unsupported citation style' }, { status: 400 });
    // The source arrives from the browser, so it is formatted from its
    // bibliographic fields only. Any verification state or provenance in the
    // request is discarded; the citation is reported as unverified.
    const clientSource = paper && typeof paper === 'object' && !Array.isArray(paper) ? paper
      : item && typeof item === 'object' && !Array.isArray(item) ? item : null;
    if (!clientSource) return NextResponse.json({ error: 'A structured source is required' }, { status: 400 });
    const resolved: CitationItem | null = sanitizeClientCitationItem(clientSource === paper ? CitationResolver.fromPaper(paper as AcademicPaper) : clientSource);
    if (!resolved) return NextResponse.json({ error: 'Incomplete source metadata' }, { status: 422 });
    const citation = CitationEngine.create(resolved, style as CitationStyle, { number: typeof number === 'number' ? number : 1, locator: typeof locator === 'string' ? locator.slice(0, 100) : null, context: typeof context === 'string' ? context.slice(0, 1_000) : null });
    return NextResponse.json({ success: true, citation, item: resolved, warning: citation.verificationStatus === 'unverified' ? 'هذا السجل غير متحقق منه بعد؛ راجع بياناته قبل الاستخدام الأكاديمي.' : null });
  } catch { return NextResponse.json({ error: 'Unable to create citation' }, { status: 500 }); }
}
