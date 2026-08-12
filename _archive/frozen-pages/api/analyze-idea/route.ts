import { NextResponse } from 'next/server';
import { IdeaAnalysisService } from '@/services/ai/idea-analysis.service';
import { ResearchPipelineService } from '@/services/research-pipeline.service';
import { AcademicThinkingService } from '@/services/academic-thinking.service';
import { AcademicReportService } from '@/services/academic-report.service';

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 200;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { ideaText } = body;

    const academicThinking = AcademicThinkingService.analyze(ideaText);

    if (!academicThinking.valid || !academicThinking.readyForSearch) {
      return NextResponse.json(
        {
          success: false,
          stage: 'academic-thinking',
          message: academicThinking.reason,
          academicThinking,
          context: null,
          research: null,
          intelligence: null,
          report: null,
        },
        { status: 400 }
      );
    }

    const response = await IdeaAnalysisService.processRequest({
      ideaText,
      userId: body.userId,
      metadata: body.metadata,
    });

    if (response.status === 'error') {
      return NextResponse.json(
        {
          success: false,
          verificationId: response.verificationId,
          message: response.message,
          error: response.error,
          context: null,
          report: null,
        },
        { status: 400 }
      );
    }

    const parsedLimit = Number.parseInt(String(body.limit ?? ''), 10);
    const limit = Number.isFinite(parsedLimit)
      ? Math.min(Math.max(parsedLimit, 1), MAX_LIMIT)
      : DEFAULT_LIMIT;

    const { context, research, intelligence, gap } = await ResearchPipelineService.search(
      ideaText,
      limit,
      academicThinking
    );

    let report = null;
    try {
      report = await AcademicReportService.generateReport(ideaText, academicThinking);
    } catch (reportError) {
      console.error('Report generation failed:', reportError);
    }

    return NextResponse.json(
      {
        success: true,
        verificationId: response.verificationId,
        message: response.message,
        data: response.data,
        nextSteps: response.data?.nextSteps || [],
        academicThinking,
        context,
        research,
        intelligence,
        gap,
        report,
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    console.error('Idea analysis error:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Server error during idea analysis',
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'An unexpected error occurred',
        },
        context: null,
        report: null,
      },
      { status: 500 }
    );
  }
}
