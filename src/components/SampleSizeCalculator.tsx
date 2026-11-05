'use client';

import { Fragment, useId, useRef, useState } from 'react';
import { calculateSampleSize, SAMPLE_CONFIDENCE_LEVELS, sampleSizeNumber, type SampleConfidence } from '@/lib/sample-size';
import { calculateHypothesis, KREJCIE_MORGAN_TABLE, krejcieMorganComparison, SAMPLE_ALPHA_LEVELS, SAMPLE_POWER_LEVELS, SAMPLE_REFERENCES, sampleMethodology, surveyComparisonSize, type AlphaLevel, type PowerLevel, type SampleLanguage, type SamplePlan } from '@/lib/sample-size-planning';
import { sampleFlow } from '@/lib/sample-size-flow';
import styles from './SampleSizeCalculator.module.css';

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob), link = document.createElement('a');
  link.href = url; link.download = filename; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function SampleSizeCalculator({ language, onApply }: { language: SampleLanguage; onApply?: (note: string) => void }) {
  const ar = language === 'ar', t = (a: string, e: string) => ar ? a : e;
  const uid = useId(), root = useRef<HTMLDivElement>(null), tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [tab, setTab] = useState<'survey' | 'hypothesis'>('survey');
  const [population, setPopulation] = useState(''), [response, setResponse] = useState('100');
  const [confidence, setConfidence] = useState<SampleConfidence>(95), [margin, setMargin] = useState('5'), [proportion, setProportion] = useState('50');
  const [method, setMethod] = useState<'t-test' | 'correlation' | 'green'>('t-test');
  const [d, setD] = useState('0.5'), [r, setR] = useState('0.3'), [power, setPower] = useState<PowerLevel>(80), [alpha, setAlpha] = useState<AlphaLevel>(0.05);
  const [predictors, setPredictors] = useState('4'), [target, setTarget] = useState<'overall' | 'individual' | 'both'>('both');
  const [node, setNode] = useState(1), [status, setStatus] = useState(''), [exporting, setExporting] = useState(false);
  const n = population.trim() ? sampleSizeNumber(population) : null;
  const survey = calculateSampleSize({ population: n, confidence, marginPercent: sampleSizeNumber(margin), proportionPercent: sampleSizeNumber(proportion), responsePercent: sampleSizeNumber(response) });
  const hypothesis = calculateHypothesis(method === 'green'
    ? { method, predictors: sampleSizeNumber(predictors), target, population: n, responsePercent: sampleSizeNumber(response) }
    : { method, effect: sampleSizeNumber(method === 't-test' ? d : r), power, alpha, population: n, responsePercent: sampleSizeNumber(response) });
  const plan: SamplePlan | null = tab === 'survey' ? survey.ok ? { kind: 'survey', result: survey.result } : null : hypothesis.ok ? { kind: 'hypothesis', result: hypothesis.result } : null;
  const error = tab === 'survey' ? survey.ok ? null : survey.field : hypothesis.ok ? null : hypothesis.field;
  const errors: Record<string, string> = {
    population: t('أدخل عددًا صحيحًا موجبًا للمجتمع، أو اتركه فارغًا إن كان غير محدد.', 'Enter a positive whole population size, or leave it blank if unspecified.'),
    responsePercent: t('نسبة الاستجابة يجب أن تكون أكبر من صفر وحتى 100%.', 'Response rate must be greater than zero and at most 100%.'),
    marginPercent: t('هامش الخطأ يجب أن يكون أكبر من صفر وأقل من 100 نقطة مئوية.', 'Margin must be greater than zero and below 100 percentage points.'),
    proportionPercent: t('النسبة المتوقعة يجب أن تكون أكبر من صفر وأقل من 100%.', 'Expected proportion must be greater than zero and below 100%.'),
    effect: t(method === 'correlation' ? 'أدخل r بين −1 و1، باستثناء الصفر والحدين.' : 'أدخل حجم أثر d موجبًا.', method === 'correlation' ? 'Enter r between −1 and 1, excluding zero and the endpoints.' : 'Enter a positive effect size d.'),
    predictors: t('أدخل عددًا صحيحًا موجبًا لمعاملات المتنبئات، دون الثابت.', 'Enter a positive whole number of predictor terms, excluding the intercept.'),
    precision: t('الحجم الناتج يتجاوز دقة الحساب الآمنة. راجع المدخلات.', 'The estimate exceeds safe numerical precision. Review the inputs.'),
  };
  const draft = plan ? sampleMethodology(plan, language) : '', flow = plan ? sampleFlow(plan, language) : null;
  const change = (setter: (s: string) => void) => (value: string) => { setter(value); setStatus(''); };
  const numeric = (key: string, label: string, value: string, setter: (s: string) => void, help?: string) => <label className={styles.field} htmlFor={`${uid}-${key}`}>{label}<input id={`${uid}-${key}`} inputMode="decimal" autoComplete="off" maxLength={32} value={value} onChange={e => change(setter)(e.target.value)} aria-invalid={error === key} aria-describedby={help ? `${uid}-${key}-help` : undefined}/>{help && <span className={styles.hint} id={`${uid}-${key}-help`}>{help}</span>}</label>;
  async function copy(text: string) {
    try { await navigator.clipboard.writeText(text); setStatus(t('تم النسخ.', 'Copied.')); }
    catch { setStatus(t('تعذر النسخ التلقائي. يمكنك تحديد النص أدناه ونسخه يدويًا أو تنزيله.', 'Automatic copying is unavailable. Select and copy the text below, or download it.')); }
  }
  async function exportPng() {
    if (!plan || exporting) return;
    setExporting(true); setStatus('');
    try { const { sampleSizePng } = await import('@/lib/sample-size-image'); download(await sampleSizePng(plan, language, getComputedStyle(root.current!).fontFamily), `waha-sample-plan-${language}.png`); setStatus(t('تم تجهيز المخطط للتنزيل.', 'The diagram is ready to download.')); }
    catch { setStatus(t('تعذر تنزيل الصورة. أعد المحاولة أو انسخ مسودة المنهجية.', 'The image could not be downloaded. Retry or copy the methodology draft.')); }
    finally { setExporting(false); }
  }
  const km = survey.ok ? krejcieMorganComparison(survey.result.input.population) : null;
  const tableIndex = n === null ? KREJCIE_MORGAN_TABLE.length - 1 : Math.max(0, KREJCIE_MORGAN_TABLE.findIndex(([size]) => size >= n));
  const nearRows = n === null || (n !== null && n > 1000000) ? KREJCIE_MORGAN_TABLE.slice(-5) : KREJCIE_MORGAN_TABLE.slice(Math.max(0, tableIndex - 2), tableIndex + 3);
  const table = (rows: typeof KREJCIE_MORGAN_TABLE) => <table className={styles.table}><caption className="sr-only">{t('مقارنة كوكران بصفوف الجدول المنشور', 'Cochran compared with published table rows')}</caption><thead><tr><th scope="col">N</th><th scope="col">{t('كوكران بإعداداتك', 'Cochran, your settings')}</th><th scope="col">Krejcie &amp; Morgan</th></tr></thead><tbody>{rows.map(([size, sample]) => <tr key={size} data-match={size === n}><th scope="row">{size}</th><td>{survey.ok ? surveyComparisonSize(size, survey.result) ?? '—' : '—'}</td><td>{sample}</td></tr>)}</tbody></table>;
  return <div ref={root} className={styles.tool} dir={ar ? 'rtl' : 'ltr'} lang={language} onChangeCapture={() => setStatus('')}>
    <div className={styles.tabs} role="tablist" aria-label={t('نوع حساب العينة', 'Sample size calculation type')}>
      {(['survey', 'hypothesis'] as const).map((name, index) => <button key={name} ref={el => { tabRefs.current[index] = el; }} id={`${uid}-tab-${name}`} role="tab" type="button" aria-selected={tab === name} aria-controls={`${uid}-panel-${name}`} tabIndex={tab === name ? 0 : -1} onClick={() => { setTab(name); setStatus(''); }} onKeyDown={e => { if (['ArrowLeft','ArrowRight','Home','End'].includes(e.key)) { e.preventDefault(); const next = e.key === 'Home' ? 0 : e.key === 'End' ? 1 : 1-index; setTab(next === 0 ? 'survey' : 'hypothesis'); setStatus(''); tabRefs.current[next]?.focus(); } }}>{index === 0 ? t('الاستبيانات الوصفية', 'Descriptive surveys') : t('اختبار الفرضيات', 'Hypothesis testing')}</button>)}
    </div>
    <section role="tabpanel" id={`${uid}-panel-${tab}`} aria-labelledby={`${uid}-tab-${tab}`}>
      <div className={styles.columns}>
        <div className={styles.card}>
          <h2>{tab === 'survey' ? t('ما المجتمع الذي تريد وصفه؟', 'Which population do you want to describe?') : t('ما الفرضية التي تريد اختبارها؟', 'Which hypothesis do you want to test?')}</h2>
          <p className={styles.hint}>{tab === 'survey' ? t('لتقدير نسبة واحدة بعينة عشوائية بسيطة. النتيجة تتغير مباشرة مع مدخلاتك.', 'Estimate one population proportion with simple random sampling. Results update with your inputs.') : t('تقديرات أولية للتخطيط؛ اختر التحليل المطابق لسؤالك البحثي.', 'Preliminary planning estimates. Choose the analysis that matches your research question.')}</p>
          <div className={styles.fields}>
            {numeric('population', t('حجم المجتمع N (اختياري)', 'Population size N (optional)'), population, setPopulation, t('اتركه فارغًا إذا كان كبيرًا أو غير محدد. اكتب الأرقام دون فواصل الآلاف.', 'Leave blank if unspecified or treated as very large. Enter digits without thousands separators.'))}
            {numeric('responsePercent', t('الاستجابة المتوقعة (%)', 'Expected response (%)'), response, setResponse, t('عدد الدعوات يُقرب للأعلى لتعويض عدم الاستجابة المتوقع.', 'Invitations are rounded upward for expected nonresponse.'))}
            {tab === 'survey' ? <>
              <label className={styles.field}>{t('مستوى الثقة', 'Confidence level')}<select value={confidence} onChange={e => setConfidence(Number(e.target.value) as SampleConfidence)}>{SAMPLE_CONFIDENCE_LEVELS.map(level => <option key={level} value={level}>{level}%</option>)}</select></label>
              {numeric('marginPercent', t('هامش الخطأ (± نقطة مئوية)', 'Margin of error (± percentage points)'), margin, setMargin)}
              {numeric('proportionPercent', t('النسبة المتوقعة p (%)', 'Expected proportion p (%)'), proportion, setProportion, t('50% افتراض محافظ عند غياب تقدير سابق.', '50% is conservative when a prior estimate is unavailable.'))}
            </> : <>
              <label className={styles.field}>{t('نوع التحليل', 'Analysis type')}<select value={method} onChange={e => setMethod(e.target.value as typeof method)}><option value="t-test">{t('t-test — مجموعتان مستقلتان', 't-test — two independent groups')}</option><option value="correlation">{t('ارتباط بيرسون r', 'Pearson correlation r')}</option><option value="green">{t('انحدار متعدد — قاعدة Green', 'Multiple regression — Green rule')}</option></select></label>
              {method === 'green' ? <>
                {numeric('predictors', t('عدد معاملات المتنبئات k', 'Number of predictor terms k'), predictors, setPredictors, t('دون الثابت؛ احسب المتغيرات الوهمية والتفاعلات.', 'Exclude the intercept; count dummy and interaction terms.'))}
                <label className={styles.field}>{t('هدف الانحدار', 'Regression target')}<select value={target} onChange={e => setTarget(e.target.value as typeof target)}><option value="overall">{t('النموذج ككل', 'Overall model')}</option><option value="individual">{t('المعاملات الفردية', 'Individual coefficients')}</option><option value="both">{t('كلاهما — الأكبر', 'Both — larger value')}</option></select></label>
              </> : <>
                {numeric('effect', method === 't-test' ? t('حجم الأثر d', 'Effect size d') : t('الارتباط المتوقع r', 'Expected correlation r'), method === 't-test' ? d : r, method === 't-test' ? setD : setR, t('استند إلى دليل سابق أو أصغر أثر ذي أهمية عملية.', 'Use prior evidence or the smallest practically meaningful effect.'))}
                <label className={styles.field}>{t('القوة المستهدفة', 'Target power')}<select value={power} onChange={e => setPower(Number(e.target.value) as PowerLevel)}>{SAMPLE_POWER_LEVELS.map(level => <option key={level} value={level}>{level}%</option>)}</select></label>
                <label className={styles.field}>{t('مستوى الدلالة α (ثنائي الطرف)', 'Significance α (two-sided)')}<select value={alpha} onChange={e => setAlpha(Number(e.target.value) as AlphaLevel)}>{SAMPLE_ALPHA_LEVELS.map(level => <option key={level} value={level}>{level}</option>)}</select></label>
              </>}
            </>}
          </div>
          {tab === 'hypothesis' && <p className={styles.note}>{method === 'green' ? t('قاعدة Green تفترض علاقة متوسطة ولا تحسب قوة إحصائية مختارة. للنموذج: 50 + 8k؛ للمعاملات: 104 + k. راجع تحليل القدرة، خصوصًا عند 7 متنبئات فأكثر.', 'Green assumes a medium-size relationship and does not calculate a selected power. Model: 50 + 8k; coefficients: 104 + k. Review a power analysis, especially with 7 or more predictors.') : method === 't-test' ? t('تقريب طبيعي لمجموعتين مستقلتين متساويتين وتباين مشترك؛ ليس اختبارًا مزدوجًا أو مقترنًا أو حساب t دقيقًا.', 'Normal approximation for two independent equal groups with a common variance; not a paired test or an exact t calculation.') : t('تقريب Fisher z لارتباط بيرسون مقابل H₀: ρ = 0؛ لا يخص سبيرمان أو القياسات المتكررة.', 'Fisher-z approximation for Pearson correlation against H₀: ρ = 0; not Spearman or repeated measures.')}</p>}
          {error && <p role="alert" className={styles.error}>{errors[error] ?? t('راجع مدخلات الحساب.', 'Review the calculation inputs.')}</p>}
          {plan && <><div className={styles.result} aria-live="polite" aria-atomic="true"><div className={styles.metric}>{t('الحجم الكلي المطلوب', 'Total cases needed')}<strong data-testid="sample-completed">{plan.result.completed}</strong></div><div className={styles.metric}>{t('الدعوات المطلوبة', 'Invitations needed')}<strong data-testid="sample-contacts">{plan.result.contacts}</strong></div></div>{plan.kind === 'hypothesis' && plan.result.perGroup !== null && <p>{t('لكل مجموعة', 'Per group')}: <strong data-testid="sample-per-group">{plan.result.perGroup}</strong> · {t('دعوة لكل مجموعة', 'Invitations per group')}: {plan.result.invitationsPerGroup}</p>}{!plan.result.feasible && <p role="alert" className={styles.error}>{flow?.warning}</p>}{plan.kind === 'survey' && plan.result.smallExpectedCounts && <p className={styles.note}>{t('الأعداد المتوقعة صغيرة؛ راجع صلاحية التقريب الطبيعي مع إحصائي.', 'Expected counts are small; review the normal approximation with a statistician.')}</p>}</>}
        </div>
        {tab === 'survey' ? <aside className={styles.card} aria-label={t('مقارنة الجدول الأكاديمي', 'Academic table comparison')}>
          <h2>Krejcie &amp; Morgan (1970)</h2><p className={styles.hint}>{t('صفوف الجدول المنشور ثابتة عند ثقة 95%، وهامش 5%، وP = 0.50. عمود كوكران يتبع إعداداتك ويقرب للأعلى؛ لذلك قد يختلف عددًا واحدًا أو أكثر.', 'Published table rows are fixed at 95% confidence, 5% precision and P = 0.50. Cochran follows your settings and rounds upward, so values may differ by one or more.')}</p>
          {km && <div className={styles.note} data-testid="morgan-current">{km.exact ? t(`صف مطابق: N = ${km.exact[0]} ← العينة ${km.exact[1]}.`, `Exact published row: N = ${km.exact[0]} → sample ${km.exact[1]}.`) : <>{t(`لا يوجد صف مطابق. تقدير معادلة Krejcie & Morgan لأقرب عدد = ${km.formulaRounded}. هذه ليست قيمة صف أصلي.`, `No exact row. Krejcie & Morgan equation, rounded to nearest = ${km.formulaRounded}. This is not an original table row.`)}{km.lower && <div>N = {km.lower[0]} → {km.lower[1]}</div>}{km.upper && <div>N = {km.upper[0]} → {km.upper[1]}</div>}</>}</div>}
          {table(nearRows)}<details><summary>{t('عرض جميع صفوف الجدول', 'View all published table rows')}</summary>{table(KREJCIE_MORGAN_TABLE)}</details>
          <a href={SAMPLE_REFERENCES.morgan.url} target="_blank" rel="noopener noreferrer" className={styles.hint}>{t('المصدر الأصلي وبيانات المرجع', 'Original source and reference details')}</a>
        </aside> : <aside className={styles.card}><h2>{t('اقرأ النتيجة بشكل صحيح', 'Interpret your estimate')}</h2><p>{t('اختر حجم أثر له مبرر علمي. الأثر الأصغر والقوة الأعلى يزيدان عادةً عدد المشاركين المطلوب.', 'Choose an effect supported by evidence. Smaller effects and higher power generally require more participants.')}</p><p>{t('لا تُطبَّق معادلة الاستبيانات على اختبار الفرضيات تلقائيًا. اختلاف الرقم بين التبويبين سببه اختلاف السؤال والافتراضات.', 'The survey equation does not automatically apply to hypothesis tests. Different questions and assumptions produce different sizes.')}</p><a href="https://www.psychologie.hhu.de/arbeitsgruppen/allgemeine-psychologie-und-arbeitspsychologie/gpower" target="_blank" rel="noopener noreferrer">{t('G*Power — للتحقق بتحليل قدرة أدق', 'G*Power — verify with a more exact power analysis')}</a></aside>}
      </div>
    </section>
    {plan && flow && <>
      <section className={styles.card} aria-labelledby={`${uid}-flow-title`}>
        <h2 id={`${uid}-flow-title`}>{t('خطة العينة في مخطط واحد', 'Your sampling plan in one diagram')}</h2><p className={styles.hint}>{t('اضغط أي خطوة لفهم حسابها. الصورة والنص يعكسان المدخلات الحالية.', 'Select a step to inspect it. The image and draft reflect the current inputs.')}</p>
        <div className={styles.flow}>{flow.nodes.map((item, index) => <Fragment key={item.label}>{index > 0 && <span className={styles.arrow} aria-hidden="true">{ar ? '←' : '→'}</span>}<button type="button" className={styles.node} aria-pressed={node === index} aria-controls={`${uid}-node-detail`} onClick={() => setNode(index)}><span>{item.label}</span><strong>{item.value}</strong></button></Fragment>)}</div>
        <p id={`${uid}-node-detail`} className={styles.note}>{flow.nodes[node].detail}</p><p className={styles.hint}>{flow.settings}<br/>{flow.scope}</p>
        <div className={styles.actions}><button type="button" disabled={exporting} className={`${styles.button} ${styles.primary}`} onClick={() => void exportPng()}>{exporting ? t('تجهيز الصورة…', 'Preparing image…') : t('تنزيل المخطط PNG', 'Download diagram PNG')}</button><button type="button" className={styles.button} onClick={() => void copy('https://waha.systems/tools/sample-size')}>{t('مشاركة رابط الحاسبة', 'Share calculator link')}</button></div>
      </section>
      <section className={styles.card} aria-labelledby={`${uid}-draft-title`}><h2 id={`${uid}-draft-title`}>{t('مسودة منهجية الحساب — بالأرقام والمراجع', 'Calculation methodology draft — figures and references')}</h2><p className={styles.hint}>{t('تُصاغ محليًا من مدخلاتك دون تكلفة أو إرسالها لخدمة خارجية. فقرة موسعة لخطة العينة بصيغة التوثيق APA 7؛ راجعها وادمجها مع تصميمك، ولا تغني عن فصل منهجية الدراسة كاملًا.', 'Composed locally from your inputs, without fees or sending them to an external service. An expanded sample-plan draft with APA 7 citations; review it and integrate it with your design. It does not replace the full methodology chapter.')}</p>
        <textarea readOnly dir={ar ? 'rtl' : 'ltr'} aria-label={t('النص المنهجي المقترح', 'Proposed methodology text')} className={styles.draft} value={draft}/>
        <div className={styles.actions}><button type="button" className={`${styles.button} ${styles.primary}`} onClick={() => void copy(draft)}>{t('نسخ مسودة المنهجية', 'Copy methodology draft')}</button><button type="button" className={styles.button} onClick={() => download(new Blob(['\uFEFF', draft], { type: 'text/plain;charset=utf-8' }), `waha-methodology-${language}.txt`)}>{t('تنزيل النص والمراجع', 'Download text and references')}</button>{onApply && <button type="button" className={styles.button} onClick={() => { onApply(draft); setStatus(t('أُضيفت المسودة إلى مبرر حجم العينة. راجعها ثم احفظ خريطة الدراسة.', 'Draft added to the sample-size rationale. Review it, then save the study design.')); }}>{t('أضف إلى مبرر العينة في مشروعي', 'Add to my project sample rationale')}</button>}</div>
      </section>
    </>}
    <p role="status" aria-live="polite" className={styles.status}>{status}</p>
    <details className={styles.card}><summary>{t('المعادلات والمراجع والتراخيص', 'Equations, references and licenses')}</summary>{plan && <p className={styles.formula}>{plan.kind === 'survey' ? 'n₀ = Z²p(1−p)/e²; n = n₀/[1+(n₀−1)/N]; invitations = ceil(ceil(n)/response)' : plan.result.formula}</p>}<ul className={styles.references}>{Object.values(SAMPLE_REFERENCES).map(ref => <li key={ref.url} dir="ltr" lang="en"><a href={ref.url} target="_blank" rel="noopener noreferrer">{ref.citation}</a></li>)}</ul><p className={styles.hint}><a href="https://www.openepi.com/SampleSize/SSPropor.htm" target="_blank" rel="noopener noreferrer">OpenEpi</a> · <a href="/open-source/openepi/NOTICE.txt">{t('إسناد الحساب', 'Calculation attribution')}</a> · <a href="/open-source/openepi/LICENSE.txt">MIT</a></p></details>
  </div>;
}
