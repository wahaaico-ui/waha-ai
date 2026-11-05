'use client';

/**
 * ResearchStatisticsPanel
 *
 * Presentational panel for the Research Statistics Engine output. It renders
 * the ten computed statistics exactly as the backend returned them — no
 * fetching, no recalculation, no interpretation, no AI.
 */

import { useUiTranslation } from '@/lib/use-ui-translation';
import React from 'react';
import type { RankedCount, ResearchStatistics, YearCount } from '@/types/ResearchStatistics';

/** Shown for a field OpenAlex did not report — never a fabricated value. */
const MISSING = 'غير متوفر في OpenAlex';

const number = (value: number) => value.toLocaleString('en-US');

function Stat({
  label,
  value,
  hint,
  tone = 'text-slate-800',
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: string;
}) {
  const { text: ui } = useUiTranslation();

  return (
    <div className="bg-slate-50 border border-slate-200 p-3 rounded-lg text-center h-full">
      <p className="text-[10px] text-slate-500 mb-1">{ui(label)}</p>
      <p className={`text-base font-bold ${tone} leading-snug break-words`}>{value === MISSING ? ui(value) : value}</p>
      {hint && <p className="text-[9px] text-slate-600 mt-1">{ui(hint)}</p>}
    </div>
  );
}

/** Ranked list with a proportional bar, scaled to the top entry's count. */
function Ranking({
  title,
  entries,
  barTone,
}: {
  title: string;
  entries: RankedCount[];
  barTone: string;
}) {
  const { text: ui } = useUiTranslation();
  const max = entries.length > 0 ? entries[0].count : 0;

  return (
    <div className="bg-slate-50 border border-slate-200 p-4 rounded-lg">
      <p className="text-[10px] font-bold text-slate-400 mb-3">{ui(title)}</p>

      {entries.length === 0 ? (
        <p className="text-[10px] text-slate-600">{ui(MISSING)}</p>
      ) : (
        <ol className="space-y-2">
          {entries.map((entry, idx) => (
            <li key={`${entry.name}-${idx}`} className="space-y-1">
              <div className="flex flex-row-reverse justify-between items-baseline gap-2">
                <span className="text-[10px] text-slate-700 leading-snug flex-1 break-words">
                  <span className="text-slate-600 font-mono ml-1">{idx + 1}.</span>
                  {entry.name}
                </span>
                <span className="text-[10px] font-mono text-slate-400 shrink-0">
                  {number(entry.count)}
                </span>
              </div>
              <div className="h-1 bg-slate-200 rounded-full overflow-hidden" dir="ltr">
                <div
                  className={`h-full ${barTone} rounded-full`}
                  style={{ width: max > 0 ? `${(entry.count / max) * 100}%` : '0%' }}
                />
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

/**
 * Papers per year as a bar row, oldest year on the left. Only years present in
 * the results are shown, matching the engine's output.
 */
function YearDistribution({ years }: { years: YearCount[] }) {
  const { text: ui } = useUiTranslation();

  const max = years.reduce((highest, entry) => Math.max(highest, entry.count), 0);

  return (
    <div className="bg-slate-50 border border-slate-200 p-4 rounded-lg">
      <p className="text-[10px] font-bold text-slate-400 mb-3">{ui("عدد المنشورات لكل سنة")}</p>

      {years.length === 0 ? (
        <p className="text-[10px] text-slate-600">{ui(MISSING)}</p>
      ) : (
        <div className="flex items-end gap-1 h-28 overflow-x-auto" dir="ltr">
          {years.map(entry => (
            <div
              key={entry.year}
              className="flex flex-col items-center justify-end gap-1 min-w-[26px] flex-1 h-full"
              title={`${entry.year}: ${entry.count}`}
            >
              <span className="text-[9px] font-mono text-slate-400">{entry.count}</span>
              <div
                className="w-full bg-gradient-to-t from-amber-600 to-amber-400 rounded-t-sm"
                style={{ height: max > 0 ? `${(entry.count / max) * 100}%` : '0%' }}
              />
              <span className="text-[8px] font-mono text-slate-600">{entry.year}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function ResearchStatisticsPanel({ statistics }: { statistics: ResearchStatistics }) {
  const { text: ui } = useUiTranslation();

  const top = statistics.highestCitedPaper;

  return (
    <div className="bg-white border border-slate-200 p-5 rounded-xl text-start space-y-4">
      <div className="flex flex-row-reverse justify-between items-center">
        <h3 className="text-sm font-bold text-ink">{ui("📊 محرك الإحصاءات البحثية")}</h3>
        <span className="text-[9px] font-mono text-slate-500 border border-slate-200 px-2 py-1 rounded-lg">
          {ui("حسابات من OpenAlex · بدون ذكاء اصطناعي")}</span>
      </div>

      {/* The ten statistics: 1–6 as scalar tiles */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Stat
          label={ui("إجمالي الأوراق")}
          value={number(statistics.totalPapers)}
          tone="text-success"
        />
        <Stat
          label={ui("أقدم سنة نشر")}
          value={statistics.earliestPublicationYear?.toString() ?? MISSING}
          tone="text-amber-700"
        />
        <Stat
          label={ui("أحدث سنة نشر")}
          value={statistics.latestPublicationYear?.toString() ?? MISSING}
          tone="text-primary-dark"
        />
        <Stat
          label={ui("متوسط سنة النشر")}
          value={statistics.averagePublicationYear?.toString() ?? MISSING}
          tone="text-primary-dark"
          hint={`محسوب من ${number(statistics.coverage.papersWithPublicationYear)} ورقة`}
        />
        <Stat
          label={ui("إجمالي الاستشهادات")}
          value={number(statistics.totalCitations)}
          tone="text-success"
        />
        <Stat
          label={ui("متوسط الاستشهادات")}
          value={statistics.averageCitations?.toString() ?? MISSING}
          tone="text-success"
        />
      </div>

      {/* 7. Highest cited paper */}
      <div className="bg-slate-50 border border-slate-200 p-4 rounded-lg">
        <p className="text-[10px] font-bold text-slate-400 mb-2">{ui("الورقة الأكثر استشهاداً")}</p>

        {!top ? (
          <p className="text-[10px] text-slate-600">{ui(MISSING)}</p>
        ) : (
          <div className="space-y-2">
            <p className="text-xs font-bold text-ink leading-snug">{top.title}</p>
            <div className="flex flex-wrap flex-row-reverse gap-x-4 gap-y-1 text-[10px]">
              <span className="text-success font-bold">
                {number(top.citationCount)} {ui("استشهاد")}</span>
              <span className="text-slate-400">{top.publicationYear ?? '—'}</span>
              <span className="text-slate-400">{top.journal ?? ui("مجلة غير محددة")}</span>
            </div>
            {top.authors.length > 0 && (
              <p className="text-[10px] text-slate-500 leading-relaxed">
                {top.authors.join(' · ')}
              </p>
            )}
            {top.doi && (
              <a
                href={top.doi}
                target="_blank"
                rel="noopener noreferrer"
                dir="ltr"
                className="text-primary-dark text-[9px] break-all hover:underline block text-left"
              >
                {top.doi}
              </a>
            )}
          </div>
        )}
      </div>

      {/* 8 & 9. Rankings */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Ranking
          title={ui("أكثر المجلات تكراراً (من {0} مجلة)", [number(statistics.distinctJournals)])}
          entries={statistics.topJournals}
          barTone="bg-blue-500"
        />
        <Ranking
          title={ui("أكثر المفاهيم تكراراً (من {0} مفهوم)", [number(statistics.distinctConcepts)])}
          entries={statistics.topConcepts}
          barTone="bg-emerald-500"
        />
      </div>

      {/* 10. Publications per year */}
      <YearDistribution years={statistics.publicationsPerYear} />

      <p className="text-[9px] text-slate-600 leading-relaxed">
        {ui("محسوبة من")}{' '}{number(statistics.totalPapers)} {ui("ورقة أعادها OpenAlex في هذا الاستعلام. تُحتسب المجلة والمفهوم مرة واحدة لكل ورقة، والحقول غير المسجلة في OpenAlex تُترك كما هي دون تعويض (")}{' '}{number(statistics.coverage.papersWithJournal)} {ui("ورقة لها مجلة مسجلة،")}{' '}{' '}
        {number(statistics.coverage.papersWithConcepts)} {ui("ورقة لها تصنيف مفاهيم).")}</p>
    </div>
  );
}
