/**
 * ResearchAnalyzerCard
 *
 * Presentational card for the ResearchAnalyzer output inside the Research
 * Workspace. Displays the eight computed metrics only — it performs no
 * fetching and no analysis of its own.
 */

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
function countryLabel(code: string): string {
  try {
    const name = new Intl.DisplayNames(['ar'], { type: 'region' }).of(code);
    return name && name !== code ? `${name} (${code})` : code;
  } catch {
    return code;
  }
}

function Metric({
  label,
  value,
  hint,
  tone = 'text-slate-200',
  /** Text metrics (journal, country) need a smaller size than the numeric ones. */
  compact = false,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: string;
  compact?: boolean;
}) {
  return (
    <div className="bg-slate-950/50 border border-slate-900 p-3 rounded-lg text-center h-full">
      <p className="text-[10px] text-slate-500 mb-1">{label}</p>
      <p
        className={`${compact ? 'text-xs' : 'text-base'} font-bold ${tone} leading-snug break-words`}
      >
        {value}
      </p>
      {hint && <p className="text-[9px] text-slate-600 mt-1">{hint}</p>}
    </div>
  );
}

/** Renders "value" plus how many papers backed it, or the missing-data notice. */
function topValueText(top: TopValue): { value: string; hint?: string } {
  if (!top.value) return { value: MISSING };
  return { value: top.value, hint: `في ${top.count} ورقة` };
}

export function ResearchAnalyzerCard({ papers }: { papers: ResearchEvidence[] }) {
  const analysis: ResearchAnalysis = ResearchAnalyzer.analyze(papers);

  const journal = topValueText(analysis.topJournal);
  const country = topValueText({
    ...analysis.topCountry,
    value: analysis.topCountry.value ? countryLabel(analysis.topCountry.value) : null,
  });

  return (
    <div className="bg-slate-900/20 border border-slate-800 p-5 rounded-xl text-right">
      <div className="flex flex-row-reverse justify-between items-center mb-4">
        <h3 className="text-sm font-bold text-white">📈 تحليل النتائج (Research Analyzer)</h3>
        <span className="text-[9px] font-mono text-slate-500 border border-slate-800 px-2 py-1 rounded-lg">
          حسابات وصفية · بدون ذكاء اصطناعي
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Metric
          label="إجمالي الأوراق"
          value={String(analysis.totalPapers)}
          tone="text-emerald-400"
        />
        <Metric
          label="أحدث سنة نشر"
          value={analysis.latestPublicationYear?.toString() ?? MISSING}
          tone="text-blue-400"
        />
        <Metric
          label="أقدم سنة نشر"
          value={analysis.oldestPublicationYear?.toString() ?? MISSING}
          tone="text-amber-400"
        />
        <Metric
          label="متوسط الاستشهادات"
          value={analysis.averageCitationCount?.toLocaleString('en-US') ?? MISSING}
          tone="text-emerald-400"
        />
        <Metric
          label="عدد المجلات"
          value={String(analysis.numberOfJournals)}
          tone="text-slate-200"
        />
        <Metric
          label="عدد الدول"
          value={String(analysis.numberOfCountries)}
          tone="text-slate-200"
        />
        <div className="col-span-2 md:col-span-1">
          <Metric label="أكثر مجلة تكراراً" value={journal.value} hint={journal.hint} compact tone="text-white" />
        </div>
        <div className="col-span-2 md:col-span-1">
          <Metric label="أكثر دولة تكراراً" value={country.value} hint={country.hint} compact tone="text-white" />
        </div>
      </div>

      <p className="text-[9px] text-slate-600 mt-3 leading-relaxed">
        محسوبة من {analysis.totalPapers} ورقة أعادها OpenAlex في هذا الاستعلام. تُحتسب المجلة
        والدولة مرة واحدة لكل ورقة، والحقول غير المسجلة في OpenAlex تُترك كما هي دون تعويض.
      </p>
    </div>
  );
}
