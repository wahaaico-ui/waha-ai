import { NextResponse } from 'next/server';
import { requireAuthenticatedUser } from '@/lib/supabase/authorization';

export async function POST(request: Request) {
  try {
    const access = await requireAuthenticatedUser();
    if (!access) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { idea } = await request.json();
    if (!idea) return NextResponse.json({ error: 'الفكرة مطلوبة' }, { status: 400 });

    const apiKey = process.env.SEMANTIC_SCHOLAR_API_KEY;
    const url = `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(idea)}&limit=5&fields=title,year,citationCount,url`;

    const response = await fetch(url, {
      headers: apiKey ? { 'x-api-key': apiKey } : {},
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('Semantic Scholar error:', response.status, err);
      return NextResponse.json({ error: 'تعذر جلب الأبحاث ذات الصلة حالياً' }, { status: 502 });
    }

    const data = await response.json();
    const papers = (data.data || []).map((p: Record<string, unknown>) => ({
      title: p.title || 'عنوان غير متوفر',
      year: p.year || null,
      citationCount: p.citationCount || 0,
      url: p.url || null,
    }));

    return NextResponse.json({ success: true, papers });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ error: 'تعذر جلب الأبحاث ذات الصلة حالياً' }, { status: 500 });
  }
}
