import { NextResponse } from 'next/server';

/** Retired: /api/verify-idea is the maintained validation boundary. */
export async function POST() {
  return NextResponse.json({
    error: 'هذا المسار القديم متوقف. استخدم مسار استكشاف الفكرة المعتمد.',
    next: '/verify-idea',
  }, { status: 410 });
}
