import { NextResponse } from 'next/server';
import { generateStructured } from '@/lib/ai/geminiClient';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { documentId } = body;

    if (!documentId) {
      return NextResponse.json({ error: 'documentId is required' }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: 'Supabase credentials missing' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. جلب المستند الحالي والمحتوى والإصدار وproject_id
    const { data: currentDoc, error: fetchError } = await supabase
      .from('documents')
      .select('id, project_id, content, type, version')
      .eq('id', documentId)
      .single();

    if (fetchError || !currentDoc) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    const textToImprove = currentDoc.content || '';
    if (!textToImprove.trim()) {
      return NextResponse.json({ error: 'Document content is empty' }, { status: 400 });
    }

    // 2. إرسال النص إلى Gemini عبر العميل الموحد
    const prompt = `You are an academic editor. Rewrite the following text to fix all grammar, spelling, and clarity issues, in a professional academic tone.

Output ONLY the corrected text itself. Do not add explanations, options, headers, bullet points, or any commentary. Do not use markdown formatting. Return nothing except the final corrected version of the text, ready to be used directly in an academic document.

Text to correct:
${textToImprove}`;
    
    const { output, confidenceLabel } = await generateStructured({
      prompt,
      projectId: currentDoc.project_id,
      feature: 'paraphrase',
    });

    // 3. حفظ النتيجة كنسخة جديدة (version + 1) بجدول documents
    const nextVersion = (currentDoc.version || 1) + 1;
    const { data: newDoc, error: insertError } = await supabase
      .from('documents')
      .insert({
        project_id: currentDoc.project_id,
        type: currentDoc.type || 'paraphrased',
        content: output,
        version: nextVersion,
      })
      .select()
      .single();

    if (insertError) {
      throw insertError;
    }

    return NextResponse.json({
      success: true,
      document: newDoc,
      confidenceLabel,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
