import {
  nextAllowedStage,
  stageComplete,
  type WorkflowOutput,
  type WorkflowStage,
  WORKFLOW_STAGES,
} from '@/lib/research-workflow';

export type DashboardProjectSource = {
  id: string;
  title: string;
  status: string | null;
  created_at: string;
};

export type DashboardJourneyDocument = {
  project_id: string;
  type: string | null;
  content: unknown;
  version: number | null;
  created_at: string;
};

export type ProjectResume = {
  lastActivityAt: string;
  lastStage: WorkflowStage | null;
  lastVersion: number | null;
  lastOutputPreview: string | null;
  nextStage: WorkflowStage | null;
  completedStages: number;
};

export type DashboardProject = DashboardProjectSource & { resume: ProjectResume };

function parseOutput(content: unknown): WorkflowOutput | null {
  if (content && typeof content === 'object' && !Array.isArray(content)) return content as WorkflowOutput;
  if (typeof content !== 'string') return null;
  try {
    const parsed: unknown = JSON.parse(content);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as WorkflowOutput : null;
  } catch {
    return null;
  }
}

function cleanPreview(value: unknown) {
  if (typeof value !== 'string') return null;
  const cleaned = value.replace(/\s+/g, ' ').trim();
  if (!cleaned) return null;
  return cleaned.length > 160 ? `${cleaned.slice(0, 157)}…` : cleaned;
}

function firstText(value: unknown) {
  if (!Array.isArray(value)) return null;
  return cleanPreview(value.find((item) => typeof item === 'string'));
}

function outputPreview(stage: WorkflowStage, output: WorkflowOutput | null) {
  if (!output) return null;
  switch (stage) {
    case 'verify': {
      const selected = output.selectedResearchPath;
      const selectedTitle = selected && typeof selected === 'object'
        ? cleanPreview((selected as Record<string, unknown>).title)
        : null;
      return selectedTitle || cleanPreview(output.topic);
    }
    case 'title': return cleanPreview(output.title);
    case 'problem': return cleanPreview(output.problemStatement) || cleanPreview(output.researchGap);
    case 'objectives': return firstText(output.objectives);
    case 'questions': return firstText(output.questions);
    case 'hypotheses': return output.mode === 'not_applicable' ? cleanPreview(output.rationale) : firstText(output.hypotheses);
    case 'methodology': return cleanPreview(output.population) || cleanPreview(output.approach);
    case 'design': {
      const firstVariable = Array.isArray(output.variables) ? output.variables[0] : null;
      return firstVariable && typeof firstVariable === 'object'
        ? cleanPreview((firstVariable as Record<string, unknown>).name)
        : null;
    }
    case 'instrument': return cleanPreview(output.title) || (() => {
      const firstSection = Array.isArray(output.sections) ? output.sections[0] : null;
      return firstSection && typeof firstSection === 'object' ? cleanPreview((firstSection as Record<string, unknown>).title) : null;
    })();
    case 'literature': {
      const firstPaper = Array.isArray(output.papers) ? output.papers[0] : null;
      return firstPaper && typeof firstPaper === 'object'
        ? cleanPreview((firstPaper as Record<string, unknown>).title)
        : null;
    }
    case 'analysis': return cleanPreview(output.introduction) || cleanPreview(output.conclusion);
  }
}

export function buildDashboardProjects(
  projects: DashboardProjectSource[],
  documents: DashboardJourneyDocument[],
): DashboardProject[] {
  return projects.map((project) => {
    const projectDocuments = documents
      .filter((document) => document.project_id === project.id && document.type?.startsWith('journey:'))
      .sort((first, second) => new Date(second.created_at).getTime() - new Date(first.created_at).getTime());
    const outputs: Partial<Record<WorkflowStage, WorkflowOutput>> = {};

    for (const stage of WORKFLOW_STAGES) {
      const latest = projectDocuments.find((document) => document.type === `journey:${stage}`);
      const output = parseOutput(latest?.content);
      if (output) outputs[stage] = output;
    }

    const lastDocument = projectDocuments.find((document) =>
      WORKFLOW_STAGES.some((stage) => document.type === `journey:${stage}`),
    );
    const rawStage = lastDocument?.type?.replace('journey:', '');
    const lastStage = WORKFLOW_STAGES.find((stage) => stage === rawStage) ?? null;
    const lastOutput = lastStage ? parseOutput(lastDocument?.content) : null;

    return {
      ...project,
      resume: {
        lastActivityAt: lastDocument?.created_at || project.created_at,
        lastStage,
        lastVersion: lastDocument?.version ?? null,
        lastOutputPreview: lastStage ? outputPreview(lastStage, lastOutput) : null,
        nextStage: nextAllowedStage(outputs),
        completedStages: WORKFLOW_STAGES.filter((stage) => stageComplete(stage, outputs[stage])).length,
      },
    };
  }).sort((first, second) =>
    new Date(second.resume.lastActivityAt).getTime() - new Date(first.resume.lastActivityAt).getTime(),
  );
}
