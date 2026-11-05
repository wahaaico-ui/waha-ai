import type { Metadata } from 'next';
import SampleSizePublicPage from '@/components/SampleSizePublicPage';

export const metadata: Metadata = {
  title: 'حاسبة حجم العينة المجانية | Free Sample Size Calculator — WAHA',
  description: 'Cochran and Krejcie & Morgan survey planning, approximate hypothesis sample sizes, PNG diagrams and methodology drafts with APA references. Free, no sign-up.',
  alternates: { canonical: 'https://waha.systems/tools/sample-size' },
  openGraph: { title: 'WAHA — Free Sample Size Calculator', description: 'Plan your sample. Understand the assumptions. Download the diagram and methodology draft.', url: 'https://waha.systems/tools/sample-size', type: 'website' },
};

export default function SampleSizePage() { return <SampleSizePublicPage/>; }
