import { NextResponse } from 'next/server';
import { ownedSource, ownsProject, requireAuthenticatedUser } from '@/lib/supabase/authorization';
import { CiteAsService } from '@/lib/language/CiteAsService';
import { normaliseDoi } from '@/lib/academic/integrations/normalization';
import { createServiceClient } from '@/lib/supabase/service';

// Bibliographic citations are never written by a language model. A citation is
// produced only when the source text contains a DOI that an external citation
// formatter (CiteAs) can resolve; otherwise nothing is stored. The result is
// labelled unverified because WAHA has not itself checked the metadata.
const CITATION_CONFIDENCE = 'unverified_external_formatter';

export async function POST(request: Request) {
  try {
    const access = await requireAuthenticatedUser();
    if (!access) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { sourceId, rawText, projectId } = await request.json();
    const source = sourceId ? await ownedSource(sourceId, access.user.id, access.supabase) : null;
    if (sourceId && !source) return NextResponse.json({ error: 'Source not found' }, { status: 404 });
    if (!sourceId && (!projectId || !(await ownsProject(projectId, access.user.id, access.supabase)))) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    let reference = typeof rawText === 'string' ? rawText.slice(0, 1_000_000) : '';
    let searchable = reference;
    if (source && !reference) {
      const { data } = await access.supabase.from('sources').select('raw_text').eq('id', source.id).maybeSingle();
      reference = typeof data?.raw_text === 'string' ? data.raw_text : '';
      // A full PDF also contains the DOIs of the works it cites; only the opening
      // text, where a paper usually prints its own DOI, is searched.
      searchable = reference.slice(0, 3_000);
    }
    const doi = normaliseDoi(searchable.match(/10\.\d{4,9}\/[^\s"<>]+/i)?.[0]);
    if (!doi) {
      return NextResponse.json({ success: true, citation: null, status: 'no_identifier', message: 'لم يُعثر على معرّف DOI في نص المصدر، لذلك لم يُنشأ توثيق تلقائي. أدخل بيانات المرجع يدوياً.' });
    }

    let citations: Awaited<ReturnType<typeof CiteAsService.citations>> = [];
    try { citations = await CiteAsService.citations(doi); } catch { citations = []; }
    const apa = citations.find((citation) => citation.style === 'apa')?.citation || null;
    const ieee = citations.find((citation) => citation.style === 'ieee')?.citation || null;
    if (!apa && !ieee) {
      return NextResponse.json({ success: true, citation: null, doi, status: 'formatter_unavailable', message: 'تعذر الحصول على توثيق لهذا المعرّف الآن، ولم يُنشأ توثيق بديل.' });
    }

    // sources is written only by the server (migration 20261004000000). The
    // source or project was verified as the caller's above; the write is scoped
    // to that source and its project.
    const serverWriter = createServiceClient();
    let resolvedSourceId = source?.id || null;
    if (source) {
      const { error } = await serverWriter.from('sources').update({ parsed_citation_apa: apa, parsed_citation_ieee: ieee, confidence: CITATION_CONFIDENCE }).eq('id', source.id).eq('project_id', source.project_id);
      if (error) return NextResponse.json({ error: 'Unable to save source' }, { status: 500 });
    } else {
      const { data, error } = await serverWriter.from('sources').insert({ project_id: projectId, raw_text: reference || doi, parsed_citation_apa: apa, parsed_citation_ieee: ieee, confidence: CITATION_CONFIDENCE }).select('id').single();
      if (error) return NextResponse.json({ error: 'Unable to save source' }, { status: 500 });
      resolvedSourceId = data.id;
    }
    return NextResponse.json({ success: true, doi, apa, ieee, verificationStatus: 'unverified', sourceId: resolvedSourceId, status: 'formatted_from_doi' });
  } catch { return NextResponse.json({ error: 'Unable to create citations' }, { status: 500 }); }
}
