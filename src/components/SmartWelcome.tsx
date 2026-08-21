"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface HistoryItem {
  id: string;
  topic: string;
  acceptance_score: number;
  decision: string;
  total_papers: number;
  created_at: string;
}

function timeAgoAr(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diffMs = now - then;
  const min = Math.floor(diffMs / 60000);
  const hr = Math.floor(diffMs / 3600000);
  const day = Math.floor(diffMs / 86400000);
  if (min < 1) return "الآن";
  if (min < 60) return `قبل ${min} دقيقة`;
  if (hr < 24) return `قبل ${hr} ساعة`;
  if (day < 7) return `قبل ${day} يوم`;
  if (day < 30) return `قبل ${Math.floor(day / 7)} أسبوع`;
  return `قبل ${Math.floor(day / 30)} شهر`;
}

interface SmartWelcomeProps {
  lang?: "ar" | "en";
}

export default function SmartWelcome({ lang = "ar" }: SmartWelcomeProps) {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    fetch("/api/verify-idea/history")
      .then(r => r.json())
      .then(d => { setItems(d.items || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading || items.length === 0 || dismissed) return null;

  const latest = items[0];
  const decisionLabel = latest.decision === "proceed" ? "قوية" : latest.decision === "improve" ? "تحتاج تحسين" : "ضعيفة";
  const decisionColor = latest.decision === "proceed" ? "text-emerald-400" : latest.decision === "improve" ? "text-amber-400" : "text-rose-400";
  const ago = timeAgoAr(latest.created_at);
  const encodedTopic = encodeURIComponent(latest.topic);

  return (
    <div dir={lang === "ar" ? "rtl" : "ltr"} className="max-w-4xl mx-auto px-6 pt-8">
      <div className="relative bg-gradient-to-r from-slate-900/70 to-teal-950/40 border border-teal-500/25 rounded-2xl p-5 backdrop-blur">
        <button
          onClick={() => setDismissed(true)}
          className="absolute top-3 left-3 text-slate-500 hover:text-white text-xs px-2 py-1 rounded transition"
          aria-label="إغلاق"
        >
          ✕
        </button>
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center text-lg">
            👋
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-teal-300 text-xs font-semibold mb-1">مرحباً بعودتك</div>
            <div className="text-white text-sm leading-relaxed mb-3">
              آخر فكرة فحصتها <span className="text-slate-400">({ago})</span>:
            </div>
            <div className="bg-slate-950/60 rounded-lg p-3 mb-3 border border-slate-800">
              <div className="text-slate-200 text-sm mb-2 line-clamp-2">"{latest.topic}"</div>
              <div className="flex items-center gap-3 text-xs">
                <span className={`font-bold ${decisionColor}`}>{latest.acceptance_score}/100</span>
                <span className="text-slate-500">·</span>
                <span className="text-slate-400">{decisionLabel}</span>
                <span className="text-slate-500">·</span>
                <span className="text-slate-400">{latest.total_papers} دراسة</span>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href={`/verify-idea`}
                className="inline-flex items-center gap-2 px-4 py-2 bg-teal-500/20 hover:bg-teal-500/30 text-teal-300 text-xs font-semibold rounded-lg border border-teal-500/30 transition"
              >
                فحص جديد
              </Link>
              {latest.decision === "proceed" && (
                <Link
                  href={`/research?topic=${encodedTopic}`}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:opacity-90 text-white text-xs font-semibold rounded-lg transition"
                >
                  متابعة إلى صياغة العنوان ←
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
