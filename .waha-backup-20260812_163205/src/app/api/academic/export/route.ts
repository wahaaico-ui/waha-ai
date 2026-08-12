import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { projectId } = body;

    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: 'Supabase credentials missing' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. جلب بيانات المشروع الأساسية وسياسة الجامعة
    const { data: project, error: projError } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .single();

    if (projError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // 2. جلب جميع المستندات المرتبطة بالمشروع مرتبة حسب الإصدار تنازلياً
    const { data: documents, error: docError } = await supabase
      .from('documents')
      .select('*')
      .eq('project_id', projectId)
      .order('version', { ascending: false });

    if (docError) {
      return NextResponse.json({ error: 'Failed to fetch documents' }, { status: 500 });
    }

    // 3. جلب المصادر والمراجع المرتبطة
    const { data: sources, error: srcError } = await supabase
      .from('sources')
      .select('*')
      .eq('project_id', projectId);

    // الاحتفاظ بأحدث نسخة لكل نوع مستند (Latest version per type)
    const latestDocsMap = new Map();
    if (documents) {
      for (const doc of documents) {
        if (!latestDocsMap.has(doc.type)) {
          latestDocsMap.set(doc.type, doc);
        }
      }
    }
    const latestDocs = Array.from(latestDocsMap.values());

    // بناء محتوى ملف التصدير (Markdown / Report) بناءً على البيانات الحقيقية تماماً
    let fileContent = `# ${project.title}\n\n`;
    fileContent += `**University Policy / Onboarding:** ${project.university_policy || 'Not specified'}\n`;
    fileContent += `**Export Date:** ${new Date().toISOString().split('T')[0]}\n\n`;
    fileContent += `---\n\n## Project Documents (Latest Versions)\n\n`;

    if (latestDocs.length === 0) {
      fileContent += `No documents found for this project.\n\n`;
    } else {
      latestDocs.forEach((doc: any) => {
        fileContent += `### Type: ${doc.type} (Version ${doc.version})\n`;
        fileContent += `${doc.content}\n\n`;
        fileContent += `---\n\n`;
      });
    }

    if (sources && sources.length > 0) {
      fileContent += `## Sources & Citations\n\n`;
      sources.forEach((src: any, idx: number) => {
        fileContent += `### Source ${idx + 1}\n`;
        fileContent += `- **Raw Text:** ${src.raw_text}\n`;
        if (src.parsed_citation_apa) fileContent += `- **APA Citation:** ${src.parsed_citation_apa}\n`;
        if (src.parsed_citation_ieee) fileContent += `- **IEEE Citation:** ${src.parsed_citation_ieee}\n`;
        fileContent += `- **Confidence:** ${src.confidence || 'N/A'}\n\n`;
      });
    }

    // إرجاع الملف كاستجابة تحميل حقيقية (Downloadable file response)
    return new NextResponse(fileContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(project.title || 'project')}-export.md"`,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
