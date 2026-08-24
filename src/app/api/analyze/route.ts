import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json({
    error: 'هذا المسار متوقف لأنه كان يعرض نتيجة تجريبية. استخدم مسار تحليل المشروع الموثق.',
    next: '/research/analysis',
  }, { status: 410 });
}
