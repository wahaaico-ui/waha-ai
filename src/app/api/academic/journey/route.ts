import { NextResponse } from 'next/server';
import { requireAuthenticatedUser } from '@/lib/supabase/authorization';

export async function POST(request: Request) {
  try {
    const access = await requireAuthenticatedUser();
    if (!access) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    const { currentStep, stepData } = await request.json();
    if (!currentStep) return NextResponse.json({ success: false, error: 'currentStep is required' }, { status: 400 });
    return NextResponse.json({ success: true, journeyState: { researcherId: access.user.id, lastUpdated: new Date().toISOString(), completedStep: currentStep, dataStored: stepData, nextAllowedStep: getNextStep(currentStep) } });
  } catch { return NextResponse.json({ success: false, error: 'Unable to process journey' }, { status: 500 }); }
}

function getNextStep(current: string) { return ({ IDEA_SUBMISSION: 'BRAIN_EVALUATION', BRAIN_EVALUATION: 'LITERATURE_EVIDENCE', LITERATURE_EVIDENCE: 'RESEARCH_GAP', RESEARCH_GAP: 'METHODOLOGY' } as Record<string, string>)[current] || 'COMPLETED'; }
