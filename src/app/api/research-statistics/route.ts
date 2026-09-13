import { NextResponse } from 'next/server';

/** Retired: the previous implementation exposed an unaudited fixed score. */
export async function POST() {
  return NextResponse.json({
    error: 'هذا المسار متوقف لأنه كان يعرض مؤشراً غير موثق.',
    next: '/research/analysis',
  }, { status: 410 });
}
