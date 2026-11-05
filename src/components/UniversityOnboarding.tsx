'use client';

import UniversityPolicyEditor from '@/components/UniversityPolicyEditor';

export default function UniversityOnboarding({ projectId, onComplete, onSkip }: {
  projectId: string;
  onComplete: (policy: string) => void;
  onSkip?: () => void;
}) {
  return <main className="min-h-screen bg-slate-50 px-4 py-7 sm:px-6">
    <div className="mx-auto max-w-4xl"><UniversityPolicyEditor key={projectId} projectId={projectId} onComplete={onComplete} onSkip={onSkip} /></div>
  </main>;
}
