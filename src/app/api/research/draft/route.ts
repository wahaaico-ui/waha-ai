import { NextResponse } from 'next/server';
import { generateStructured } from '@/lib/ai/geminiClient';
import { ownsProject, requireAuthenticatedUser } from '@/lib/supabase/authorization';
import type { WorkflowStage } from '@/lib/research-workflow';
import { assessProblemDraft } from '@/lib/academic-content-quality';
import { instrumentLabel, isStudyInstrumentType, type StudyInstrumentType } from '@/lib/research-instrument';
import { buildInstrumentDraftFallback, buildObjectivesDraftFallback, buildProblemDraftFallback } from '@/lib/research-draft-fallback';

const DRAFTABLE_STAGES = new Set<WorkflowStage>(['problem', 'objectives', 'questions', 'hypotheses', 'methodology', 'design', 'instrument']);

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

function instrumentInstructions(type: StudyInstrumentType) {
  const common = `أعد JSON فقط بالمفاتيح instrumentType وtitle وdescription وconsentStatement وinstructions وrespondentFields وsections. اجعل instrumentType="${type}". sections هي {title,variableName,description,items} وitems هي {text,kind,required,options}. اربط كل section بمتغير أو مفهوم محفوظ بالاسم نفسه تماماً. لا تدّعِ الصدق أو الثبات أو الاعتماد النهائي؛ الأداة مسودة تحتاج مراجعة أخلاقية ومنهجية وتجربة استطلاعية.`;
  if (type === 'questionnaire') return `${common} أنشئ 3-5 بنود أحادية المعنى لكل محور. kind أحد likert5,single_choice,multiple_choice,short_text,long_text. respondentFields مصفوفة اختيارية من {label,kind,required,options}، وkind إما short_text أو single_choice.`;
  if (type === 'interview') return `${common} أنشئ 2-4 أسئلة مفتوحة لكل محور مع متابعات محايدة؛ استخدم kind=long_text، وضع المتابعات المقترحة في options. تجنب الأسئلة الموحية والمزدوجة.`;
  if (type === 'observation') return `${common} أنشئ 2-5 مؤشرات سلوكية قابلة للملاحظة لكل محور؛ استخدم kind=single_choice وخيارات رصد واضحة مثل لم يُلاحظ، لوحظ مرة، لوحظ مراراً، مع خانة ملاحظات kind=long_text عند الحاجة.`;
  if (type === 'document_analysis') return `${common} أنشئ 2-5 فئات ترميز واضحة لكل محور؛ يجب أن يحدد كل بند ما الذي يبحث عنه الباحث في الوثيقة، واستخدم kind=single_choice أو multiple_choice أو long_text وفق طبيعة الترميز.`;
  return `${common} لا تنشئ أو تعيد صياغة مقياس محمي. أنشئ بدلاً من ذلك خطة اختيار وتطبيق تتضمن اسم البنية المقاسة، معايير فحص الترخيص، ملاءمة النسخة اللغوية والثقافية، تعليمات التطبيق والتصحيح، وبنود مراجعة توثيقية kind=long_text.`;
}

function stageInstructions(stage: WorkflowStage, instrumentType: StudyInstrumentType = 'questionnaire') {
  if (stage === 'problem') return 'أعد JSON فقط بالمفتاحين problemStatement وresearchGap. اكتب مشكلة واضحة من 70-110 كلمات تشرح الواقع والنقص المعرفي، وفجوة محتملة من 40-70 كلمة مرتبطة مباشرة بالعنوان وبالأدلة المتاحة. استخدم صياغة متحفظة ولا تدّعِ غياب الدراسات قطعياً. لا تكتب سبباً شخصياً نيابة عن الباحث.';
  if (stage === 'objectives') return 'أعد JSON فقط بالمفتاح objectives وهو مصفوفة من 3 إلى 5 أهداف عربية محددة تبدأ بأفعال قابلة للفحص، وكل هدف مرتبط بالمشكلة والفجوة.';
  if (stage === 'questions') return 'أعد JSON فقط بالمفتاح questions وهو مصفوفة أسئلة عربية؛ سؤال واحد مقابل كل هدف وبالترتيب نفسه، وكل سؤال ينتهي بعلامة استفهام.';
  if (stage === 'hypotheses') return 'أعد JSON فقط بالمفاتيح mode وhypotheses وrationale. إذا كانت الأسئلة كمية أو تختبر علاقة/أثراً، اجعل mode="required" واكتب فرضية تقريرية قابلة للاختبار مقابل كل سؤال وبالترتيب. إذا كانت كلها نوعية استكشافية، اجعل mode="not_applicable" وhypotheses=[] واكتب مبرراً منهجياً واضحاً. لا تختلق نتائج.';
  if (stage === 'design') return 'أعد JSON فقط بالمفاتيح variables وpopulation وsample. variables مصفوفة من كائنات {name,role,operationalDefinition}؛ الأدوار المسموحة independent,dependent,predictor,outcome,control,concept. للدراسة الكمية أو المختلطة حدّد متغيراً مستقلاً/متنبئاً وتابعاً/ناتجاً على الأقل، وللنوعية استخدم concept. population كائن {description,location,timeframe}. sample كائن {strategy,inclusionCriteria,sizeRationale}. لا تختلق عدداً للعينة؛ اكتب كيف سيُحدّد وفق التصميم أو تحليل القدرة أو تشبع البيانات.';
  if (stage === 'instrument') return instrumentInstructions(instrumentType);
  return 'أعد JSON فقط بالمفاتيح approach وpopulation وsample وinstrument. اقترح منهجاً متسقاً مع الأسئلة، وحدد مجتمعاً وعينة وأداة بصياغة قابلة للمراجعة. لا تختر حجماً رقمياً للعينة دون بيانات حساب القوة.';
}

