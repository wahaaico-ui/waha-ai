import { calculateSampleSize, sampleInvitations, type SampleSizeResult } from './sample-size';

export type SampleLanguage = 'ar' | 'en';
export const SAMPLE_POWER_LEVELS = [80, 90, 95] as const;
export const SAMPLE_ALPHA_LEVELS = [0.01, 0.05, 0.1] as const;
export type PowerLevel = typeof SAMPLE_POWER_LEVELS[number];
export type AlphaLevel = typeof SAMPLE_ALPHA_LEVELS[number];
const Z_ALPHA = { 0.01: 2.5758293035489004, 0.05: 1.959963984540054, 0.1: 1.6448536269514722 };
const Z_POWER = { 80: 0.8416212335729143, 90: 1.2815515655446004, 95: 1.6448536269514722 };
type Recruitment = { population: number | null; responsePercent: number };
type Powered = { alpha: AlphaLevel; power: PowerLevel; effect: number };
export type HypothesisInput = Recruitment & (
  | (Powered & { method: 't-test' | 'correlation' })
  | { method: 'green'; predictors: number; target: 'overall' | 'individual' | 'both' }
);
export type HypothesisResult = { input: HypothesisInput; completed: number; contacts: number; perGroup: number | null; invitationsPerGroup: number | null; raw: number; feasible: boolean; formula: string };
export type SamplePlan = { kind: 'survey'; result: SampleSizeResult } | { kind: 'hypothesis'; result: HypothesisResult };
export type PlanningError = 'population' | 'responsePercent' | 'alpha' | 'power' | 'effect' | 'predictors' | 'target' | 'precision' | 'method';

/** Two-sided, equal independent groups (normal approximation), or Fisher-z
 * correlation against rho=0. Green is deliberately a separate heuristic:
 * no user-selected effect/power is claimed for it. Independently implemented. */
export function calculateHypothesis(input: HypothesisInput): { ok: true; result: HypothesisResult } | { ok: false; field: PlanningError } {
  if (input.population !== null && (!Number.isSafeInteger(input.population) || input.population < 1)) return { ok: false, field: 'population' };
  if (!Number.isFinite(input.responsePercent) || input.responsePercent <= 0 || input.responsePercent > 100) return { ok: false, field: 'responsePercent' };
  let raw: number, perGroup: number | null = null, formula: string;
  if (input.method === 'green') {
    if (!Number.isSafeInteger(input.predictors) || input.predictors < 1) return { ok: false, field: 'predictors' };
    if (!['overall', 'individual', 'both'].includes(input.target)) return { ok: false, field: 'target' };
    const overall = 50 + 8 * input.predictors, individual = 104 + input.predictors;
    raw = input.target === 'overall' ? overall : input.target === 'individual' ? individual : Math.max(overall, individual);
    formula = input.target === 'overall' ? 'n ≥ 50 + 8k' : input.target === 'individual' ? 'n ≥ 104 + k' : 'n ≥ max(50 + 8k, 104 + k)';
  } else if (input.method === 't-test' || input.method === 'correlation') {
    if (!SAMPLE_ALPHA_LEVELS.includes(input.alpha)) return { ok: false, field: 'alpha' };
    if (!SAMPLE_POWER_LEVELS.includes(input.power)) return { ok: false, field: 'power' };
    if (!Number.isFinite(input.effect) || input.effect === 0 || (input.method === 't-test' ? input.effect < 0 : Math.abs(input.effect) >= 1)) return { ok: false, field: 'effect' };
    const sum = Z_ALPHA[input.alpha] + Z_POWER[input.power];
    if (input.method === 't-test') {
      // Guenther (1981): the Z(1−α/2)²/4 term corrects the normal approximation
      // towards the exact noncentral-t size (G*Power gives 394 / 64 / 26 for d = .2 / .5 / .8).
      const zAlpha = Z_ALPHA[input.alpha];
      const rawPerGroup = 2 * (sum / input.effect) ** 2 + zAlpha ** 2 / 4;
      perGroup = Math.max(2, Math.ceil(rawPerGroup));
      raw = perGroup * 2;
      formula = 'n/group ≈ max(2, ceil(2 × (Z(1−α/2) + Z(power))² / d² + Z(1−α/2)² / 4)); total = 2 × n/group';
    } else {
      const fisher = Math.atanh(Math.abs(input.effect));
      raw = 3 + (sum / fisher) ** 2;
      formula = 'n ≈ ceil(3 + ((Z(1−α/2) + Z(power)) / atanh(|r|))²)';
    }
  } else return { ok: false, field: 'method' };
  const completed = Math.max(1, Math.ceil(raw));
  const invitationsPerGroup = perGroup === null ? null : sampleInvitations(perGroup, input.responsePercent);
  if (perGroup !== null && invitationsPerGroup === null) return { ok: false, field: 'precision' };
  const contacts = invitationsPerGroup === null ? sampleInvitations(completed, input.responsePercent) : invitationsPerGroup * 2;
  if (!Number.isFinite(raw) || !Number.isSafeInteger(completed) || contacts === null || !Number.isSafeInteger(contacts) || contacts < completed) return { ok: false, field: 'precision' };
  return { ok: true, result: { input: { ...input }, completed, contacts, raw, perGroup, invitationsPerGroup, formula, feasible: input.population === null || contacts <= input.population } };
}

