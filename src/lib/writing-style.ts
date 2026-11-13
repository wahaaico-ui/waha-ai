/**
 * The researcher's writing style, measured from a sample of their own text
 * with fixed rules (no model): sentence and paragraph length, vocabulary
 * range, recurring terms, citation format and voice (DOC-26-03). The
 * researcher reviews and edits the result and approves it before any draft
 * is written for them, and drafts then follow it (DOC-13-06). The sample
 * itself is never stored.
 */
export const STYLE_MIN_WORDS = 150;
export const STYLE_MAX_CHARS = 12_000;
const MAX_TERMS = 12;

export type SentenceLength = 'short' | 'medium' | 'long';
export type Voice = 'first' | 'third' | 'mixed' | 'unstated';
export type CitationFormat = 'author-year' | 'numeric' | 'none';
export type StyleProfile = {
  sample: { words: number };
  sentences: { count: number; averageWords: number; longShare: number };
  paragraphs: { count: number; averageSentences: number };
  vocabulary: { diversity: number };
  terms: string[];
  citations: { format: CitationFormat; perHundredWords: number };
  voice: Voice;
  sentenceLength: SentenceLength;
};
export type ApprovedStyleProfile = StyleProfile & { version: 1; approvedAt: string };
export type StyleEdits = { terms: readonly string[]; voice: 'first' | 'third'; sentenceLength: SentenceLength };

const STOP = new Set(('الباحث الباحثة الدراسة هذه_الدراسة من في على إلى الى عن أن إن ان هذا هذه ذلك تلك التي الذي الذين و أو او ثم قد لا ما لم لن كان كانت مع بين حين غير كل بعض عند لأنه لانه لذلك خلال حيث كما وقد وهو وهي هو هي هم كذلك أيضا أيضًا ' +
  'the a an of in on to for and or but with by from as at that this these those is are was were be been it its which who whom into than then also not no').split(/\s+/));
const FIRST = /(?:^|[\s(])(?:نحن|أنا|قمنا|وجدنا|نرى|نستخدم|نقترح|لاحظنا|we|our|us|i|my)(?=$|[\s,.;:)])/giu;
const THIRD = /(?:^|[\s(])(?:الباحث|الباحثة|الباحثون|وقام الباحث|ويعتمد الباحث|the researcher|the author|this study)(?=$|[\s,.;:)])/giu;
const AUTHOR_YEAR = /\([^()\n]{2,80}?[،,]\s*(?:1[89]|20)\d{2}[a-z]?\)/gu;
const NUMERIC = /\[\d+(?:\s*[,–-]\s*\d+)*\]/g;

const normalise = (word: string) => word.toLowerCase().replace(/[ً-ْـ]/g, '');
const wordsOf = (text: string) => text.match(/[\p{L}\p{M}\p{N}]+/gu) ?? [];
const round = (value: number, places = 1) => Math.round(value * 10 ** places) / 10 ** places;
const sentencesOf = (text: string) => text.split(/[.!?؟]+(?=\s|$)/u).map(part => part.trim()).filter(part => wordsOf(part).length > 0);
const lengthOf = (averageWords: number): SentenceLength => averageWords < 15 ? 'short' : averageWords <= 25 ? 'medium' : 'long';
const content = (word: string) => !STOP.has(word) && word.length >= 3 && !/^\d+$/.test(word);

/** Arabic terms are noun phrases: their first word carries the article, which leaves out verbs and adverbs. */
const termStart = (word: string) => !/[\u0600-\u06FF]/.test(word) || /^(?:ال|وال|بال|لل|فال|كال)/.test(word);

/** Words and two-word phrases that recur in at least three different sentences. */
function recurringTerms(paragraphs: string[]) {
  const unigram = new Map<string, { sentences: Set<string>; shown: string }>();
  const bigram = new Map<string, { sentences: Set<string>; shown: string; parts: [string, string] }>();
  for (const sentence of paragraphs.flatMap(sentencesOf)) {
    const words = wordsOf(sentence.replace(AUTHOR_YEAR, ' '));
    const id = words.map(normalise).join(' ');
    words.forEach((word, index) => {
      const key = normalise(word);
      if (!content(key)) return;
      const one = unigram.get(key) ?? { sentences: new Set<string>(), shown: word };
      one.sentences.add(id); unigram.set(key, one);
      const next = words[index + 1];
      const nextKey = next ? normalise(next) : '';
      if (next && content(nextKey)) {
        const pair = `${key} ${nextKey}`;
        const two = bigram.get(pair) ?? { sentences: new Set<string>(), shown: `${word} ${next}`, parts: [key, nextKey] };
        two.sentences.add(id); bigram.set(pair, two);
      }
    });
  }
  const pairs = [...bigram.values()].filter(pair => pair.sentences.size >= 3 && termStart(pair.parts[0]));
  const inPairs = new Map<string, Set<string>>();
  for (const pair of pairs) for (const part of pair.parts) inPairs.set(part, new Set([...(inPairs.get(part) ?? []), ...pair.sentences]));
  // A word is a term of its own only when it also recurs outside the phrases above.
  const singles = [...unigram.entries()].filter(([key, word]) => key.length >= 4 && termStart(key) && [...word.sentences].filter(id => !inPairs.get(key)?.has(id)).length >= 3).map(([, word]) => word);
  return [...pairs, ...singles].sort((a, b) => b.sentences.size - a.sentences.size).slice(0, 8).map(term => term.shown);
}

