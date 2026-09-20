import { NextResponse } from 'next/server';
import { requireAuthenticatedUser } from '@/lib/supabase/authorization';
import { SemanticScholarService } from '@/lib/academic/services/SemanticScholarService';

export async function POST(request: Request) {
  try {
    const access = await requireAuthenticatedUser();
    if (!access) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { idea } = await request.json();
    if (!idea) return NextResponse.json({ error: 'الفكرة مطلوبة' }, { status: 400 });

    const results = await SemanticScholarService.searchPapers(idea, 5);
    const papers = results.map((paper) => ({
      title: paper.title,
      year: paper.year || null,
      citationCount: paper.citationCount,
      url: paper.url || null,
    }));

    return NextResponse.json({ success: true, papers });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ error: 'تعذر جلب الأبحاث ذات الصلة حالياً' }, { status: 500 });
  }
}