// Published N/S data, not values recomputed using Cochran or a ceiling rule.
// Krejcie & Morgan (1970), Table 1, p. 608, DOI below. Numeric facts only.
export const KREJCIE_MORGAN_TABLE: readonly (readonly [number, number])[] = [
  [10,10],[15,14],[20,19],[25,24],[30,28],[35,32],[40,36],[45,40],[50,44],[55,48],[60,52],[65,56],[70,59],[75,63],[80,66],[85,70],[90,73],[95,76],
  [100,80],[110,86],[120,92],[130,97],[140,103],[150,108],[160,113],[170,118],[180,123],[190,127],[200,132],[210,136],[220,140],[230,144],[240,148],[250,152],[260,155],[270,159],[280,162],[290,165],[300,169],
  [320,175],[340,181],[360,186],[380,191],[400,196],[420,201],[440,205],[460,210],[480,214],[500,217],[550,226],[600,234],[650,242],[700,248],[750,254],[800,260],[850,265],[900,269],[950,274],[1000,278],
  [1100,285],[1200,291],[1300,297],[1400,302],[1500,306],[1600,310],[1700,313],[1800,317],[1900,320],[2000,322],[2200,327],[2400,331],[2600,335],[2800,338],[3000,341],[3500,346],[4000,351],[4500,354],[5000,357],[6000,361],
  [7000,364],[8000,367],[9000,368],[10000,370],[15000,375],[20000,377],[30000,379],[40000,380],[50000,381],[75000,382],[1000000,384],
];

/** Interpolation is never presented as a published table row. */
export function krejcieMorganComparison(population: number | null) {
  if (population !== null && (!Number.isSafeInteger(population) || population < 1)) return null;
  const exact = KREJCIE_MORGAN_TABLE.find(([n]) => n === population) ?? null;
  const lower = population === null ? null : [...KREJCIE_MORGAN_TABLE].reverse().find(([n]) => n < population) ?? null;
  const upper = population === null ? null : KREJCIE_MORGAN_TABLE.find(([n]) => n > population) ?? null;
  const n0 = 3.841 * 0.5 * 0.5 / 0.05 ** 2;
  const raw = population === null ? n0 : population / (1 + (population - 1) / n0);
  return { exact, lower, upper, formulaRounded: Math.max(1, Math.round(raw)) };
}

export const SAMPLE_REFERENCES = {
  cochran: { citation: 'Cochran, W. G. (1977). Sampling techniques (3rd ed.). John Wiley & Sons.', url: 'https://www.wiley.com/en-us/Sampling+Techniques%2C+3rd+Edition-p-9780471162407' },
  morgan: { citation: 'Krejcie, R. V., & Morgan, D. W. (1970). Determining sample size for research activities. Educational and Psychological Measurement, 30(3), 607–610. https://doi.org/10.1177/001316447003000308', url: 'https://doi.org/10.1177/001316447003000308' },
  cohen: { citation: 'Cohen, J. (1988). Statistical power analysis for the behavioral sciences (2nd ed.). Lawrence Erlbaum Associates. https://doi.org/10.4324/9780203771587', url: 'https://www.routledge.com/Statistical-Power-Analysis-for-the-Behavioral-Sciences/Cohen/p/book/9780203771587' },
  guenther: { citation: 'Guenther, W. C. (1981). Sample size formulas for normal theory t tests. The American Statistician, 35(4), 243–244. https://doi.org/10.1080/00031305.1981.10479363', url: 'https://doi.org/10.1080/00031305.1981.10479363' },
  green: { citation: 'Green, S. B. (1991). How many subjects does it take to do a regression analysis? Multivariate Behavioral Research, 26(3), 499–510. https://doi.org/10.1207/s15327906mbr2603_7', url: 'https://pubmed.ncbi.nlm.nih.gov/26776715/' },
} as const;

