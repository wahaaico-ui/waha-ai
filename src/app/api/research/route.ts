// src/app/api/research/route.ts
import { NextResponse } from 'next/server';
import { ResearchPipelineService } from '@/services/research-pipeline.service';

export async function POST(request: Request) {
  try {
    const { query } = await request.json();

    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { error: 'يرجى إدخال فكرة بحثية صحيحة' },
        { status: 400 }
      );
    }

    // تنفيذ خط العمليات البحثي عبر النظام الأساسي
    const pipelineResult = await ResearchPipelineService.search(query);

    // استخراج الأوراق البحثية بشكل آمن لمنع أخطاء الـ Never Types
    const rawPapers = pipelineResult?.research?.papers || [];
    const works = rawPapers.map((p: Record<string, unknown>) => ({
      title: (p.title as string) || 'عنوان غير متوفر',
      authors: Array.isArray(p.authors) ? p.authors.join(', ') : ((p.authors as string) || 'مؤلف غير معروف'),
      year: (p.year as number) || (p.publicationYear as number) || new Date().getFullYear(),
      citedBy: (p.citedBy as number) || (p.citationCount as number) || 0,
      doi: (p.doi as string) || (p.url as string) || null
    }));

    return NextResponse.json({
      works,
      totalAvailable: pipelineResult?.research?.totalAvailable || works.length,
      intelligence: pipelineResult?.intelligence || null
    });

  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'حدث خطأ غير متوقع أثناء معالجة البحث';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}