import {
  nextAllowedStage,
  stageComplete,
  type WorkflowOutput,
  type WorkflowStage,
  WORKFLOW_STAGES,
} from '@/lib/research-workflow';
import { readSavedWriting, WRITING_DOCUMENT_TYPE } from '@/lib/evidence-writing';
import { readSupervisorReview, SUPERVISOR_DOCUMENT_TYPE } from '@/lib/supervisor-review';
import { readLanguageTask } from '@/lib/language-task';
import { JOURNEY_STAGES } from '@/lib/research-journey';

export type DashboardProjectSource = {
  id: string;
  title: string;
  status: string | null;
  created_at: string;
};

export type DashboardJourneyDocument = {
  id?: string;
  project_id: string;
  type: string | null;
  content: unknown;
  version: number | null;
  created_at: string;
};

export type DashboardStageDraft = {
  project_id: string;
  stage: string;
  content: unknown;
  updated_at: string;
};

export const DASHBOARD_DOCUMENT_TYPES = [
  ...WORKFLOW_STAGES.map(stage => `journey:${stage}`),
  WRITING_DOCUMENT_TYPE, SUPERVISOR_DOCUMENT_TYPE, 'journey:language_task',
];

export type ResumeActivity = 'journey' | 'draft' | 'writing' | 'supervisor' | 'language';

export type ProjectResume = {
  lastActivityAt: string;
  lastStage: WorkflowStage | null;
  lastVersion: number | null;
  lastOutputPreview: string | null;
  nextStage: WorkflowStage | null;
  completedStages: number;
  totalStages: number;
  activity: ResumeActivity;
  href: string;
};

export type DashboardProject = DashboardProjectSource & { resume: ProjectResume };

function timestamp(value: string) { return Number.isFinite(Date.parse(value)) ? Date.parse(value) : 0; }

/** Immutable writing/review revisions all use version=1. Their creation time,
 * then ID, decides the latest revision; workflow stages use their version. */
export function latestDashboardDocuments<T extends Omit<DashboardJourneyDocument, 'content'>>(documents: T[]): T[] {
  const selected = new Map<string, T>();
  for (const row of documents) {
    if (!row.type || !DASHBOARD_DOCUMENT_TYPES.includes(row.type)) continue;
    const key = JSON.stringify([row.project_id, row.type]);
    const previous = selected.get(key);
    const stage = WORKFLOW_STAGES.some(stage => row.type === `journey:${stage}`);
    const version = stage ? (row.version ?? 0) - (previous?.version ?? 0) : 0;
    if (!previous || version > 0 || (version === 0 && (timestamp(row.created_at) > timestamp(previous.created_at)
      || (timestamp(row.created_at) === timestamp(previous.created_at) && (row.id ?? '') > (previous.id ?? ''))))) selected.set(key, row);
  }
  return [...selected.values()];
}

function resumePath(projectId: string, activity: ResumeActivity, stage: WorkflowStage | null) {
  const project = `projectId=${encodeURIComponent(projectId)}`;
  if (activity === 'writing' || activity === 'supervisor' || activity === 'language') return `/research/tasks?${project}&task=${activity}`;
  return `${JOURNEY_STAGES.find(item => item.id === stage)?.href || '/research/seminar'}?${project}`;
}

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
    case 'analysis_input': {
      const findings = Array.isArray(output.findings) ? output.findings : [];
      const firstFinding = findings.find((item) => item && typeof item === 'object' && !Array.isArray(item)) as Record<string, unknown> | undefined;
      return cleanPreview(firstFinding?.findingSummary) || cleanPreview(output.procedureSummary);
    }
    case 'results': {
      const results = Array.isArray(output.results) ? output.results : [];
      const firstResult = results.find((item) => item && typeof item === 'object' && !Array.isArray(item)) as Record<string, unknown> | undefined;
      return cleanPreview(firstResult?.resultStatement) || cleanPreview(output.overallSummary);
    }
    case 'discussion': {
      const discussions = Array.isArray(output.discussions) ? output.discussions : [];
      const firstDiscussion = discussions.find((item) => item && typeof item === 'object' && !Array.isArray(item)) as Record<string, unknown> | undefined;
      return cleanPreview(firstDiscussion?.interpretation) || cleanPreview(output.overallSynthesis);
    }
    case 'conclusions': {
      const conclusions = Array.isArray(output.conclusions) ? output.conclusions : [];
      const firstConclusion = conclusions.find((item) => item && typeof item === 'object' && !Array.isArray(item)) as Record<string, unknown> | undefined;
      return cleanPreview(firstConclusion?.conclusionStatement) || cleanPreview(output.overallConclusion);
    }
    case 'recommendations': {
      const recommendations = Array.isArray(output.recommendations) ? output.recommendations : [];
      const firstRecommendation = recommendations.find((item) => item && typeof item === 'object' && !Array.isArray(item)) as Record<string, unknown> | undefined;
      return cleanPreview(firstRecommendation?.recommendationText) || cleanPreview(output.overallPriorities);
    }
    case 'publication': return cleanPreview(output.targetName) || cleanPreview(output.approvedTitle);
  }
}

