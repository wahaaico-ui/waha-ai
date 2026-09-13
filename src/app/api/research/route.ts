// src/app/api/research/route.ts
import { NextResponse } from 'next/server';

/** Retired: use the authenticated, project-scoped /api/research/* flow. */
export async function POST() {
  return NextResponse.json({
    error: 'هذا المسار القديم متوقف. استخدم مسار الأدبيات داخل مشروع مسجل.',
    next: '/research/literature',
  }, { status: 410 });
}
