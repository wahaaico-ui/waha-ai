import { NextResponse } from 'next/server';
import { generateStructured } from '@/lib/ai/geminiClient';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { projectId, text, prompt } = body;
    const rawText = text || prompt || '';

    if (!rawText) {
      return NextResponse.json({ error: 'Text or prompt is required' }, { status: 400 });
    }

    const analysisPrompt = `Analyze the following academic text/PDF content and extract key insights and summary:\n\n${rawText}`;
    
    const { output, confidenceLabel } = await generateStructured({
      prompt: analysisPrompt,
      projectId,
      feature: 'pdf-analyzer',
    });

    let sourceId = null;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (supabaseUrl && supabaseKey && projectId) {
      const supabase = createClient(supabaseUrl, supabaseKey);
      const { data, error } = await supabase
        .from('sources')
        .insert({
          project_id: projectId,
          raw_text: rawText,
          confidence: confidenceLabel,
        })
        .select('id')
        .single();

      if (!error && data) {
        sourceId = data.id;
      }
    }

    return NextResponse.json({
      success: true,
      output,
      confidenceLabel,
      sourceId,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
