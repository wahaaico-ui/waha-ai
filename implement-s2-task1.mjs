import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();

function dir(p) { mkdirSync(join(ROOT, p), { recursive: true }); }
function write(p, c) {
  writeFileSync(join(ROOT, p), c.trimStart() + '\n', 'utf-8');
  console.log('  ✔  ' + p);
}

console.log('\n╔══════════════════════════════════════════════════════════════╗');
console.log('║   WAHA  Sprint 2  Task 1  —  Unified Evaluation API Route    ║');
console.log('╚══════════════════════════════════════════════════════════════╝\n');

dir('src/app/api/academic/evaluate');

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// FILE 1 — API Route (Next.js App Router)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
write('src/app/api/academic/evaluate/route.ts', `
import { NextResponse } from 'next/server';
import { AcademicDecisionEngine } from '@/lib/academic/core/decision/AcademicDecisionEngine';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { text } = body;

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return NextResponse.json(
        { error: 'النص المدخل مطلوب ويجب أيكون فارغاً' },
        { status: 400 }
      );
    }

    const engine = new AcademicDecisionEngine();
    const report = engine.evaluate(text);

    return NextResponse.json({
      success: true,
      data: report
    });
  } catch (error) {
    console.error('API Evaluation Error:', error);
    return NextResponse.json(
      { error: 'حدث خطأ داخلي أثناء معالجة الطلب الأكاديمي' },
      { status: 500 }
    );
  }
}
`);

console.log('\n✅ Sprint 2 Task 1 implementation completed successfully.\n');
