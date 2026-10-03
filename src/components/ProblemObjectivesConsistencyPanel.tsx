import type { ProblemObjectivesConsistencyReport } from '@/lib/research-objects/types';
import ResearchConsistencyAdvisory, { type AdvisoryProps } from './ResearchConsistencyAdvisory';
export type { ConsistencyPanelStatus } from './ResearchConsistencyAdvisory';

export default function ProblemObjectivesConsistencyPanel({ report, ...props }: AdvisoryProps & { report: ProblemObjectivesConsistencyReport | null }) {
  return <ResearchConsistencyAdvisory {...props} hasReport={Boolean(report)} relationship="المشكلة ↔ الأهداف" prompts={["هل يعالج كل هدف جزءاً محدداً من مشكلة البحث؟","هل المجتمع والسياق واضحان في المشكلة والأهداف؟"]} />;
}