export function samplePlanTitle(plan: SamplePlan, language: SampleLanguage) {
  const ar = language === 'ar';
  if (plan.kind === 'survey') return ar ? 'تقدير نسبة واحدة — كوكران' : 'One population proportion — Cochran';
  return plan.result.input.method === 't-test' ? (ar ? 'متوسطا مجموعتين مستقلتين — تقدير تقريبي' : 'Two independent means — approximation') : plan.result.input.method === 'correlation' ? (ar ? 'ارتباط بيرسون — تقريب Fisher z' : 'Pearson correlation — Fisher-z approximation') : (ar ? 'الانحدار المتعدد — قاعدة Green الإرشادية' : 'Multiple regression — Green heuristic');
}

/** Planning prose only: never invents recruitment, research results or ethical approval.
 * A reproducible local draft, not an LLM or a substitute for a full methodology. */
export function sampleMethodology(plan: SamplePlan, language: SampleLanguage): string {
  const ar = language === 'ar', { completed, contacts, input, feasible } = plan.result;
  const pick = (a: string, e: string) => ar ? a : e;
  const paragraphs = [pick('خطة حجم العينة والتجنيد — مسودة للمراجعة', 'Sample size and recruitment plan — draft for review'), samplePlanTitle(plan, language)];
  let references: readonly { citation: string }[];
  if (plan.kind === 'survey') {
    const { z, unadjusted, adjusted, input: s } = plan.result;
    paragraphs.push(pick(`يُقترح تقدير حجم العينة اللازمة لتقدير نسبة واحدة باستخدام معادلة كوكران (Cochran, 1977)، تحت افتراض العينة العشوائية البسيطة وتأثير تصميم يساوي 1. اختير مستوى ثقة ${s.confidence}%، وقيمة Z = ${z.toFixed(6)}، وهامش خطأ مطلق ±${s.marginPercent} نقطة مئوية (e = ${s.marginPercent/100})، ونسبة متوقعة p = ${s.proportionPercent/100}.`, `The planned sample estimates one population proportion using Cochran's formula (Cochran, 1977), assuming simple random sampling and a design effect of 1. The confidence level is ${s.confidence}%, Z = ${z.toFixed(6)}, the absolute margin of error is ±${s.marginPercent} percentage points (e = ${s.marginPercent/100}), and the expected proportion is p = ${s.proportionPercent/100}.`));
    paragraphs.push(`n₀ = Z²p(1−p)/e² = ${unadjusted.toFixed(6)}.`, s.population === null ? pick('حجم المجتمع غير محدد؛ لذلك لم يُطبق تصحيح المجتمع المحدود، وn = n₀.', 'Population size is unspecified; no finite-population correction is applied and n = n₀.') : pick(`للمجتمع المحدود N = ${s.population}، يُطبق التصحيح عند السحب دون إرجاع: n = n₀ / [1 + (n₀−1)/N] = ${adjusted.toFixed(6)}.`, `For the finite population N = ${s.population}, sampling without replacement uses n = n₀ / [1 + (n₀−1)/N] = ${adjusted.toFixed(6)}.`));
    if (s.proportionPercent === 50) paragraphs.push(pick('اختيرت p = 0.50 كافتراض محافظ يعظّم الحجم عند ثبات بقية المدخلات؛ ينبغي استبدالها بتقدير سابق موثوق إذا كان مناسبًا.', 'The p = 0.50 assumption maximizes the size for these settings; a defensible prior estimate may be used when appropriate.'));
    const km = krejcieMorganComparison(s.population)!;
    paragraphs.push(pick(`للمقارنة فقط، يعتمد مرجع Krejcie and Morgan (1970) ثقة 95% وهامش خطأ 5% وP = 0.50 وχ² = 3.841. ${km.exact ? `صف الجدول للمجتمع N = ${km.exact[0]} يعطي ${km.exact[1]}.` : `تنتج إعادة حساب معادلته، بالتقريب لأقرب عدد، ${km.formulaRounded}؛ هذه قيمة معادلة وليست صفًا مطابقًا في الجدول المنشور.`} لا تحل هذه المقارنة محل حساب كوكران المختار، وقد تختلف القيم بسبب المدخلات أو التقريب.`, `For comparison only, Krejcie and Morgan (1970) use 95% confidence, 5% precision, P = 0.50 and χ² = 3.841. ${km.exact ? `The published row for N = ${km.exact[0]} gives ${km.exact[1]}.` : `Recalculating their equation and rounding to the nearest integer gives ${km.formulaRounded}; this is a formula estimate, not an exact published table row.`} This comparison does not replace the selected Cochran calculation; inputs and rounding may differ.`));
    if (plan.result.smallExpectedCounts) paragraphs.push(pick('الأعداد المتوقعة صغيرة في إحدى الفئتين؛ يجب مراجعة ملاءمة التقريب الطبيعي قبل اعتماد الحجم.', 'An expected category count is small; review the normal approximation before adopting the estimate.'));
    references = [SAMPLE_REFERENCES.cochran, SAMPLE_REFERENCES.morgan];
  } else {
    const h = plan.result.input;
    if (h.method === 'green') {
      paragraphs.push(pick(`استُخدمت قاعدة Green (1991) الإرشادية للتخطيط الأولي للانحدار المتعدد مع k = ${h.predictors} متنبئًا (عدد معاملات المتنبئات، دون الثابت؛ تُحسب المتغيرات الوهمية والتفاعلات). نطاق الحساب: ${h.target === 'overall' ? 'النموذج ككل' : h.target === 'individual' ? 'المعاملات الفردية' : 'النموذج والمعاملات معًا'}.`, `Green's (1991) heuristic is used for preliminary multiple-regression planning with k = ${h.predictors} predictor terms (excluding the intercept, including dummy and interaction terms). The target is ${h.target === 'overall' ? 'the overall model' : h.target === 'individual' ? 'individual coefficients' : 'both the model and individual coefficients'}.`), plan.result.formula + ` = ${completed}.`, pick('تفترض هذه القاعدة علاقة متوسطة الحجم، ولا تُثبت قوة إحصائية مختارة. أشار Green إلى أن قاعدة النموذج ككل قد تبالغ في الحجم عند 7 متنبئات فأكثر. يلزم تحليل قدرة خاص بالنموذج والأثر قبل اعتماد خطة نهائية.', 'This rule assumes a medium-size relationship and does not establish a selected statistical power. Green noted that the overall-model rule may overestimate size with 7 or more predictors. A model-specific power analysis is needed before final adoption.'));
      references = [SAMPLE_REFERENCES.green];
    } else {
      paragraphs.push(pick(`يُخطط لاختبار ثنائي الطرف عند α = ${h.alpha} وقوة مستهدفة ${h.power}%، على أساس حجم أثر مسبق ${h.method === 't-test' ? 'd' : 'r'} = ${h.effect} (Cohen, 1988). ينبغي تبرير حجم الأثر بدراسة سابقة أو بأصغر أثر ذي أهمية عملية، وليس بنتيجة الدراسة الحالية.`, `A two-sided test is planned at α = ${h.alpha} and target power ${h.power}%, using an a priori effect ${h.method === 't-test' ? 'd' : 'r'} = ${h.effect} (Cohen, 1988). The effect should be justified by prior evidence or the smallest practically meaningful effect, not the current study's result.`), `Z(1−α/2) = ${Z_ALPHA[h.alpha].toFixed(6)}; Z(power) = ${Z_POWER[h.power].toFixed(6)}.`, plan.result.formula);
      paragraphs.push(h.method === 't-test' ? pick(`يفترض التقريب مجموعتين مستقلتين متساويتين، وتباينًا مشتركًا وتوزيعًا ملائمًا لاختبار المتوسطات. ينتج ${plan.result.perGroup} مشاركًا قابلًا للتحليل لكل مجموعة، بإجمالي ${completed}. هذا تقريب طبيعي مع تصحيح Guenther (1981) لصغر العينة، ويقترب من الحل الدقيق بتوزيع t غير المركزي؛ يُنصح بالتحقق منه ببرنامج تحليل قدرة.`, `The approximation assumes two independent equal groups, a common variance and distributions suitable for mean testing. It yields ${plan.result.perGroup} analyzable participants per group, ${completed} in total. This is a normal approximation with Guenther's (1981) small-sample correction, close to the exact noncentral-t solution; confirm it with power-analysis software.`) : pick(`يفترض الحساب ارتباط بيرسون بين متغيرين بقياسات مستقلة بين المشاركين وتوزيعًا ثنائيًا طبيعيًا، ويختبر H₀: ρ = 0. يستخدم تحويل Fisher: atanh(|r|) = ${Math.atanh(Math.abs(h.effect)).toFixed(6)}، وينتج حجمًا غير مقرب ${plan.result.raw.toFixed(6)}. هذا تقريب لاختبار ارتباط واحد ولا يخص القياسات المتكررة أو سبيرمان أو مقارنة ارتباطين.`, `The calculation assumes Pearson correlation, independent participants and bivariate normality, testing H₀: ρ = 0. Fisher's transform is atanh(|r|) = ${Math.atanh(Math.abs(h.effect)).toFixed(6)}, giving an unrounded size of ${plan.result.raw.toFixed(6)}. This approximation is for one correlation, not repeated measures, Spearman correlation or comparing two correlations.`));
      references = h.method === 't-test' ? [SAMPLE_REFERENCES.cohen, SAMPLE_REFERENCES.guenther] : [SAMPLE_REFERENCES.cohen];
    }
    paragraphs.push(pick(`لم يُطبق تصحيح مجتمع محدود على حساب الفرضية؛ ${input.population === null ? 'حجم المجتمع غير محدد.' : `المجتمع المدخل N = ${input.population} ويُستخدم لفحص إمكانية التجنيد فقط.`}`, `No finite-population correction is applied to hypothesis planning; ${input.population === null ? 'population size is unspecified.' : `the supplied population N = ${input.population} is used only to assess recruitment feasibility.`}`));
  }
  paragraphs.push(pick(`الهدف التخطيطي هو ${completed} استجابة/حالة مكتملة قابلة للتحليل بعد التقريب للأعلى. عند نسبة استجابة متوقعة ${input.responsePercent}%، يُخطط لإرسال ${contacts} دعوة.`, `The planning target is ${completed} completed analyzable responses/cases, rounded upward. At an expected response rate of ${input.responsePercent}%, the plan requires ${contacts} invitations.`));
  if (plan.kind === 'hypothesis' && plan.result.perGroup !== null) paragraphs.push(`ceil(${plan.result.perGroup} / ${input.responsePercent/100}) = ${plan.result.invitationsPerGroup} ${pick('دعوة لكل مجموعة؛ المجموع', 'invitations per group; total')} = ${contacts}.`);
  else paragraphs.push(`invitations = ceil(${completed} / ${input.responsePercent/100}) = ${contacts}.`);
  paragraphs.push(pick('نسبة الاستجابة افتراض تخطيطي لا تضمن العدد الفعلي ولا تعالج تحيز عدم الاستجابة. يلزم تحديد إطار المعاينة ومعايير الاشتمال وطريقة الاختيار والتعامل مع البيانات المفقودة ضمن خطة الدراسة. العينات العنقودية والتصاميم المعقدة والتشبع النوعي تحتاج حسابات مختلفة.', 'The response rate is a planning assumption, not a guarantee or a correction for nonresponse bias. Specify the sampling frame, eligibility, selection procedure and missing-data handling in the study plan. Cluster samples, complex designs and qualitative saturation require different methods.'));
  if (!feasible) paragraphs.push(pick('الخطة الحالية غير قابلة للتجنيد من المجتمع المدخل: الدعوات المطلوبة تتجاوز عدد أفراده. يجب تعديل الخطة قبل اعتمادها.', 'The current plan is infeasible for the supplied population: invitations exceed its size. Revise the plan before adopting it.'));
  paragraphs.push(pick('هذه مسودة لخطة حجم العينة فقط؛ لا تثبت جمع بيانات أو موافقة أخلاقية ولا تمثل فصل منهجية كاملًا. راجعها مع المشرف أو الإحصائي وادمجها مع تصميم الدراسة.', 'This is a sample-size planning draft only. It does not establish completed recruitment or ethical approval and is not a complete methodology chapter. Review it with your supervisor or statistician and integrate it with the study design.'), pick('المراجع — APA، الإصدار السابع', 'References — APA 7th edition'), ...references.map(r => r.citation));
  return paragraphs.join('\n\n');
}

export function surveyComparisonSize(population: number, result: SampleSizeResult) {
  const value = calculateSampleSize({ ...result.input, population });
  return value.ok ? value.result.completed : null;
}
