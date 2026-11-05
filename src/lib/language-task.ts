import { createHash } from 'node:crypto';
import { normalizeLanguageOutput } from './language-output';

export type LanguageTask = { operation: 'translate' | 'proofread'; text: string; targetLanguage: 'ar' | 'en'; output: string; status: 'pending' | 'completed'; generatedAt?: string };

// Stable identity for an identical request within an owned project. Retries do
// not create another document, and different inputs never overwrite one another.
export function languageTaskId(projectId: string, task: Pick<LanguageTask, 'operation' | 'text' | 'targetLanguage'>) {
  const hash = createHash('sha256').update(JSON.stringify([projectId, task.operation, task.targetLanguage, task.text])).digest('hex');
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-5${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}

export function readLanguageTask(content: unknown): LanguageTask | null {
  try {
    const value = typeof content === 'string' ? JSON.parse(content) : content;
    if (!value || !['translate', 'proofread'].includes(value.operation) || !['ar', 'en'].includes(value.targetLanguage)
      || typeof value.text !== 'string' || typeof value.output !== 'string' || !['pending', 'completed'].includes(value.status)) return null;
    return { ...value, output: value.status === 'completed' ? normalizeLanguageOutput(value.output) : value.output } as LanguageTask;
  } catch { return null; }
}
