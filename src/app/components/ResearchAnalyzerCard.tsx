'use client';

/**
 * ResearchAnalyzerCard
 *
 * Presentational card for the ResearchAnalyzer output inside the Research
 * Workspace. Displays the eight computed metrics only — it performs no
 * fetching and no analysis of its own.
 */

import { useUiTranslation } from '@/lib/use-ui-translation';
import React from 'react';
import { ResearchEvidence } from '@/types/OpenAlex';
import { ResearchAnalysis, TopValue } from '@/types/ResearchAnalysis';
import { ResearchAnalyzer } from "@/lib/academic/ResearchAnalyzer";
const MISSING = 'غير متوفر في OpenAlex';

/**
 * Turn an ISO code into an Arabic country name using the platform's own
 * locale data (no lookup table, no network). Falls back to the raw code when
 * the runtime cannot resolve it.
 */
function countryLabel(code: string, language: 'ar' | 'en'): string {
  try {
    const name = new Intl.DisplayNames([language], { type: 'region' }).of(code);
    return name && name !== code ? `${name} (${code})` : code;
  } catch {
    return code;
  }
}

function Metric({
  label,
  value,
  hint,
  tone = 'text-slate-800',
  /** Text metrics (journal, country) need a smaller size than the numeric ones. */
  compact = false,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: string;
  compact?: boolean;
}) {
  const { text: ui } = useUiTranslation();

  return (
    <div className="bg-slate-50 border border-slate-200 p-3 rounded-lg text-center h-full">
      <p className="text-[10px] text-slate-500 mb-1">{ui(label)}</p>
      <p
        className={`${compact ? 'text-xs' : 'text-base'} font-bold ${tone} leading-snug break-words`}
      >
        {value === MISSING ? ui(value) : value}
      </p>
      {hint && <p className="text-[9px] text-slate-600 mt-1">{ui(hint)}</p>}
    </div>
  );
}

/** Renders "value" plus how many papers backed it, or the missing-data notice. */
function topValueText(top: TopValue): { value: string; hint?: string } {
  if (!top.value) return { value: MISSING };
  return { value: top.value, hint: `في {0} ورقة` };
}

export function ResearchAnalyzerCard({ papers }: { papers: ResearchEvidence[] }) {
  const { text: ui, language } = useUiTranslation();

  const analysis: ResearchAnalysis = ResearchAnalyzer.analyze(papers);

  const journal = topValueText(analysis.topJournal);
  const country = topValueText({
    ...analysis.topCountry,
    value: analysis.topCountry.value ? countryLabel(analysis.topCountry.value, language) : null,
  });

  return (
    <div className="bg-white border border-slate-200 p-5 rounded-xl text-start">
      <div className="flex flex-row-reverse justify-between items-center mb-4">
        <h3 className="text-sm font-bold text-ink">{ui("📈 تحليل النتائج (Research Analyzer)")}</h3>
        <span className="text-[9px] font-mono text-slate-500 border border-slate-200 px-2 py-1 rounded-lg">
          {ui("حسابات وصفية · بدون ذكاء اصطناعي")}</span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Metric
          label={ui("إجمالي الأوراق")}
          value={String(analysis.totalPapers)}
          tone="text-success"
        />
        <Metric
          label={ui("أحدث سنة نشر")}
          value={analysis.latestPublicationYear?.toString() ?? MISSING}
          tone="text-primary-dark"
        />
        <Metric
          label={ui("أقدم سنة نشر")}
          value={analysis.oldestPublicationYear?.toString() ?? MISSING}
          tone="text-amber-700"
        />
        <Metric
          label={ui("متوسط الاستشهادات")}
          value={analysis.averageCitationCount?.toLocaleString('en-US') ?? MISSING}
          tone="text-success"
        />
        <Metric
          label={ui("عدد المجلات")}
          value={String(analysis.numberOfJournals)}
          tone="text-slate-800"
        />
        <Metric
          label={ui("عدد الدول")}
          value={String(analysis.numberOfCountries)}
          tone="text-slate-800"
        />
        <div className="col-span-2 md:col-span-1">
          <Metric label={ui("أكثر مجلة تكراراً")} value={journal.value} hint={journal.hint ? ui(journal.hint, [analysis.topJournal.count]) : undefined} compact tone="text-ink" />
        </div>
        <div className="col-span-2 md:col-span-1">
          <Metric label={ui("أكثر دولة تكراراً")} value={country.value} hint={country.hint ? ui(country.hint, [analysis.topCountry.count]) : undefined} compact tone="text-ink" />
        </div>
      </div>

      <p className="text-[9px] text-slate-600 mt-3 leading-relaxed">
        {ui("محسوبة من")}{' '}{analysis.totalPapers} {ui("ورقة أعادها OpenAlex في هذا الاستعلام. تُحتسب المجلة والدولة مرة واحدة لكل ورقة، والحقول غير المسجلة في OpenAlex تُترك كما هي دون تعويض.")}</p>
    </div>
  );
}
