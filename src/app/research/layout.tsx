import type { ReactNode } from 'react';
import ResearchUtilityDock from '@/components/ResearchUtilityDock';

export default function ResearchLayout({ children }: { children: ReactNode }) {
  return <><div className="pb-20 print:pb-0">{children}</div><ResearchUtilityDock /></>;
}
