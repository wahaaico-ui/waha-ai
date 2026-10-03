import type { ObjectivesQuestionsConsistencyReport } from '@/lib/research-objects/types';
import ResearchConsistencyAdvisory, { type AdvisoryProps } from './ResearchConsistencyAdvisory';


export default function ObjectivesQuestionsConsistencyPanel({ report, ...props }: AdvisoryProps & { report: ObjectivesQuestionsConsistencyReport | null }) {
  return <ResearchConsistencyAdvisory {...props} hasReport={Boolean(report)} relationship="الأهداف ↔ الأسئلة" prompts={["هل يقابل كل هدف سؤال يمكن الإجابة عنه؟","هل تحافظ الأسئلة على المجتمع والسياق المقصودين؟"]} />;
}
