import type { QuestionsMethodologyConsistencyReport } from '@/lib/research-objects/types';
import ResearchConsistencyAdvisory, { type AdvisoryProps } from './ResearchConsistencyAdvisory';


export default function QuestionsMethodologyConsistencyPanel({ report, ...props }: AdvisoryProps & { report: QuestionsMethodologyConsistencyReport | null }) {
  return <ResearchConsistencyAdvisory {...props} hasReport={Boolean(report)} relationship="الأسئلة ↔ المنهجية" prompts={["هل يستطيع المنهج المختار الإجابة عن الأسئلة؟","هل المجتمع والعينة والأداة مناسبون للتصميم المقصود؟"]} />;
}
