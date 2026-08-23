import { NextResponse } from 'next/server';
import { generateStructured } from '@/lib/ai/geminiClient';
import { ownedDocument, requireAuthenticatedUser } from '@/lib/supabase/authorization';

export async function POST(request: Request) {
  try {
    const access = await requireAuthenticatedUser();
    if (!access) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { documentId } = await request.json();
    if (!documentId) return NextResponse.json({ error: 'documentId is required' }, { status: 400 });
    const document = await ownedDocument(documentId, access.user.id, access.supabase);
    if (!document) return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    const text = document.content || '';
    if (!text.trim()) return NextResponse.json({ error: 'Document content is empty' }, { status: 400 });

    const { output, confidenceLabel } = await generateStructured({ prompt: `You are an academic editor. Rewrite this text for grammar, spelling, clarity, and academic tone. Return only the corrected text.\n\n${text}`, projectId: document.project_id, feature: 'paraphrase' });
    const { data: newDocument, error } = await access.supabase.from('documents').insert({ project_id: document.project_id, type: document.type || 'paraphrased', content: output, version: (document.version || 1) + 1 }).select().single();
    if (error) return NextResponse.json({ error: 'Unable to save document' }, { status: 500 });
    return NextResponse.json({ success: true, document: newDocument, confidenceLabel });
  } catch { return NextResponse.json({ error: 'Unable to paraphrase document' }, { status: 500 }); }
}
