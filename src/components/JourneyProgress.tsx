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
  { id: "conclusions", labelAr: "الاستنتاجات", labelEn: "Conclusions", href: "/research/conclusions", enabled: true  },
  { id: "recommendations", labelAr: "التوصيات", labelEn: "Recommendations", href: "/research/recommendations", enabled: true  },
  { id: "publication", labelAr: "النشر", labelEn: "Publication", href: "/research/publication", enabled: true  },
];

export type PhaseId = typeof JOURNEY_PHASES[number]["id"];

interface JourneyProgressProps {
  current: PhaseId;
  lang?: "ar" | "en";
}

export default function JourneyProgress({ current, lang = "ar" }: JourneyProgressProps) {
  const projectId = useProjectId();
  const currentIndex = JOURNEY_PHASES.findIndex(p => p.id === current);
  const active = JOURNEY_PHASES[currentIndex];
  if (!active) return null;
  const arabic = lang === 'ar';

  return (
    <section dir={arabic ? 'rtl' : 'ltr'} className="border-b border-slate-200 bg-white/90">
      <div className="mx-auto max-w-6xl px-4 py-4 sm:px-6">
        <p className="text-xs font-medium text-slate-500">{arabic ? 'مساحة بحثك' : 'Your research space'}</p>
        <p className="mt-1 text-lg font-semibold text-slate-900">
          {arabic ? 'نركز الآن على ' : 'Now exploring: '}{arabic ? active.labelAr : active.labelEn}
        </p>
        <p className="mt-1 text-sm leading-6 text-slate-600">
          {arabic ? 'خذ وقتك في تطوير الفكرة. راجع محتواك هنا، ثم تابع من الإجراء أسفله.' : 'Take your time shaping the idea. Review your work here, then continue using the action below.'}
        </p>
        <details className="mt-3">
          <summary className="w-fit cursor-pointer rounded-lg px-2 py-1 text-sm font-medium text-blue-700 focus-visible:outline-2 focus-visible:outline-blue-600">
            {arabic ? 'استعرض خريطة بحثك' : 'Explore your research map'}
          </summary>
          <nav aria-label={arabic ? 'خريطة البحث' : 'Research map'} className="mt-3 flex flex-wrap gap-2">
            {JOURNEY_PHASES.map((phase, index) => {
              const label = arabic ? phase.labelAr : phase.labelEn;
              return index <= currentIndex && phase.enabled ? (
                <Link key={phase.id} aria-current={phase.id === current ? 'page' : undefined}
                  href={`${phase.href}${projectId ? `?projectId=${encodeURIComponent(projectId)}` : ''}`}
                  className={`rounded-full border px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-blue-600 ${phase.id === current ? 'border-blue-200 bg-blue-50 text-blue-800' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                  {label}
                </Link>
              ) : <span key={phase.id} className="rounded-full border border-transparent px-3 py-2 text-sm text-slate-500">{label}</span>;
            })}
          </nav>
        </details>
      </div>
    </section>
  );
}
