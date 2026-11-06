import { NextResponse } from 'next/server';
import { loadIdeaInsights } from '@/lib/idea-selection/openalex-insights';

const respond = (body: Record<string, unknown>, status: number) =>
  NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } });

/**
 * Real yearly publication counts and growing topics for an idea, from OpenAlex.
 * Public like /api/verify-idea: it reads only open bibliographic counts.
 */
export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  const raw = body && typeof body === 'object' && !Array.isArray(body) ? (body as Record<string, unknown>).query : undefined;
  const query = typeof raw === 'string' ? raw.trim() : '';
  if (query.length < 3 || query.length > 300) return respond({ error: 'اكتب موضوعًا من 3 إلى 300 حرف.' }, 400);
  try {
    return respond({ insights: await loadIdeaInsights(query) }, 200);
  } catch {
    return respond({ error: 'تعذر الوصول إلى بيانات OpenAlex الآن، فلم نعرض مؤشرًا قد يكون مضللًا. أعد المحاولة.' }, 503);
  }
}
