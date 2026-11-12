import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { isShareToken, parseShareSections } from '@/lib/career-share';
import { loadCareer } from '@/lib/scholarly-career';
import { normalizeOrcid } from '@/lib/orcid';
import SharedCareer from '@/components/SharedCareer';

export const dynamic = 'force-dynamic';
// A personal page reached only through its link: never indexed.
export const metadata: Metadata = { title: 'مسيرة بحثية', robots: { index: false, follow: false } };

/** The public view of a shared career: OpenAlex data for the linked iD, only the chosen sections (DOC-30-03). */
export default async function SharedCareerPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!isShareToken(token)) notFound();
  const supabase = await createClient();
  const { data } = await supabase.rpc('shared_career', { p_token: token });
  const row = Array.isArray(data) ? data[0] as { orcid?: unknown; sections?: unknown } | undefined : undefined;
  const orcid = normalizeOrcid(row?.orcid);
  const sections = parseShareSections(row?.sections);
  // A revoked, unknown or unreadable link looks the same: not found.
  if (!orcid || !sections) notFound();
  const career = await loadCareer(orcid).catch(() => null);
  return <SharedCareer career={career} sections={sections} />;
}
