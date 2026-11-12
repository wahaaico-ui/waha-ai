import { NextResponse } from 'next/server';

/**
 * Nineteen early AI routes, retired on 13 Nov 2026 at the owner's request. They
 * wrote research text with a language model from whatever the request sent,
 * with no project sources, and no page called them; they only spent the AI
 * budget. Each now points to the page that does the job from the saved project.
 */
export const RETIRED_AI_ROUTES = {
  '/api/chat': '/research/journey',
  '/api/academic/abstract': '/research/publication',
  '/api/academic/title-engine': '/research/journey',
  '/api/academic/idea-engine': '/verify-idea',
  '/api/academic/chat': '/research/journey',
  '/api/academic/pdf-chat': '/research/library',
  '/api/academic/intelligence': '/research/intelligence',
  '/api/academic/literature-synth': '/research/analysis',
  '/api/academic/methodology': '/research/methodology',
  '/api/academic/literature-review': '/research/literature',
  '/api/academic/proposal': '/research/journey',
  '/api/academic/readiness': '/research/journey',
  '/api/academic/decision': '/verify-idea',
  '/api/academic/seminar': '/research/seminar',
  '/api/academic/defense': '/research/seminar',
  '/api/academic/survey': '/research/instrument',
  '/api/academic/timeline': '/research/journey',
  '/api/academic/analyzer': '/research/analysis',
  '/api/academic/matrix': '/research/literature',
} as const;

export type RetiredAiRoute = keyof typeof RETIRED_AI_ROUTES;

export function retiredAiRoute(path: RetiredAiRoute) {
  return NextResponse.json({
    error: 'هذا المسار متوقف: كان يكتب نصًا بالذكاء الاصطناعي دون مصادر مشروعك. استعمل الصفحة المذكورة.',
    next: RETIRED_AI_ROUTES[path],
  }, { status: 410 });
}
