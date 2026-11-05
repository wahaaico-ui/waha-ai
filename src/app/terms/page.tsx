import type { Metadata } from 'next';
import PublicInformationPage from '@/components/PublicInformationPage';

export const metadata: Metadata = {
  title: 'إرشادات الاستخدام البحثي | WAHA research use',
  description: 'مراجعة الأدلة والمراجع، وحدود المساعدة الآلية، وتعليمات الجامعة والتصدير. Research use and review guidelines.',
};

export default function ResearchUsePage() {
  return <PublicInformationPage kind="research-use" />;
}
