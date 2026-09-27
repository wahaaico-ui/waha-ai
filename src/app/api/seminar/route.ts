import { NextResponse } from 'next/server';

/**
 * Retired. This public route returned fixed research alternatives and
 * references presented as verified, regardless of input. No page calls it; the
 * seminar view is built from the saved project at /research/seminar.
 */
export async function POST() {
  return NextResponse.json({
    error: 'هذا المسار متوقف لأنه كان يعرض بدائل ومراجع ثابتة غير مستخرجة من مشروعك.',
    next: '/research/seminar',
  }, { status: 410 });
}
