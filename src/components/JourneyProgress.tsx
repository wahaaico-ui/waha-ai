"use client";

import Link from "next/link";

// The 6 phases of the Waha research journey
export const JOURNEY_PHASES = [
  { id: "verify",     labelAr: "التحقق",    labelEn: "Verify",     href: "/verify-idea", enabled: true  },
  { id: "title",      labelAr: "العنوان",   labelEn: "Title",      href: "/research",    enabled: true  },
  { id: "problem",    labelAr: "المشكلة",   labelEn: "Problem",    href: "/research/problem", enabled: true  },
  { id: "objectives", labelAr: "الأهداف",   labelEn: "Objectives", href: "#",            enabled: false },
  { id: "questions",  labelAr: "الأسئلة",   labelEn: "Questions",  href: "#",            enabled: false },
  { id: "method",     labelAr: "المنهجية",  labelEn: "Method",     href: "#",            enabled: false },
];

export type PhaseId = typeof JOURNEY_PHASES[number]["id"];

interface JourneyProgressProps {
  current: PhaseId;
  lang?: "ar" | "en";
}

export default function JourneyProgress({ current, lang = "ar" }: JourneyProgressProps) {
  const currentIndex = JOURNEY_PHASES.findIndex(p => p.id === current);
  const totalPhases = JOURNEY_PHASES.length;
  const percentComplete = Math.round(((currentIndex + 1) / totalPhases) * 100);

  return (
    <div dir={lang === "ar" ? "rtl" : "ltr"} className="w-full max-w-5xl mx-auto px-4 py-6">
      {/* Phase circles + labels */}
      <div className="flex items-center justify-between mb-4 relative">
        {/* Connector line (behind circles) */}
        <div className="absolute top-4 left-0 right-0 h-0.5 bg-slate-200" style={{ zIndex: 0 }}></div>
        <div
          className="absolute top-4 h-0.5 bg-gradient-to-r from-emerald-500 to-teal-500 transition-all duration-500"
          style={{
            zIndex: 1,
            width: `${(currentIndex / (totalPhases - 1)) * 100}%`,
            [lang === "ar" ? "right" : "left"]: 0,
          }}
        ></div>

        {JOURNEY_PHASES.map((phase, i) => {
          const isDone = i < currentIndex;
          const isCurrent = i === currentIndex;
          const isFuture = i > currentIndex;

          const circleClasses = isDone
            ? "bg-emerald-500 text-white border-emerald-500"
            : isCurrent
            ? "bg-gradient-to-br from-emerald-500 to-teal-500 text-white border-teal-500 ring-4 ring-teal-100 scale-110"
            : "bg-white text-slate-400 border-slate-300";

          const labelClasses = isDone
            ? "text-emerald-700 font-semibold"
            : isCurrent
            ? "text-teal-700 font-bold"
            : "text-slate-400";

          const label = lang === "ar" ? phase.labelAr : phase.labelEn;
          const content = (
            <div className="flex flex-col items-center gap-2 relative" style={{ zIndex: 2 }}>
              <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs font-bold transition-all ${circleClasses}`}>
                {isDone ? "✓" : i + 1}
              </div>
              <span className={`text-xs md:text-sm ${labelClasses}`}>{label}</span>
            </div>
          );

          // Make done + current + enabled phases clickable
          if ((isDone || isCurrent) && phase.enabled) {
            return (
              <Link key={phase.id} href={phase.href} className="hover:opacity-80 transition">
                {content}
              </Link>
            );
          }
          return <div key={phase.id}>{content}</div>;
        })}
      </div>

      {/* Percent complete bar */}
      <div className="mt-2">
        <div className="flex justify-between items-center text-xs mb-1">
          <span className="text-slate-500">
            {lang === "ar" ? `المرحلة ${currentIndex + 1} من ${totalPhases}` : `Phase ${currentIndex + 1} of ${totalPhases}`}
          </span>
          <span className="font-semibold text-teal-600">{percentComplete}%</span>
        </div>
        <div className="w-full bg-slate-100 rounded-full h-1.5">
          <div
            className="h-1.5 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all duration-500"
            style={{ width: `${percentComplete}%` }}
          ></div>
        </div>
      </div>
    </div>
  );
}
