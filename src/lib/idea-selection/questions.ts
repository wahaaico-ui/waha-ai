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

/**
 * Quick answers to the access, data and time questions, given beside their
 * open answers so they can order the research paths (DOC-23-03).
 */
export const REACH_CHOICES = ['yes', 'partly', 'no'] as const;
export const TIME_CHOICES = ['short', 'medium', 'long'] as const;
export type Reach = typeof REACH_CHOICES[number];
export type TimeBudget = typeof TIME_CHOICES[number];
export type Constraints = { access?: Reach; data?: Reach; time?: TimeBudget };
export type ConstraintId = keyof Constraints;

/** How each quick answer is offered beside its question. */
export const CHOICE_OPTIONS: Record<ConstraintId, ReadonlyArray<{ value: Reach | TimeBudget; label: string }>> = {
  access: [{ value: 'yes', label: 'نعم' }, { value: 'partly', label: 'جزئيًا' }, { value: 'no', label: 'لا' }],
  data: [{ value: 'yes', label: 'نعم' }, { value: 'partly', label: 'جزئيًا' }, { value: 'no', label: 'لا' }],
  time: [{ value: 'short', label: 'أقل من ستة أشهر' }, { value: 'medium', label: 'من ستة أشهر إلى سنة' }, { value: 'long', label: 'أكثر من سنة' }],
};

/** How each quick answer reads in a summary or a reason. */
export const ACCESS_LABELS: Record<Reach, string> = { yes: 'ممكن', partly: 'ممكن جزئيًا', no: 'غير ممكن' };
export const DATA_LABELS: Record<Reach, string> = { yes: 'متاحة', partly: 'متاحة جزئيًا', no: 'غير متاحة' };
export const TIME_LABELS: Record<TimeBudget, string> = { short: 'أقل من ستة أشهر', medium: 'من ستة أشهر إلى سنة', long: 'أكثر من سنة' };

const isReach = (value: unknown): value is Reach => (REACH_CHOICES as readonly unknown[]).includes(value);
const isTime = (value: unknown): value is TimeBudget => (TIME_CHOICES as readonly unknown[]).includes(value);

/** The offered choices only; an absent or empty choice is unanswered, anything else rejects the set. */
export function parseConstraints(value: unknown): Constraints | null {
  if (value === undefined || value === null) return {};
  if (typeof value !== 'object' || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  const constraints: Constraints = {};
  for (const key of ['access', 'data'] as const) {
    const choice = input[key];
    if (choice === undefined || choice === '') continue;
    if (!isReach(choice)) return null;
    constraints[key] = choice;
  }
  const time = input.time;
  if (time !== undefined && time !== '') {
    if (!isTime(time)) return null;
    constraints.time = time;
  }
  return constraints;
}

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
