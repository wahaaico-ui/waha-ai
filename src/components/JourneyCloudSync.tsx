'use client';

import { useEffect } from 'react';
import { loadJourney, RESEARCH_JOURNEY_KEY } from '@/lib/research-journey';

// Transitional UI cache only: the API is authoritative. This keeps the existing
// stage pages compatible while they progressively read their inputs from the
// server-backed journey record.
export default function JourneyCloudSync() {
  useEffect(() => {
    const projectId = new URLSearchParams(window.location.search).get('projectId');
    if (!projectId) return;
    void loadJourney(projectId).then(({ outputs }) => {
      const verify = outputs.verify || {};
      const title = outputs.title || {};
      const problem = outputs.problem || {};
      const objectives = outputs.objectives || {};
      const questions = outputs.questions || {};
      const methodology = outputs.methodology || {};
      const literature = outputs.literature || {};
      const analysis = outputs.analysis || {};
      const snapshot = {
        topic: verify.topic,
        decision: verify.decision,
        acceptanceScore: verify.acceptanceScore,
        selectedTitle: title.title,
        problemStatement: problem.problemStatement,
        researchGap: problem.researchGap,
        objectives: objectives.objectives,
        questions: questions.questions,
        methodology,
        selectedPapers: literature.papers,
        analysis,
        updatedAt: new Date().toISOString(),
      };
      localStorage.setItem(RESEARCH_JOURNEY_KEY, JSON.stringify(snapshot));
    }).catch(() => {
      // The page will show its normal locked state if the project is unavailable.
    });
  }, []);
  return null;
}
