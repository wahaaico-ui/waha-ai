import { isStage, type WorkflowStage } from '@/lib/research-workflow';

const MAX_EMAIL_CONTENT_LENGTH = 20_000;

const STAGE_LABELS: Record<WorkflowStage, { ar: string; en: string }> = {
  verify: { ar: 'استكشاف المسار البحثي', en: 'Research exploration' },
  title: { ar: 'صياغة العنوان', en: 'Research title' },
  problem: { ar: 'المشكلة والفجوة', en: 'Problem and gap' },
  objectives: { ar: 'الأهداف', en: 'Objectives' },
  questions: { ar: 'الأسئلة', en: 'Questions' },
  hypotheses: { ar: 'قرار الفرضيات', en: 'Hypotheses decision' },
  methodology: { ar: 'المنهجية', en: 'Methodology' },
  design: { ar: 'تصميم الدراسة', en: 'Study design' },
  instrument: { ar: 'أداة الدراسة', en: 'Research instrument' },
  literature: { ar: 'الأدلة والأدبيات', en: 'Evidence and literature' },
  analysis: { ar: 'تحليل الأدبيات', en: 'Literature synthesis' },
  analysis_input: { ar: 'مخرجات التحليل الخارجي', en: 'External analysis outputs' },
  results: { ar: 'النتائج', en: 'Results' },
  discussion: { ar: 'مناقشة النتائج', en: 'Results discussion' },
};

const FIELD_LABELS: Record<string, string> = {
  topic: 'الموضوع',
  title: 'العنوان',
  rationale: 'المبرر العلمي',
  problemStatement: 'مشكلة البحث',
  researchGap: 'الفجوة البحثية',
  researcherVoice: 'صوت الباحث',
  objectives: 'الأهداف',
  questions: 'الأسئلة',
  hypotheses: 'الفرضيات',
  mode: 'قرار استخدام الفرضيات',
  approach: 'المنهج',
  population: 'مجتمع الدراسة',
  sample: 'العينة',
  variables: 'المتغيرات أو المفاهيم',
  sections: 'محاور الأداة',
  consentStatement: 'موافقة المشارك',
  instructions: 'تعليمات الأداة',
  operationalDefinition: 'التعريف الإجرائي',
  strategy: 'استراتيجية العينة',
  inclusionCriteria: 'معايير الاشتمال',
  sizeRationale: 'مبرر حجم العينة',
  papers: 'الأدلة المختارة',
  introduction: 'المقدمة',
  conclusion: 'الخلاصة',
  analysisKind: 'نوع التحليل الخارجي',
  analyzedBy: 'من نفّذ التحليل',
  softwareOrMethod: 'أداة أو طريقة التحليل',
  sampleAnalyzed: 'ملخص البيانات المحللة',
  procedureSummary: 'إجراءات التحليل',
  findings: 'المخرجات المرتبطة بالأسئلة',
  questionText: 'سؤال البحث',
  hypothesisText: 'الفرضية المقابلة',
  findingSummary: 'خلاصة المخرج',
  evidenceSummary: 'الدليل التحليلي الملخص',
  limitations: 'حدود التحليل',
  results: 'النتائج المرتبطة بالأسئلة',
  sourceFindingSummary: 'المخرج التحليلي المعتمد',
  sourceEvidenceSummary: 'الدليل التحليلي المعتمد',
  resultStatement: 'صياغة النتيجة',
  overallSummary: 'الخلاصة العامة للنتائج',
  discussions: 'مناقشة النتائج المرتبطة بالأسئلة',
  interpretation: 'تفسير النتيجة',
  literatureComparison: 'المقارنة بالأدبيات',
  supportingPaperIds: 'معرّفات الأدلة المستخدمة',
  overallSynthesis: 'الخلاصة التفسيرية للمناقشة',
  limitationsInterpretation: 'أثر الحدود في التفسير',
};

export type ProjectSnapshotEmailInput = {
  researcherName: string;
  projectTitle: string;
  stage: string;
  version: number;
  savedAt: string;
  content: unknown;
  dashboardUrl: string;
};

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function cleanText(value: string) {
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim();
}

function parseContent(content: unknown): unknown {
  if (typeof content !== 'string') return content;
  try {
    return JSON.parse(content) as unknown;
  } catch {
    return content;
  }
}

