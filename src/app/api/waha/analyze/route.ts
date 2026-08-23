import { NextResponse } from 'next/server';
import { analyzeResearchIdeaReal } from '@/lib/waha-engine';
import { executeStage1_IdeaValidation } from '@/lib/waha-pipeline/stage-1-validation';
import { executeStage2And3_ProblemAndGap } from '@/lib/waha-pipeline/stage-2-problem-gap';
import { executeStage4And5_ObjectivesAndQuestions } from '@/lib/waha-pipeline/stage-4-5-objectives-questions';
import { executeStage6_Hypothesis } from '@/lib/waha-pipeline/stage-6-hypothesis';
import { executeStage7to9_Methodology } from '@/lib/waha-pipeline/stage-7-9-methodology';
import { executeStage10_Instrument } from '@/lib/waha-pipeline/stage-10-instrument';
import { executeStage11And12_AnalysisAndResults } from '@/lib/waha-pipeline/stage-11-12-analysis-results';
import { executeStage13And14_DiscussionAndRecommendations } from '@/lib/waha-pipeline/stage-13-14-discussion-recommendations';
import { executeStage15_Publishing } from '@/lib/waha-pipeline/stage-15-publishing';
import { generateAdvancedSuite } from '@/lib/waha-pipeline/advanced-academic-suite';
import { formatAcademicReferences } from '@/lib/waha-pipeline/references-formatter';
import { requireAuthenticatedUser } from '@/lib/supabase/authorization';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { query } = body;
    const access = await requireAuthenticatedUser();
    if (!access) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const stage1 = await executeStage1_IdeaValidation(query);
    if (!stage1.academicValid) return NextResponse.json({ error: stage1.rejectionReason }, { status: 400 });

    const engineResult = await analyzeResearchIdeaReal(stage1.rawInput);

    const stage2_3 = executeStage2And3_ProblemAndGap(stage1.rawInput, engineResult.papers);
    if (!stage2_3.qualityGatePassed) return NextResponse.json({ error: stage2_3.reason }, { status: 400 });

    const stage4_5 = await executeStage4And5_ObjectivesAndQuestions(stage1.rawInput);
    const stage6 = executeStage6_Hypothesis(stage1.rawInput, stage4_5.questions);
    if (!stage6.qualityGatePassed) return NextResponse.json({ error: stage6.reason }, { status: 400 });

    const stage7_9 = executeStage7to9_Methodology(stage1.rawInput, stage6);
    if (!stage7_9.qualityGatePassed) return NextResponse.json({ error: stage7_9.reason }, { status: 400 });

    const stage10 = executeStage10_Instrument(stage1.rawInput, stage7_9);
    if (!stage10.qualityGatePassed) return NextResponse.json({ error: stage10.reason }, { status: 400 });

    const stage11_12 = executeStage11And12_AnalysisAndResults(stage1.rawInput, stage10);
    if (!stage11_12.qualityGatePassed) return NextResponse.json({ error: stage11_12.reason }, { status: 400 });

    const stage13_14 = executeStage13And14_DiscussionAndRecommendations(stage1.rawInput, stage11_12);
    if (!stage13_14.qualityGatePassed) return NextResponse.json({ error: stage13_14.reason }, { status: 400 });

    const stage15 = await executeStage15_Publishing(stage13_14);
    const advancedSuite = generateAdvancedSuite(
      stage1.rawInput,
      stage2_3.problemStatement,
      stage2_3.researchGap,
      engineResult.papers
    );

    const formattedReferencesReport = formatAcademicReferences(engineResult.papers);

    if (access) {
      await access.supabase.from('projects').insert({
        user_id: access.user.id,
        title: stage1.rawInput,
        status: 'Completed (15 Stages + APA 7th References)'
      });
    }

    return NextResponse.json({
      success: true,
      idea: stage1.rawInput,
      ...advancedSuite,
      ...formattedReferencesReport,
      problemStatement: stage2_3.problemStatement,
      researchGap: stage2_3.researchGap,
      objectives: stage4_5.objectives,
      questions: stage4_5.questions,
      hypotheses: stage6.hypotheses,
      researchMethodology: stage7_9.researchMethodology,
      populationAndSample: stage7_9.populationAndSample,
      researchInstrument: stage10.researchInstrument,
      instrumentDimensions: stage10.instrumentDimensions,
      statisticalAnalysis: stage11_12.statisticalAnalysis,
      keyResults: stage11_12.keyResults,
      discussion: stage13_14.discussion,
      recommendations: stage13_14.recommendations,
      publishingPackage: stage15.data,
      totalPapersFound: engineResult.totalPapersFound,
      latestYear: engineResult.latestYear,
      papers: engineResult.papers
    });

  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'خطأ غير معروف.' }, { status: 500 });
  }
}
