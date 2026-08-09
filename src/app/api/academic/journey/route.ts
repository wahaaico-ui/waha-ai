import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { researcherId, currentStep, stepData } = await req.json();

    if (!researcherId) {
      return NextResponse.json({ success: false, error: 'معرف الباحث مفقود' }, { status: 400 });
    }

    // هنا يتم محاكاة حفظ وتحديث حالة رحلة الباحث في قاعدة البيانات (Supabase)
    // خطوات الرحلة المعتمدة في WAHA:
    // 1. IDEA_SUBMISSION (الفكرة الخام)
    // 2. BRAIN_EVALUATION (تقييم المشرف)
    // 3. REFINED_IDEA (الفكرة المحدثة)
    // 4. LITERATURE_EVIDENCE (طبقة الأدلة والأدبيات)
    // 5. RESEARCH_GAP (تحديد الفجوة)
    // 6. METHODOLOGY (المنهجية)

    const journeyState = {
      researcherId,
      lastUpdated: new Date().toISOString(),
      completedStep: currentStep,
      dataStored: stepData,
      nextAllowedStep: getNextStep(currentStep)
    };

    return NextResponse.json({ success: true, journeyState });

  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || 'خطأ في حفظ رحلة البحث' }, { status: 500 });
  }
}

function getNextStep(current: string): string {
  switch (current) {
    case 'IDEA_SUBMISSION': return 'BRAIN_EVALUATION';
    case 'BRAIN_EVALUATION': return 'LITERATURE_EVIDENCE';
    case 'LITERATURE_EVIDENCE': return 'RESEARCH_GAP';
    case 'RESEARCH_GAP': return 'METHODOLOGY';
    default: return 'COMPLETED';
  }
}