export function analyseWritingStyle(text: string): { ok: true; profile: StyleProfile } | { ok: false; words: number; minimum: number } {
  const sample = text.slice(0, STYLE_MAX_CHARS).replace(/\r\n?/g, '\n').trim();
  const words = wordsOf(sample);
  if (words.length < STYLE_MIN_WORDS) return { ok: false, words: words.length, minimum: STYLE_MIN_WORDS };
  const paragraphs = sample.split(/\n\s*\n/).map(part => part.trim()).filter(part => wordsOf(part).length > 0);
  const sentences = paragraphs.flatMap(sentencesOf);
  const lengths = sentences.map(sentence => wordsOf(sentence).length);
  const averageWords = round(lengths.reduce((sum, value) => sum + value, 0) / Math.max(1, lengths.length));
  const authorYear = sample.match(AUTHOR_YEAR)?.length ?? 0, numeric = sample.match(NUMERIC)?.length ?? 0;
  const first = sample.match(FIRST)?.length ?? 0, third = sample.match(THIRD)?.length ?? 0;
  return { ok: true, profile: {
    sample: { words: words.length },
    sentences: { count: sentences.length, averageWords, longShare: round(lengths.filter(value => value > 30).length / Math.max(1, lengths.length), 2) },
    paragraphs: { count: paragraphs.length, averageSentences: round(sentences.length / Math.max(1, paragraphs.length)) },
    vocabulary: { diversity: round(new Set(words.map(normalise)).size / words.length, 2) },
    terms: recurringTerms(paragraphs),
    citations: { format: authorYear === 0 && numeric === 0 ? 'none' : authorYear >= numeric ? 'author-year' : 'numeric', perHundredWords: round(((authorYear + numeric) / words.length) * 100) },
    voice: first && third ? 'mixed' : first ? 'first' : third ? 'third' : 'unstated',
    sentenceLength: lengthOf(averageWords),
  } };
}

/** The measured profile with the researcher's own edits, stamped as approved. */
export function approveStyleProfile(profile: StyleProfile, edits: StyleEdits, now: Date): ApprovedStyleProfile {
  const terms = [...new Set(edits.terms.map(term => term.replace(/\s+/g, ' ').trim()).filter(term => term.length > 0 && term.length <= 60))].slice(0, MAX_TERMS);
  return { ...profile, terms, voice: edits.voice, sentenceLength: edits.sentenceLength, version: 1, approvedAt: now.toISOString() };
}

const isCount = (value: unknown) => typeof value === 'number' && Number.isFinite(value) && value >= 0;
/** An approved profile as stored in the account, or null. */
export function readStyleProfile(value: unknown): ApprovedStyleProfile | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const p = value as Partial<ApprovedStyleProfile>;
  if (p.version !== 1 || typeof p.approvedAt !== 'string' || !Number.isFinite(Date.parse(p.approvedAt))) return null;
  if (!p.sample || !isCount(p.sample.words) || !p.sentences || !isCount(p.sentences.averageWords) || !isCount(p.sentences.count) || !isCount(p.sentences.longShare)) return null;
  if (!p.paragraphs || !isCount(p.paragraphs.count) || !isCount(p.paragraphs.averageSentences) || !p.vocabulary || !isCount(p.vocabulary.diversity)) return null;
  if (!Array.isArray(p.terms) || p.terms.length > MAX_TERMS || !p.terms.every(term => typeof term === 'string' && term.length > 0 && term.length <= 60)) return null;
  if (!p.citations || !['author-year', 'numeric', 'none'].includes(p.citations.format) || !isCount(p.citations.perHundredWords)) return null;
  if (!['first', 'third', 'mixed', 'unstated'].includes(p.voice as string) || !['short', 'medium', 'long'].includes(p.sentenceLength as string)) return null;
  return p as ApprovedStyleProfile;
}

const LENGTHS: Record<SentenceLength, string> = { short: 'جمل قصيرة (أقل من 15 كلمة غالبًا)', medium: 'جمل متوسطة (15 إلى 25 كلمة)', long: 'جمل طويلة متصلة (أكثر من 25 كلمة)' };
const VOICES: Record<Voice, string> = { first: 'بصيغة المتكلم (نحن)', third: 'بصيغة الغائب (الباحث، الدراسة)', mixed: 'بصيغة الغائب غالبًا', unstated: 'بصيغة الغائب' };

/** The approved choices as drafting rules for the model; the sample text never reaches it. */
export function styleInstruction(profile: ApprovedStyleProfile) {
  return [
    'اكتب بأسلوب الباحث المعتمد:',
    `- ${LENGTHS[profile.sentenceLength]}، ومتوسط فقرته نحو ${profile.paragraphs.averageSentences} جمل.`,
    `- ${VOICES[profile.voice]}.`,
    profile.terms.length ? `- استعمل هذه المصطلحات بلفظها حين يلزم: ${profile.terms.join('، ')}.` : '',
    `- طريقة الاستشهاد في نصوصه: ${profile.citations.format}؛ لا تضف استشهادًا غير موجود في بيانات المشروع.`,
  ].filter(Boolean).join('\n');
}
