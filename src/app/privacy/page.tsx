import type { Metadata } from 'next';
import PublicInformationPage from '@/components/PublicInformationPage';

export const metadata: Metadata = {
  title: 'بياناتك في الواحة | Your data in WAHA',
  description: 'المعلومات التي تحفظها الواحة، والخدمات المساندة، وخيارات إدارة بيانات الحساب. WAHA data handling and account controls.',
};

export default function PrivacyPage() {
  return <PublicInformationPage kind="privacy" />;
}
