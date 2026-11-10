/**
 * Journal reviewer comments and the researcher's point-by-point responses
 * (DOC-29-06). Handled like supervisor notes: each comment is addressed,
 * declined with a reason, or still open.
 */

export const JOURNAL_REVIEW_TYPE = 'journal-review:v1';

export const REVIEW_DECISIONS = ['accept', 'minor', 'major', 'reject'] as const;
export const REVIEWERS = ['editor', 'reviewer-1', 'reviewer-2', 'reviewer-3', 'reviewer-4', 'reviewer-5'] as const;
export const COMMENT_STATUSES = ['open', 'addressed', 'declined'] as const;

export type ReviewDecision = typeof REVIEW_DECISIONS[number];
export type Reviewer = typeof REVIEWERS[number];
export type CommentStatus = typeof COMMENT_STATUSES[number];
export type ReviewComment = { id: string; reviewer: Reviewer; comment: string; location: string; response: string; status: CommentStatus };
export type JournalReview = { journal: string; round: number; decision: ReviewDecision; comments: ReviewComment[] };

const UUID = /^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i;
const CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/;
const clean = (value: unknown, max: number) => typeof value === 'string' && value.length <= max && !CONTROL.test(value) ? value.trim() : null;

export function parseJournalReview(value: unknown): JournalReview | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  const journal = clean(v.journal, 300);
  if (journal === null || !Number.isSafeInteger(v.round) || (v.round as number) < 1 || (v.round as number) > 20) return null;
  if (!REVIEW_DECISIONS.includes(v.decision as ReviewDecision) || !Array.isArray(v.comments) || !v.comments.length || v.comments.length > 200) return null;
  const ids = new Set<string>();
  const comments: ReviewComment[] = [];
  for (const item of v.comments) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
    const c = item as Record<string, unknown>;
    const comment = clean(c.comment, 4000), location = clean(c.location, 300), response = clean(c.response, 4000);
    if (typeof c.id !== 'string' || !UUID.test(c.id) || ids.has(c.id.toLowerCase()) || !comment || location === null || response === null) return null;
    if (!REVIEWERS.includes(c.reviewer as Reviewer) || !COMMENT_STATUSES.includes(c.status as CommentStatus)) return null;
    if (c.status !== 'open' && !response) return null;
    ids.add(c.id.toLowerCase());
    comments.push({ id: c.id, reviewer: c.reviewer as Reviewer, comment, location, response, status: c.status as CommentStatus });
  }
  return { journal, round: v.round as number, decision: v.decision as ReviewDecision, comments };
}

const TEXT = {
  ar: {
    title: (r: JournalReview) => `رسالة الرد على المحكمين${r.journal ? ` — ${r.journal}` : ''} — الجولة ${r.round}`,
    intro: 'نشكر المحرر والمحكمين على ملاحظاتهم. فيما يلي ردنا على كل ملاحظة والتعديل الذي أجريناه في المخطوط.',
    reviewer: (r: Reviewer) => r === 'editor' ? 'المحرر' : `المحكم ${r.slice(-1)}`,
    comment: 'الملاحظة', location: 'الموضع', response: 'الرد',
    status: { open: 'لم يُعالج بعد', addressed: 'عُدّل المخطوط', declined: 'لم يُعدّل، مع التوضيح' } as Record<CommentStatus, string>,
    summary: (a: number, d: number, o: number) => `الملخص: ${a} معالجة، ${d} مع توضيح دون تعديل، ${o} مفتوحة.`,
  },
  en: {
    title: (r: JournalReview) => `Response to reviewers${r.journal ? ` — ${r.journal}` : ''} — Round ${r.round}`,
    intro: 'We thank the editor and reviewers for their comments. Our response to each comment and the change made in the manuscript follow.',
    reviewer: (r: Reviewer) => r === 'editor' ? 'Editor' : `Reviewer ${r.slice(-1)}`,
    comment: 'Comment', location: 'Location', response: 'Response',
    status: { open: 'Not yet addressed', addressed: 'Manuscript revised', declined: 'Not changed, with explanation' } as Record<CommentStatus, string>,
    summary: (a: number, d: number, o: number) => `Summary: ${a} addressed, ${d} declined, ${o} open.`,
  },
};

/** A point-by-point response letter, grouped by reviewer in the order entered. */
export function buildResponseLetter(review: JournalReview, language: 'ar' | 'en'): string {
  const t = TEXT[language];
  const count = (status: CommentStatus) => review.comments.filter(c => c.status === status).length;
  const lines = [t.title(review), '', t.intro, ''];
  for (const reviewer of REVIEWERS) {
    const items = review.comments.filter(c => c.reviewer === reviewer);
    if (!items.length) continue;
    lines.push(t.reviewer(reviewer));
    items.forEach((c, index) => {
      lines.push(`${index + 1}. ${t.comment}: ${c.comment}`);
      if (c.location) lines.push(`   ${t.location}: ${c.location}`);
      lines.push(`   ${t.response}: ${c.response || '—'} (${t.status[c.status]})`);
    });
    lines.push('');
  }
  lines.push(t.summary(count('addressed'), count('declined'), count('open')));
  return lines.join('\n');
}
