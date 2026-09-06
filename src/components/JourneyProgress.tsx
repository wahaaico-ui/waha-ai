"use client";

import Link from "next/link";
import { useProjectId } from '@/lib/use-project-id';

// The active phases of the WAHA research journey.
export const JOURNEY_PHASES = [
  { id: "verify",     labelAr: "الاستكشاف", labelEn: "Explore",    href: "/verify-idea", enabled: true  },
  { id: "title",      labelAr: "العنوان",   labelEn: "Title",      href: "/research",    enabled: true  },
  { id: "problem",    labelAr: "المشكلة",   labelEn: "Problem",    href: "/research/problem", enabled: true  },
  { id: "objectives", labelAr: "الأهداف",   labelEn: "Objectives", href: "/research/objectives", enabled: true  },
  { id: "questions",  labelAr: "الأسئلة",   labelEn: "Questions",  href: "/research/questions", enabled: true  },
  { id: "hypotheses", labelAr: "الفرضيات",  labelEn: "Hypotheses", href: "/research/hypotheses", enabled: true  },
  { id: "method",     labelAr: "المنهجية",  labelEn: "Method",     href: "/research/methodology", enabled: true  },
  { id: "design",     labelAr: "التصميم",   labelEn: "Design",     href: "/research/design", enabled: true  },
  { id: "instrument", labelAr: "الأداة",     labelEn: "Instrument", href: "/research/instrument", enabled: true  },
  { id: "literature", labelAr: "الأدبيات",  labelEn: "Literature", href: "/research/literature", enabled: true  },
  { id: "analysis",   labelAr: "تحليل الأدبيات", labelEn: "Literature synthesis", href: "/research/analysis", enabled: true  },
  { id: "analysis_input", labelAr: "مخرجات التحليل", labelEn: "Analysis outputs", href: "/research/analysis-input", enabled: true  },
  { id: "results", labelAr: "النتائج", labelEn: "Results", href: "/research/results", enabled: true  },
  { id: "discussion", labelAr: "المناقشة", labelEn: "Discussion", href: "/research/discussion", enabled: true  },
];

export type PhaseId = typeof JOURNEY_PHASES[number]["id"];

interface JourneyProgressProps {
  current: PhaseId;
  lang?: "ar" | "en";
}

export default function JourneyProgress({ current, lang = "ar" }: JourneyProgressProps) {
  const projectId = useProjectId();
  const currentIndex = JOURNEY_PHASES.findIndex(p => p.id === current);
  const totalPhases = JOURNEY_PHASES.length;
  const percentComplete = Math.round(((currentIndex + 1) / totalPhases) * 100);

  return (
    <div dir={lang === "ar" ? "rtl" : "ltr"} className="border-b border-slate-200 bg-white/90 backdrop-blur-xl">
      <div className="w-full max-w-6xl mx-auto overflow-x-auto px-4 py-4">
      <div className="min-w-[720px]">
      {/* Phase circles + labels */}
      <div className="flex items-center justify-between mb-3 relative">
        {/* Connector line (behind circles) */}
        <div className="absolute top-4 left-0 right-0 h-px bg-slate-200" style={{ zIndex: 0 }}></div>
        <div
          className="absolute top-4 h-px bg-blue-600 transition-all duration-500"
          style={{
            zIndex: 1,
            width: `${(currentIndex / (totalPhases - 1)) * 100}%`,
            [lang === "ar" ? "right" : "left"]: 0,
          }}
        ></div>

        {JOURNEY_PHASES.map((phase, i) => {
          const isDone = i < currentIndex;
          const isCurrent = i === currentIndex;
          const circleClasses = isDone
            ? "bg-blue-600 text-white border-blue-600"
            : isCurrent
            ? "bg-blue-600 text-white border-blue-300 ring-4 ring-blue-100 scale-110"
            : "bg-white text-slate-400 border-slate-200";

          const labelClasses = isDone
            ? "text-blue-700 font-semibold"
            : isCurrent
            ? "text-slate-900 font-bold"
            : "text-slate-500";

          const label = lang === "ar" ? phase.labelAr : phase.labelEn;
          const content = (
            <div className="flex flex-col items-center gap-2 relative" style={{ zIndex: 2 }}>
              <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs font-bold transition-all ${circleClasses}`}>
                {isDone ? "✓" : i + 1}
              </div>
              <span className={`text-[10px] md:text-xs ${labelClasses}`}>{label}</span>
            </div>
          );

          // Make done + current + enabled phases clickable
          if ((isDone || isCurrent) && phase.enabled) {
            return (
              <Link key={phase.id} href={`${phase.href}${projectId ? `?projectId=${encodeURIComponent(projectId)}` : ''}`} className="hover:opacity-80 transition">
                {content}
              </Link>
            );
          }
          return <div key={phase.id}>{content}</div>;
        })}
      </div>

      {/* Percent complete bar */}
      <div className="mt-3">
        <div className="flex justify-between items-center text-[11px] mb-1.5">
          <span className="text-slate-500">
            {lang === "ar" ? `المرحلة ${currentIndex + 1} من ${totalPhases}` : `Phase ${currentIndex + 1} of ${totalPhases}`}
          </span>
          <span className="font-semibold text-blue-600">{percentComplete}%</span>
        </div>
        <div className="w-full bg-slate-200 rounded-full h-1.5">
          <div
            className="h-1.5 rounded-full bg-blue-600 transition-all duration-500"
            style={{ width: `${percentComplete}%` }}
          ></div>
        </div>
      </div>
      </div>
      </div>
    </div>
  );
}
