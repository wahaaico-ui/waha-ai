import { NextResponse } from 'next/server';
import { requireAuthenticatedUser } from '@/lib/supabase/authorization';
import { ORCIDService } from '@/lib/academic/services/ORCIDService';

export async function POST(request: Request) {
  const access = await requireAuthenticatedUser();
  if (!access) return NextResponse.json({ error: 'يجب تسجيل الدخول أولاً.' }, { status: 401 });
  if (!ORCIDService.configured()) return NextResponse.json({ error: 'خدمة التحقق من هوية الباحث غير مفعّلة حالياً.' }, { status: 503 });
  try {
    const body: unknown = await request.json();
    const query = body && typeof body === 'object' && !Array.isArray(body) && typeof (body as { query?: unknown }).query === 'string'
      ? (body as { query: string }).query.trim() : '';
    if (query.length < 3 || query.length > 200) return NextResponse.json({ error: 'اسم الباحث أو استعلام ORCID غير صالح.' }, { status: 400 });
    return NextResponse.json({ success: true, results: await ORCIDService.searchResearcher(query, 10) });
  } catch {
    return NextResponse.json({ error: 'تعذر التحقق من هوية الباحث حالياً.' }, { status: 502 });
  }
}
