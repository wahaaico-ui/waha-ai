import type { ReactNode } from 'react';
import ResearchUtilityDock from '@/components/ResearchUtilityDock';
import ResearchWorkspaceNav from '@/components/ResearchWorkspaceNav';

export default function ResearchLayout({ children }: { children: ReactNode }) {
  return <><ResearchWorkspaceNav /><div className="pb-20 print:pb-0">{children}</div><ResearchUtilityDock /></>;
}
