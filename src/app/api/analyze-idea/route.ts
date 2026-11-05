import { NextResponse } from 'next/server';

/**
 * Retired. This public, unauthenticated route sent any input to an AI model and
 * returned model-assigned quality scores. No page calls it; idea exploration is
 * served by /api/verify-idea. The previous implementation is in git history.
 */
export async function POST() {
  return NextResponse.json({
    error: 'هذا المسار متوقف. استخدم استكشاف الفكرة الموثق.',
    next: '/verify-idea',
  }, { status: 410 });
}
