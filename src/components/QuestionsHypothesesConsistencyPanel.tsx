import type { QuestionsHypothesesConsistencyReport } from '@/lib/research-objects/types';
import ResearchConsistencyAdvisory, { type AdvisoryProps } from './ResearchConsistencyAdvisory';


export default function QuestionsHypothesesConsistencyPanel({ report, ...props }: AdvisoryProps & { report: QuestionsHypothesesConsistencyReport | null }) {
  return <ResearchConsistencyAdvisory {...props} hasReport={Boolean(report)} relationship="الأسئلة ↔ الفرضيات" prompts={["هل يحتاج تصميم البحث إلى فرضيات أم يكتفي بالأسئلة؟","هل الفرضيات، إن لزمت، قابلة للفحص وتتصل بالأسئلة؟"]} />;
}
