/** Documents row type holding the researcher's answers and path ratings. */
export const IDEA_SELECTION_TYPE = 'idea-selection:v1';

/** Five fixed questions asked before the idea is fixed (DOC-23-04). Not generated. */

export const OPEN_QUESTIONS = [
  { id: 'interest', text: 'ما الذي يهمك فعلًا في هذا الموضوع؟' },
  { id: 'problem', text: 'ما المشكلة التي رأيتها بنفسك في الواقع؟' },
  { id: 'access', text: 'هل تستطيع الوصول إلى الأشخاص أو الحالات التي ستدرسها؟' },
  { id: 'data', text: 'هل البيانات التي تحتاجها متاحة لك؟' },
  { id: 'time', text: 'كم من الوقت لديك لإنجاز البحث؟' },
] as const;

export type QuestionId = typeof OPEN_QUESTIONS[number]['id'];
export type Answers = Partial<Record<QuestionId, string>>;

const MAX_ANSWER = 1_000;
const IDS = new Set<string>(OPEN_QUESTIONS.map(q => q.id));

/** Trimmed answers to known questions; unknown keys are ignored, oversized answers reject the set. */
export function parseAnswers(value: unknown): Answers | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const answers: Answers = {};
  for (const [key, raw] of Object.entries(value)) {
    if (!IDS.has(key)) continue;
    if (typeof raw !== 'string' || raw.length > MAX_ANSWER || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(raw)) return null;
    const text = raw.trim();
    if (text) answers[key as QuestionId] = text;
  }
  return answers;
}
