import type { JourneyDocumentSnapshot } from '@/lib/research-objects/types';
import { WORKFLOW_STAGES, type WorkflowOutput, type WorkflowStage } from '@/lib/research-workflow';

/** A saved stage's content as an object, whether it was stored as JSON text or as an object. */
export function parseJourneyOutput(content: JourneyDocumentSnapshot['content']): WorkflowOutput | null {
  if (!content) return null;
  if (typeof content === 'object' && !Array.isArray(content)) return content as WorkflowOutput;
  if (typeof content !== 'string') return null;
  try {
    const value: unknown = JSON.parse(content);
    return value && typeof value === 'object' && !Array.isArray(value) ? value as WorkflowOutput : null;
  } catch { return null; }
}

/** Each stage's output, taking the first document of its type: callers order them newest first. */
export function journeyOutputs(documents: JourneyDocumentSnapshot[]) {
  const outputs: Partial<Record<WorkflowStage, WorkflowOutput>> = {};
  for (const stage of WORKFLOW_STAGES) {
    const document = documents.find((item) => item.type === `journey:${stage}`);
    const output = parseJourneyOutput(document?.content ?? null);
    if (output) outputs[stage] = output;
  }
  return outputs;
}
