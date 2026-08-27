import type {
  ProblemObjectivesConsistencyReport,
  ResearchObjectViewWarning,
} from '@/lib/research-objects/types';

export type ConsistencyPanelStatus = 'idle' | 'loading' | 'ready' | 'stale' | 'error';

type Props = {
  status: ConsistencyPanelStatus;
  report: ProblemObjectivesConsistencyReport | null;
  warnings: ResearchObjectViewWarning[];
  error: string;
  onRetry: () => void;
};

const STATUS_PRESENTATION = {
  passed: {
    label: 'متسق',
    border: 'border-emerald-200',
    background: 'bg-emerald-50',
    text: 'text-emerald-900',
    badge: 'bg-emerald-100 text-emerald-800',
    bar: 'bg-emerald-500',
  },
  warning: {
    label: 'يحتاج مراجعة',
    border: 'border-amber-200',
    background: 'bg-amber-50',
    text: 'text-amber-950',
    badge: 'bg-amber-100 text-amber-900',
    bar: 'bg-amber-500',
  },
  failed: {
    label: 'خلل يحتاج معالجة',
    border: 'border-rose-200',
    background: 'bg-rose-50',
    text: 'text-rose-950',
    badge: 'bg-rose-100 text-rose-900',
    bar: 'bg-rose-500',
  },
} as const;

function ScoreBar({ label, score, color }: { label: string; score: number; color: string }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs font-bold text-slate-600">
        <span>{label}</span>
        <span>{score}/100</span>
      </div>
      <div
        className="h-2 overflow-hidden rounded-full bg-slate-200"
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={score}
      >
        <div className={`h-full rounded-full ${color}`} style={{ width: `${score}%` }} />
      </div>
    </div>
  );
}

export default function ProblemObjectivesConsistencyPanel({
  status,
  report,
  warnings,
  error,
  onRetry,
}: Props) {
  if (status === 'idle') return null;

  if (status === 'loading') {
    return (
      <section className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm" aria-live="polite">
        <div className="h-4 w-44 animate-pulse rounded bg-blue-100" />
        <div className="mt-4 h-3 w-full animate-pulse rounded bg-slate-100" />
        <p className="mt-4 text-sm text-slate-500">جارٍ فحص علاقة الأهداف بمشكلة البحث المحفوظة…</p>
      </section>
    );
  }

  if (status === 'error' || !report) {
    return (
      <section className="rounded-2xl border border-rose-200 bg-rose-50 p-5" role="alert">
        <h2 className="font-black text-rose-950">تعذر تحميل فحص الاتساق</h2>
        <p className="mt-2 text-sm leading-7 text-rose-800">{error || 'تعذر قراءة نتيجة الفحص.'}</p>
        <button type="button" onClick={onRetry} className="mt-4 rounded-xl border border-rose-300 bg-white px-4 py-2 text-sm font-bold text-rose-800">
          إعادة المحاولة
        </button>
      </section>
    );
  }

  const presentation = STATUS_PRESENTATION[report.status];
  const hasSavedObjectives = report.objectiveIds.length > 0;

  return (
    <section className={`rounded-2xl border p-5 shadow-sm sm:p-6 ${presentation.border} ${presentation.background}`} aria-live="polite">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs font-bold text-blue-700">محرك الاتساق البحثي · المشكلة ↔ الأهداف</div>
          <h2 className={`mt-2 text-xl font-black ${presentation.text}`}>
            {hasSavedObjectives ? report.summary : 'احفظ هدفين على الأقل لبدء فحص الاتساق.'}
          </h2>
        </div>
        {hasSavedObjectives ? <span className={`rounded-full px-3 py-1 text-xs font-black ${presentation.badge}`}>{presentation.label}</span> : null}
      </div>

      {status === 'stale' ? (
        <p className="mt-4 rounded-xl border border-amber-300 bg-white/70 p-3 text-sm font-bold leading-7 text-amber-900">
          عدّلت الأهداف بعد آخر فحص. النتيجة أدناه تخص النسخة المحفوظة السابقة؛ احفظ التعديلات لتحديثها.
        </p>
      ) : null}

      {hasSavedObjectives ? (
        <>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <ScoreBar label="الاتساق العام" score={report.overallScore} color={presentation.bar} />
            <ScoreBar label="تغطية مفاهيم المشكلة" score={report.coverageScore} color={presentation.bar} />
          </div>

          {report.issues.length ? (
            <ul className="mt-5 space-y-2 rounded-xl border border-white/80 bg-white/70 p-4 text-sm leading-7 text-slate-800">
              {report.issues.map((issue) => <li key={issue}>• {issue}</li>)}
            </ul>
          ) : null}

          <div className="mt-5 space-y-3">
            {report.results.map((result, index) => (
              <article key={result.id} className="rounded-xl border border-white/90 bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-black text-slate-950">الهدف {index + 1}</h3>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-black ${STATUS_PRESENTATION[result.status].badge}`}>
                    {result.score}/100
                  </span>
                </div>
                <div className="mt-4 grid gap-3 text-xs sm:grid-cols-3">
                  <ScoreBar label="الصلة بالمشكلة" score={result.dimensions.relevance} color={STATUS_PRESENTATION[result.status].bar} />
                  <ScoreBar label="القابلية للفحص" score={result.dimensions.measurability} color={STATUS_PRESENTATION[result.status].bar} />
                  <ScoreBar label="وضوح التحديد" score={result.dimensions.specificity} color={STATUS_PRESENTATION[result.status].bar} />
                </div>
                {result.gapsFound.length ? (
                  <ul className="mt-4 space-y-1 text-sm leading-7 text-slate-700">
                    {result.gapsFound.map((gap) => <li key={gap}>• {gap}</li>)}
                  </ul>
                ) : null}
                <p className="mt-3 rounded-lg bg-blue-50 p-3 text-sm leading-7 text-blue-950">
                  <strong>الخطوة المقترحة:</strong> {result.suggestedAction}
                </p>
              </article>
            ))}
          </div>
        </>
      ) : null}

      {warnings.length ? (
        <ul className="mt-4 space-y-1 text-xs leading-6 text-slate-600">
          {warnings.map((warning) => <li key={`${warning.code}:${warning.documentId || 'none'}`}>• {warning.message}</li>)}
        </ul>
      ) : null}

      <p className="mt-5 border-t border-slate-200/80 pt-4 text-xs leading-6 text-slate-600">
        هذا تقييم استدلالي مساعد مبني على النصوص المحفوظة، وليس حكمًا أكاديميًا نهائيًا أو دليلًا منشورًا.
      </p>
    </section>
  );
}