function readableLines(value: unknown, depth = 0): string[] {
  if (depth > 4 || value === null || value === undefined) return [];
  if (typeof value === 'string') {
    const text = cleanText(value);
    return text ? [text] : [];
  }
  if (typeof value === 'number' || typeof value === 'boolean') return [String(value)];
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => readableLines(item, depth + 1).map((line) => `${index + 1}. ${line}`));
  }
  if (typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>).flatMap(([key, item]) => {
      const lines = readableLines(item, depth + 1);
      if (!lines.length) return [];
      const label = FIELD_LABELS[key] || key.replace(/([a-z])([A-Z])/g, '$1 $2');
      return [`${label}:`, ...lines.map((line) => `  ${line}`)];
    });
  }
  return [];
}

function safeUrl(input: string) {
  try {
    const url = new URL(input);
    return url.protocol === 'https:' ? url.toString() : 'https://waha-ai.vercel.app/dashboard';
  } catch {
    return 'https://waha-ai.vercel.app/dashboard';
  }
}

export function buildProjectSnapshotEmail(input: ProjectSnapshotEmailInput) {
  const rawStage = input.stage.replace('journey:', '');
  const stage = isStage(rawStage) ? rawStage : null;
  const stageLabel = stage ? STAGE_LABELS[stage].ar : 'آخر مخرج محفوظ';
  const contentText = readableLines(parseContent(input.content)).join('\n').slice(0, MAX_EMAIL_CONTENT_LENGTH)
    || 'لا يتوفر نص قابل للعرض في هذه النسخة.';
  const dashboardUrl = safeUrl(input.dashboardUrl);
  const name = cleanText(input.researcherName).slice(0, 120) || 'الباحث';
  const projectTitle = cleanText(input.projectTitle).slice(0, 300) || 'مشروع بحثي';
  const savedAt = Number.isNaN(new Date(input.savedAt).getTime())
    ? input.savedAt
    : new Date(input.savedAt).toLocaleString('ar-SA', { dateStyle: 'medium', timeStyle: 'short' });
  const subject = `WAHA — النسخة ${input.version} من ${projectTitle}`.slice(0, 180);
  const text = [
    `مرحباً ${name}،`,
    '',
    'هذه نسخة من آخر مخرج محفوظ في رحلتك البحثية على WAHA.',
    `المشروع: ${projectTitle}`,
    `المرحلة: ${stageLabel}`,
    `رقم النسخة: ${input.version}`,
    `تاريخ الحفظ: ${savedAt}`,
    '',
    contentText,
    '',
    `تابع مشروعك بأمان: ${dashboardUrl}`,
    '',
    'أُرسلت هذه الرسالة بناءً على طلبك من داخل حسابك في WAHA.',
  ].join('\n');
  const htmlContent = escapeHtml(contentText).replaceAll('\n', '<br />');

  return {
    subject,
    text,
    html: `<!doctype html><html lang="ar" dir="rtl"><body style="margin:0;background:#f8fafc;color:#10213c;font-family:Arial,sans-serif"><div style="max-width:680px;margin:0 auto;padding:32px 18px"><div style="background:#0b2551;color:#fff;border-radius:20px;padding:24px"><div style="font-size:22px;font-weight:800">WAHA AI</div><p style="margin:10px 0 0;color:#dbeafe">نسختك البحثية المحفوظة</p></div><div style="background:#fff;border:1px solid #dbe3ef;border-radius:20px;margin-top:16px;padding:24px"><h1 style="font-size:22px;margin:0 0 16px">مرحباً ${escapeHtml(name)}</h1><p style="line-height:1.9">هذه نسخة من آخر مخرج محفوظ في رحلتك البحثية.</p><div style="background:#eff6ff;border-radius:14px;padding:16px;line-height:1.9"><strong>المشروع:</strong> ${escapeHtml(projectTitle)}<br /><strong>المرحلة:</strong> ${escapeHtml(stageLabel)}<br /><strong>رقم النسخة:</strong> ${input.version}<br /><strong>تاريخ الحفظ:</strong> ${escapeHtml(savedAt)}</div><div style="margin-top:18px;border:1px solid #e2e8f0;border-radius:14px;padding:18px;line-height:1.9;white-space:normal">${htmlContent}</div><a href="${escapeHtml(dashboardUrl)}" style="display:inline-block;margin-top:20px;background:#2563eb;color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:700">متابعة المشروع</a><p style="margin-top:22px;color:#64748b;font-size:12px;line-height:1.7">أُرسلت هذه الرسالة بناءً على طلبك من داخل حسابك في WAHA. لا تشاركها إذا كانت تحتوي على مادة بحثية خاصة.</p></div></div></body></html>`,
  };
}
