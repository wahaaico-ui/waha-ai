import { claimIsAnchored, type SavedWritingDraft } from '@/lib/evidence-writing';
import type { CitationStyle } from '@/lib/citations/types';
import { buildWritingCitationPlan, citationIssueText, writingCitationDisplay, WRITING_STYLE_LABELS } from '@/lib/citations/writing-citations';
import { richWritingCitationBlocks } from '@/lib/writing-rich-citations';
import type { ProjectExportModel } from '@/lib/project-export';
import { inferDocumentDirection } from '@/lib/document-direction';

export function writingExportModel(draft: SavedWritingDraft, language: 'ar' | 'en' = 'ar', citationStyle?: CitationStyle): ProjectExportModel {
  const ar = language === 'ar';
  const label = (index: number) => `${ar ? 'الدليل' : 'Evidence'} ${index + 1}`;
  const plan = buildWritingCitationPlan(draft, {}, citationStyle);
  const draftText = plan.segments.map(s => { const d = writingCitationDisplay(s); return d.text + (d.inText ? ` ${d.inText}` : '') + d.suffix; }).join('');
  const relations = ar ? { supports: 'يدعم', contradicts: 'يعارض', contextual: 'سياق', unclear: 'غير محسوم' } : { supports: 'Supports', contradicts: 'Contradicts', contextual: 'Context', unclear: 'Unclear' };
  return { language, documentDirection: inferDocumentDirection(draft.text), citationStyle: plan.style, title: ar ? 'الكتابة المرتبطة بالدليل' : 'Evidence-linked writing', notice: ar ? 'المقاطع مرتبطة بالنصوص المحفوظة؛ علاقة الدليل بالادعاء يحددها الباحث.' : 'Passages link to saved source text; the researcher determines how each passage relates to the claim.', sections: [
    { title: ar ? 'المسودة' : 'Draft', paragraphs: [draftText], ...(draft.richText ? { blocks: richWritingCitationBlocks(draft.richText, plan) } : {}) },
    ...(plan.notes?.length ? [{ title: ar ? 'الحواشي' : 'Notes', paragraphs: plan.notes.map((note, index) => `(${index + 1}) ${note}`) }] : []),
    ...(plan.bibliography.length ? [{ title: `${ar ? 'المراجع المستشهد بها في المسودة' : 'References cited in the draft'} — ${WRITING_STYLE_LABELS[plan.style]}`, paragraphs: plan.bibliography.map(entry => entry.text) }] : []),
    ...(plan.issues.length ? [{ title: ar ? 'بيانات مراجع تحتاج مراجعة' : 'Reference details to review', paragraphs: plan.issues.map(issue => citationIssueText(issue, language)) }] : []),
    ...draft.citations.map((c, i) => ({ title: `${label(i)} — ${c.source.title}`, paragraphs: [
      `${ar ? 'الادعاء' : 'Claim'}: ${c.claimText}`,
      `${ar ? 'المقطع من المصدر' : 'Source passage'}: ${c.quoteText}`,
      `${ar ? 'نوع النص' : 'Text type'}: ${c.source.kind === 'reference' ? (ar ? 'مستخلص متاح' : 'Available abstract') : (ar ? 'نص ملف مستخرج' : 'Extracted file text')}`,
      `${ar ? 'الأسطر' : 'Lines'}: ${c.firstLine}–${c.lastLine}`,
      ...(c.pdfPages ? [`${ar ? 'صفحات الملف الأصلي' : 'Original file pages'}: ${c.pdfPages.first}–${c.pdfPages.last}`] : []),
      `${ar ? 'العلاقة التي حددها الباحث' : 'Researcher-assigned relation'}: ${relations[c.relation]}`,
      ...(c.note ? [c.note] : []), ...(c.source.url ? [c.source.url] : []),
      ...(!claimIsAnchored(draft.text, c) ? [ar ? 'تغير موضع الادعاء أو نصه؛ يحتاج هذا الربط إلى مراجعة.' : 'The claim or its position changed; this link needs review.'] : []),
    ] })),
  ] };
}