export async function POST(request: Request) {
  try {
    const access = await requireAuthenticatedUser();
    if (!access) return NextResponse.json({ error: 'يجب تسجيل الدخول لاستخدام المساعدة الكتابية.' }, { status: 401 });
    const body: unknown = await request.json();
    if (!body || typeof body !== 'object' || Array.isArray(body)) return NextResponse.json({ error: 'طلب غير صالح.' }, { status: 400 });
    const { projectId, stage, draftOptions } = body as { projectId?: unknown; stage?: unknown; draftOptions?: unknown };
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

    const requestedInstrumentType = draftOptions && typeof draftOptions === 'object' && !Array.isArray(draftOptions)
      ? (draftOptions as Record<string, unknown>).instrumentType
      : undefined;
    const instrumentType = isStudyInstrumentType(requestedInstrumentType) ? requestedInstrumentType : 'questionnaire';
    const prompt = `أنت مساعد منهجي أكاديمي عربي داخل منصة WAHA. ابنِ مسودة قابلة للمراجعة اعتماداً حصراً على سجل المشروع التالي. لا تختلق مراجع أو نتائج أو أرقاماً أو حقائق غير موجودة. إذا كانت البيانات غير كافية، استخدم صياغة مقترحة متحفظة واذكر حدودها داخل النص. ${stageInstructions(stage as WorkflowStage, instrumentType)}\n\nسجل المشروع:\n${JSON.stringify(context).slice(0, 18_000)}`;
    let draft: Record<string, unknown>;
    let usedLocalFallback = false;
    try {
      const generated = await generateStructured({ prompt, projectId, userId: access.user.id, supabase: access.supabase, feature: `research-draft-${stage}` });
      draft = parseJsonObject(generated.output);
    } catch (reason) {
      const fallback = stage === 'problem'
        ? buildProblemDraftFallback(context)
        : stage === 'objectives'
          ? buildObjectivesDraftFallback(context)
          : stage === 'instrument'
            ? buildInstrumentDraftFallback(context, instrumentType)
          : null;
      if (!fallback) throw reason;
      console.warn('[research-draft] providers unavailable; using grounded local draft.', { stage });
      draft = fallback;
      usedLocalFallback = true;
    }
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
    return NextResponse.json({ success: true, stage, draft, notice: usedLocalFallback ? 'أعددنا مسودة محلية آمنة من عنوانك ومؤشرات مشروعك بعد تعذر مزوّد الذكاء الاصطناعي. راجعها وصححها قبل الاعتماد.' : stage === 'hypotheses' ? 'اقترحنا قرار الفرضيات من طبيعة أسئلتك. راجعه مع مشرفك قبل الاعتماد.' : stage === 'instrument' ? `أعددنا مسودة ${instrumentLabel(instrumentType)} من سجل مشروعك. راجعها وصححها قبل الاعتماد.` : 'أعددنا مسودة من سجل مشروعك. راجعها وصححها قبل الاعتماد.' });
  } catch (reason) {
    console.error('[research-draft] request failed', reason instanceof Error ? reason.message : 'unknown error');
    return NextResponse.json({ error: 'تعذر إعداد المسودة الآن. حاول مجدداً بعد قليل.' }, { status: 500 });
  }
}
