import { NextResponse } from 'next/server';
import { generateStructured } from '@/lib/ai/geminiClient';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { sourceId, rawText, projectId } = body;

    const textToProcess = rawText || 'Academic source reference';
    const citationPrompt = `Generate APA and IEEE citations for the following text/source:\n\n${textToProcess}\n\nProvide them clearly separated as APA and IEEE format.`;

    const { output, confidenceLabel } = await generateStructured({
      prompt: citationPrompt,
      projectId,
      feature: 'citations',
    });

    const apaMatch = output.match(/APA[:\s]*(.*?)(?=IEEE|$)/is);
    const ieeeMatch = output.match(/IEEE[:\s]*(.*)/is);
    const apa = apaMatch ? apaMatch[1].trim() : output;
    const ieee = ieeeMatch ? ieeeMatch[1].trim() : output;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (supabaseUrl && supabaseKey) {
      const supabase = createClient(supabaseUrl, supabaseKey);

      if (sourceId) {
        await supabase
          .from('sources')
          .update({
            parsed_citation_apa: apa,
            parsed_citation_ieee: ieee,
            confidence: confidenceLabel,
          })
          .eq('id', sourceId);
      } else if (projectId) {
        await supabase
          .from('sources')
          .insert({
            project_id: projectId,
            raw_text: textToProcess,
            parsed_citation_apa: apa,
            parsed_citation_ieee: ieee,
            confidence: confidenceLabel,
          });
      }
    }

    return NextResponse.json({
      success: true,
      apa,
      ieee,
      confidenceLabel,
      sourceId,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
