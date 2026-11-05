import { samplePlanTitle, type SampleLanguage, type SamplePlan } from './sample-size-planning';

export function sampleFlow(plan: SamplePlan, language: SampleLanguage) {
  const ar = language === 'ar', { input, completed, contacts } = plan.result;
  const pick = (a: string, e: string) => ar ? a : e;
  const perGroup = plan.kind === 'hypothesis' ? plan.result.perGroup : null;
  const settings = plan.kind === 'survey'
    ? `${pick('الثقة', 'Confidence')} ${plan.result.input.confidence}% · ±${plan.result.input.marginPercent}% · p=${plan.result.input.proportionPercent/100}`
    : plan.result.input.method === 'green'
      ? `k=${plan.result.input.predictors} · ${plan.result.input.target} · Green (1991)`
      : `α=${plan.result.input.alpha} · ${pick('قوة مستهدفة', 'Target power')} ${plan.result.input.power}% · ${plan.result.input.method === 't-test' ? 'd' : 'r'}=${plan.result.input.effect}`;
  const scope = plan.kind === 'survey' ? pick('عينة عشوائية بسيطة لتقدير نسبة واحدة؛ تأثير التصميم = 1.', 'Simple random sampling for one proportion; design effect = 1.') : plan.result.input.method === 'green' ? pick('قاعدة إرشادية لعلاقة متوسطة؛ لا تثبت قوة إحصائية محددة.', 'Medium-effect heuristic; no selected power is established.') : pick('تقدير أولي تقريبي؛ يلزم التحقق بتحليل قدرة دقيق قبل الاعتماد.', 'Preliminary approximation; verify with an exact power analysis before adoption.');
  const nodes = [
    { label: pick('حجم المجتمع', 'Population size'), value: input.population === null ? pick('غير محدد', 'Unspecified') : String(input.population), detail: plan.kind === 'survey' ? pick('المجتمع المحدود يدخل في تصحيح كوكران عند السحب دون إرجاع.', 'A finite population enters the Cochran correction for sampling without replacement.') : pick('لفحص إمكانية التجنيد فقط؛ لا يُطبق تصحيح على اختبار الفرضية.', 'Recruitment feasibility only; no correction to the hypothesis estimate.') },
    { label: pick('المكتملون المطلوبون', 'Completed cases needed'), value: String(completed), detail: perGroup === null ? pick('العدد المستهدف للتحليل، وليس عدد الدعوات.', 'Target analyzable cases, not invitations.') : pick(`${perGroup} لكل مجموعة × مجموعتين مستقلتين متساويتين.`, `${perGroup} per group × two independent equal groups.`) },
    { label: pick('الدعوات المطلوبة', 'Invitations needed'), value: String(contacts), detail: `${pick('استجابة متوقعة', 'Expected response')} ${input.responsePercent}%. ${pick('تقدير تخطيطي لا يضمن الاستجابة.', 'Planning estimate, not a response guarantee.')}` },
  ];
  const warning = !plan.result.feasible ? pick('غير قابل للتنفيذ من المجتمع المدخل: عدد الدعوات يتجاوز حجمه.', 'Infeasible for the supplied population: invitations exceed its size.') : '';
  return { title: samplePlanTitle(plan, language), settings, scope, nodes, warning, response: input.responsePercent };
}
