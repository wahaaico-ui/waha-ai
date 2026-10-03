import { NextResponse } from 'next/server';

/**
 * Retired. This route ran a fixed pipeline and returned APA references it
 * composed itself (author from the title's first word, a default year, and a
 * fixed journal, volume and pages), presented as formatted citations. No page
 * calls it. Research references come from server-held search results and the
 * citation routes, which never invent bibliographic metadata.
 */
export async function POST() {
  return NextResponse.json({
    error: 'هذا المسار متوقف لأنه كان يكوّن مراجع ببيانات غير مستخرجة من مصادر فعلية.',
    next: '/research',
  }, { status: 410 });
}
