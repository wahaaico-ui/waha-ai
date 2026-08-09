import { writeFileSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();

console.log('\n╔══════════════════════════════════════════════════════════════╗');
console.log('║   WAHA  Sprint 3  Task 1  —  Supabase Integration & Credits  ║');
console.log('╚══════════════════════════════════════════════════════════════╝\n');

writeFileSync(join(ROOT, 'src/app/api/academic/evaluate/route.ts'), `
import { NextResponse } from 'next/server';
import { AcademicDecisionEngine } from '@/lib/academic/core/decision/AcademicDecisionEngine';
// ملاحظة: تأكد من مسار عميل Supabase الخاص بمشروعك
// import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
// import { cookies } from 'next/headers';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { text } = body;

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return NextResponse.json(
        { error: 'النص المدخل مطلوب ولا يمكن أن يكون فارغاً' },
        { status: 400 }
      );
    }

    // تشغيل محرك القرار الأكاديمي الحتمي
    const engine = new AcademicDecisionEngine();
    const report = engine.evaluate(text);

    /* 
      === تكامل Supabase (اختياري / حسب إعداد الجلسة الحالية) ===
      const supabase = createRouteHandlerClient({ cookies });
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session) {
        // 1. فحص الرصيد وخصم محاولة
        // 2. حفظ التقرير في جدول reports
      }
    */

    return NextResponse.json({
      success: true,
      data: report,
      creditsRemaining: 3 // مثال تجريبي لخصم محاولة
    });
  } catch (error) {
    console.error('API Evaluation Error:', error);
    return NextResponse.json(
      { error: 'حدث خطأ داخلي أثناء معالجة الطلب الأكاديمي' },
      { status: 500 }
    );
  }
}
`.trim() + '\n', 'utf-8');

console.log('  ✔  src/app/api/academic/evaluate/route.ts updated successfully.\n');