export function buildDashboardProjects(
  projects: DashboardProjectSource[],
  documents: DashboardJourneyDocument[],
  drafts: DashboardStageDraft[] = [],
): DashboardProject[] {
  const latestDocuments = latestDashboardDocuments(documents);
  return projects.map((project) => {
    const projectDocuments = latestDocuments
      .filter((document) => document.project_id === project.id && document.type?.startsWith('journey:'));
    const outputs: Partial<Record<WorkflowStage, WorkflowOutput>> = {};
    const canonicalDocuments: DashboardJourneyDocument[] = [];

    for (const stage of WORKFLOW_STAGES) {
      const latest = projectDocuments
        .find((document) => document.type === `journey:${stage}`);
      const output = parseOutput(latest?.content);
      if (latest) canonicalDocuments.push(latest);
      if (output) outputs[stage] = output;
    }

    const lastDocument = canonicalDocuments
      .sort((first, second) => new Date(second.created_at).getTime() - new Date(first.created_at).getTime())[0];
    const rawStage = lastDocument?.type?.replace('journey:', '');
    const lastStage = WORKFLOW_STAGES.find((stage) => stage === rawStage) ?? null;
    const lastOutput = lastStage ? parseOutput(lastDocument?.content) : null;
    const nextStage = nextAllowedStage(outputs);
    let activity: ResumeActivity = lastDocument ? 'journey' : 'writing';
    let activityStage = lastStage;
    let lastActivityAt = lastDocument?.created_at || project.created_at;
    let lastVersion = lastDocument?.version ?? null;
    let preview = lastStage ? outputPreview(lastStage, lastOutput) : null;

    const taskDocuments = latestDocuments.filter(row => row.project_id === project.id)
      .filter(row => row.type === WRITING_DOCUMENT_TYPE || row.type === SUPERVISOR_DOCUMENT_TYPE || row.type === 'journey:language_task');
    for (const row of taskDocuments) {
      if (timestamp(row.created_at) <= timestamp(lastActivityAt)) continue;
      activity = row.type === WRITING_DOCUMENT_TYPE ? 'writing' : row.type === SUPERVISOR_DOCUMENT_TYPE ? 'supervisor' : 'language';
      activityStage = null;
      lastActivityAt = row.created_at;
      lastVersion = row.version;
      preview = activity === 'writing' ? cleanPreview(readSavedWriting(row.content)?.text)
        : activity === 'supervisor' ? cleanPreview(readSupervisorReview(row.content)?.revisedText)
          : (() => { const task = readLanguageTask(row.content); return cleanPreview(task?.status === 'completed' ? task.output : task?.text); })();
    }
    for (const draft of drafts.filter(row => row.project_id === project.id)) {
      const stage = WORKFLOW_STAGES.find(stage => stage === draft.stage);
      const approved = canonicalDocuments.find(row => row.type === `journey:${stage}`);
      const content = parseOutput(draft.content);
      // Use the server save time. A client clock must not move a stale draft
      // ahead of an approved version, nor turn a draft into a completed stage.
      if (!stage || !content || timestamp(draft.updated_at) <= timestamp(lastActivityAt)
        || (approved && timestamp(draft.updated_at) <= timestamp(approved.created_at))) continue;
      activity = 'draft'; activityStage = stage; lastActivityAt = draft.updated_at; lastVersion = null;
      preview = outputPreview(stage, content);
    }

    return {
      ...project,
      resume: {
        lastActivityAt,
        lastStage: activityStage,
        lastVersion,
        lastOutputPreview: preview,
        nextStage,
        completedStages: WORKFLOW_STAGES.filter((stage) => stageComplete(stage, outputs[stage])).length,
        totalStages: WORKFLOW_STAGES.length,
        activity,
        href: resumePath(project.id, activity, activity === 'draft' ? activityStage : nextStage),
      },
    };
  }).sort((first, second) =>
    new Date(second.resume.lastActivityAt).getTime() - new Date(first.resume.lastActivityAt).getTime(),
  );
}
