/**
 * How the researcher's answers steer the choice of a research path
 * (DOC-23-03, DOC-23-04). A stated table of what each path kind usually
 * needs, not a model; the researcher's own ratings are never changed.
 */
import { ACCESS_LABELS, DATA_LABELS, TIME_LABELS, type Answers, type Constraints, type Reach, type TimeBudget } from '@/lib/idea-selection/questions';

/** What a path usually needs: field data from people or cases, and time. `field: null` means the path does not say. */
type Need = { field: boolean | null; time: TimeBudget };

const PUBLISHED_STUDIES: Need = { field: false, time: 'short' };
const NOT_STATED: Need = { field: null, time: 'short' };
const NEEDS: Record<string, Need> = {
  'recent-evidence': PUBLISHED_STUDIES,
  'scope-refinement': PUBLISHED_STUDIES,
  'provided-title-comparison': PUBLISHED_STUDIES,
  'local-context': { field: true, time: 'medium' },
  replication: { field: true, time: 'medium' },
  'geographic-comparison': { field: true, time: 'long' },
};

const TIME_ORDER: Record<TimeBudget, number> = { short: 0, medium: 1, long: 2 };
const REACH_WEIGHT: Record<Reach, number> = { yes: 0, partly: 1, no: 2 };
/** A path the researcher has not rated sits between low and high passion. */
const UNRATED_PASSION = 3;

/** Text with numbered slots; each value is itself a label to translate. */
export type Reason = { text: string; values?: string[] };
export type RankedPath = { id: string; title: string; weight: number; reasons: Reason[] };

/**
 * Paths ordered by how far they exceed the researcher's time, access and data,
 * then by the researcher's passion, then by the report's order. Every move is
 * explained in the path's reasons.
 */
export function rankPathsByConstraints(
  paths: ReadonlyArray<{ id: string; title: string }>,
  constraints: Constraints,
  passion: Record<string, number | undefined> = {},
): RankedPath[] {
  const answered = Boolean(constraints.access || constraints.data || constraints.time);
  const limitedReach = [constraints.access, constraints.data].some(choice => choice === 'partly' || choice === 'no');

  return paths.map((path, index) => {
    const need = NEEDS[path.id] ?? NOT_STATED;
    const reasons: Reason[] = [];
    let weight = 0;
    if (need.field === null) {
      if (answered) reasons.push({ text: 'لا يحدد هذا المسار طريقة جمع البيانات؛ تتبع ما تختاره داخل تخصصك.' });
    } else {
      if (constraints.time) {
        const shortfall = TIME_ORDER[need.time] - TIME_ORDER[constraints.time];
        if (shortfall > 0) {
          weight += shortfall;
          reasons.push({ text: 'يحتاج عادةً {0}، والوقت المتاح لك {1}.', values: [TIME_LABELS[need.time], TIME_LABELS[constraints.time]] });
        }
      }
      if (need.field) {
        if (constraints.access && REACH_WEIGHT[constraints.access]) {
          weight += REACH_WEIGHT[constraints.access];
          reasons.push({ text: 'يحتاج الوصول إلى مشاركين أو حالات، ووصولك إليهم {0}.', values: [ACCESS_LABELS[constraints.access]] });
        }
        if (constraints.data && REACH_WEIGHT[constraints.data]) {
          weight += REACH_WEIGHT[constraints.data];
          reasons.push({ text: 'يحتاج بيانات ميدانية، وهي {0} لك.', values: [DATA_LABELS[constraints.data]] });
        }
        if (!weight && constraints.access && constraints.data && constraints.time) {
          reasons.push({ text: 'وصولك وبياناتك ووقتك تكفي لما يحتاجه هذا المسار عادةً.' });
        }
      } else if (limitedReach) {
        reasons.push({ text: 'لا يحتاج مشاركين ولا بيانات ميدانية؛ يعتمد على الدراسات المنشورة.' });
      } else if (constraints.time) {
        reasons.push({ text: 'يعتمد على الدراسات المنشورة، فيناسب الوقت المتاح لك.' });
      }
    }
    const rating = passion[path.id];
    if (rating) reasons.push({ text: 'قيّمت شغفك به {0} من 5.', values: [String(rating)] });
    return { path: { id: path.id, title: path.title, weight, reasons }, index, passion: rating ?? UNRATED_PASSION };
  })
    .sort((a, b) => a.path.weight - b.path.weight || b.passion - a.passion || a.index - b.index)
    .map(item => item.path);
}

export type NarrowingLine = { label: string; value: string; note?: string };

function adviceFor({ access, data, time }: Constraints) {
  if (time === 'short' || access === 'no' || data === 'no') return 'ابدأ بمسار يعتمد على الدراسات المنشورة أو على بيانات متاحة لك، وأجّل جمع بيانات ميدانية جديدة.';
  if (access === 'partly' || data === 'partly') return 'يمكنك جمع بيانات ميدانية على نطاق صغير: اختر مجتمعًا تصل إليه فعلًا وأداة جاهزة.';
  if (access === 'yes' && data === 'yes' && time) return 'وصولك وبياناتك ووقتك تسمح بدراسة ميدانية؛ حدّد مجتمع الدراسة ومكانها وفترتها قبل اعتماد العنوان.';
  return 'أجب عن أسئلة الوصول والبيانات والوقت ليظهر اقتراح يناسب قيودك.';
}

/**
 * An initial narrowing of the idea from the five answers and the profile:
 * the problem and the researcher's angle on it, the setting and specialty,
 * and what access, data and time allow, with one piece of advice.
 */
export function narrowingSuggestion(input: { answers: Answers; constraints: Constraints; countryName: string | null; specialty: string | null }): { lines: NarrowingLine[]; advice: string } {
  const { answers, constraints } = input;
  const lines: NarrowingLine[] = [];
  const add = (label: string, value: string | null | undefined, note?: string) => {
    const text = value?.trim();
    if (!text) return;
    const detail = note?.trim();
    lines.push(detail ? { label, value: text, note: detail } : { label, value: text });
  };
  const addChoice = (label: string, chosen: string | undefined, written: string | undefined) => (chosen ? add(label, chosen, written) : add(label, written));

  add('الظاهرة أو المشكلة', answers.problem);
  add('زاويتك فيها', answers.interest);
  add('السياق', input.countryName);
  add('التخصص', input.specialty);
  addChoice('الوصول إلى المشاركين', constraints.access && ACCESS_LABELS[constraints.access], answers.access);
  addChoice('البيانات', constraints.data && DATA_LABELS[constraints.data], answers.data);
  addChoice('الوقت المتاح', constraints.time && TIME_LABELS[constraints.time], answers.time);
  return { lines, advice: adviceFor(constraints) };
}
