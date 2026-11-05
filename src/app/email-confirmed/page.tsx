import EmailConfirmationView from '@/components/EmailConfirmationView';
import { createClient } from '@/lib/supabase/server';
import { safeAuthRedirect } from '@/lib/auth/safe-redirect';

export default async function EmailConfirmedPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const destination = safeAuthRedirect(next, '/verify-idea');
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const isConfirmed = Boolean(user?.email_confirmed_at);

  return <EmailConfirmationView isConfirmed={isConfirmed} destination={destination} />;
}
