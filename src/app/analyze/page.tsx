import { redirect } from 'next/navigation';

export default async function AnalyzePage({
  searchParams,
}: {
  searchParams: Promise<{ projectId?: string }>;
}) {
  const { projectId } = await searchParams;
  redirect(projectId
    ? `/research/analysis?projectId=${encodeURIComponent(projectId)}`
    : '/dashboard');
}
