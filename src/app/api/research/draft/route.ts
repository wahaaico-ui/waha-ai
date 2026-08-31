import { NextResponse } from 'next/server';
import { generateStructured } from '@/lib/ai/geminiClient';
import { ownsProject, requireAuthenticatedUser } from '@/lib/supabase/authorization';
import type { WorkflowStage } from '@/lib/research-workflow';
import { assessProblemDraft } from '@/lib/academic-content-quality';

const DRAFTABLE_STAGES = new Set<WorkflowStage>(['problem', 'objectives', 'questions', 'hypotheses', 'methodology', 'design']);

function parseDocument(content: string | null) {
  if (!content) return null;
  try {
    const parsed: unknown = JSON.parse(content);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

function parseJsonObject(value: string) {
  const cleaned = value.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('Model did not return JSON');
  const parsed: unknown = JSON.parse(cleaned.slice(start, end + 1));
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Invalid generated object');
  return parsed as Record<string, unknown>;
}

function stageInstructions(stage: WorkflowStage) {
  if (stage === 'problem') return 'أعد JSON فقط بالمفتاحين problemStatement وresearchGap. اكتب مشكلة واضحة من 70-110 كلمات تشرح الواقع والنقص المعرفي، وفجوة محتملة من 40-70 كلمة مرتبطة مباشرة بالعنوان وبالأدلة المتاحة. استخدم صياغة متحفظة ولا تدّعِ غياب الدراسات قطعياً. لا تكتب سبباً شخصياً نيابة عن الباحث.';
  if (stage === 'objectives') return 'أعد JSON فقط بالمفتاح objectives وهو مصفوفة من 3 إلى 5 أهداف عربية محددة تبدأ بأفعال قابلة للفحص، وكل هدف مرتبط بالمشكلة والفجوة.';
  if (stage === 'questions') return 'أعد JSON فقط بالمفتاح questions وهو مصفوفة أسئلة عربية؛ سؤال واحد مقابل كل هدف وبالترتيب نفسه، وكل سؤال ينتهي بعلامة استفهام.';
  if (stage === 'hypotheses') return 'أعد JSON فقط بالمفاتيح mode وhypotheses وrationale. إذا كانت الأسئلة كمية أو تختبر علاقة/أثراً، اجعل mode="required" واكتب فرضية تقريرية قابلة للاختبار مقابل كل سؤال وبالترتيب. إذا كانت كلها نوعية استكشافية، اجعل mode="not_applicable" وhypotheses=[] واكتب مبرراً منهجياً واضحاً. لا تختلق نتائج.';
  if (stage === 'design') return 'أعد JSON فقط بالمفاتيح variables وpopulation وsample. variables مصفوفة من كائنات {name,role,operationalDefinition}؛ الأدوار المسموحة independent,dependent,predictor,outcome,control,concept. للدراسة الكمية أو المختلطة حدّد متغيراً مستقلاً/متنبئاً وتابعاً/ناتجاً على الأقل، وللنوعية استخدم concept. population كائن {description,location,timeframe}. sample كائن {strategy,inclusionCriteria,sizeRationale}. لا تختلق عدداً للعينة؛ اكتب كيف سيُحدّد وفق التصميم أو تحليل القدرة أو تشبع البيانات.';
  return 'أعد JSON فقط بالمفاتيح approach وpopulation وsample وinstrument. اقترح منهجاً متسقاً مع الأسئلة، وحدد مجتمعاً وعينة وأداة بصياغة قابلة للمراجعة. لا تختر حجماً رقمياً للعينة دون بيانات حساب القوة.';
}

export async function POST(request: Request) {
  try {
    const access = await requireAuthenticatedUser();
    if (!access) return NextResponse.json({ error: 'يجب تسجيل الدخول لاستخدام المساعدة الكتابية.' }, { status: 401 });
    const body: unknown = await request.json();
    if (!body || typeof body !== 'object' || Array.isArray(body)) return NextResponse.json({ error: 'طلب غير صالح.' }, { status: 400 });
    const { projectId, stage } = body as { projectId?: unknown; stage?: unknown };
    if (typeof projectId !== 'string' || typeof stage !== 'string' || !DRAFTABLE_STAGES.has(stage as WorkflowStage)) {
      return NextResponse.json({ error: 'المشروع والمرحلة مطلوبان.' }, { status: 400 });
    }
    if (!(await ownsProject(projectId, access.user.id, access.supabase))) return NextResponse.json({ error: 'المشروع غير موجود.' }, { status: 404 });

    const { data, error } = await access.supabase.from('documents').select('type, content, version, created_at').eq('project_id', projectId).like('type', 'journey:%').order('version', { ascending: false }).order('created_at', { ascending: false });
    if (error) throw error;
    const context: Record<string, unknown> = {};
    for (const document of data || []) {
      const documentStage = document.type?.replace('journey:', '');
      if (documentStage && !(documentStage in context)) context[documentStage] = parseDocument(document.content);
    }

    const prompt = `أنت مساعد منهجي أكاديمي عربي داخل منصة WAHA. ابنِ مسودة قابلة للمراجعة اعتماداً حصراً على سجل المشروع التالي. لا تختلق مراجع أو نتائج أو أرقاماً أو حقائق غير موجودة. إذا كانت البيانات غير كافية، استخدم صياغة مقترحة متحفظة واذكر حدودها داخل النص. ${stageInstructions(stage as WorkflowStage)}\n\nسجل المشروع:\n${JSON.stringify(context).slice(0, 18_000)}`;
    const generated = await generateStructured({ prompt, projectId, userId: access.user.id, supabase: access.supabase, feature: `research-draft-${stage}` });
    const draft = parseJsonObject(generated.output);
    if (stage === 'problem') {
      const title = context.title && typeof context.title === 'object' && !Array.isArray(context.title)
        ? (context.title as Record<string, unknown>).title
        : '';
      const assessment = assessProblemDraft({
        title,
        problemStatement: draft.problemStatement,
        researchGap: draft.researchGap,
        researcherNote: '',
        requireResearcherNote: false,
      });
      if (!assessment.valid) return NextResponse.json({ error: assessment.reason || 'المسودة لا تجتاز فحص الجودة.' }, { status: 422 });
    }
    return NextResponse.json({ success: true, stage, draft, notice: stage === 'hypotheses' ? 'اقترحنا قرار الفرضيات من طبيعة أسئلتك. راجعه مع مشرفك قبل الاعتماد.' : 'أعددنا مسودة من سجل مشروعك. راجعها وصححها قبل الاعتماد.' });
  } catch {
    return NextResponse.json({ error: 'تعذر إعداد المسودة الآن. حاول مجدداً بعد قليل.' }, { status: 500 });
  }
}
