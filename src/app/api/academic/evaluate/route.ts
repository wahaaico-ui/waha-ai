import { NextResponse } from 'next/server';
import { AcademicDecisionEngine } from '@/lib/ai/geminiClient/core/decision/AcademicDecisionEngine';
import { AcademicReportGenerator } from '@/lib/ai/geminiClient/core/generator/AcademicReportGenerator';
import { GroqAcademicRefiner } from '@/lib/ai/geminiClient/core/ai/GroqAcademicRefiner';

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

    const engine = new AcademicDecisionEngine();
    const report = engine.evaluate(text);

    const generator = new AcademicReportGenerator();
    const rawReport = generator.generateReport(report);

    const refiner = new GroqAcademicRefiner();
    const professionalReportMarkdown = await refiner.refineReport(rawReport);

    return NextResponse.json({
      success: true,
      data: report,
      professionalReport: professionalReportMarkdown
    });
  } catch (error) {
    console.error('API Evaluation Error:', error);
    return NextResponse.json(
      { error: 'حدث خطأ داخلي أثناء معالجة الطلب الأكاديمي' },
      { status: 500 }
    );
  }
}