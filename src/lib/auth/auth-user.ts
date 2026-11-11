import { researcherProfileFromMetadata } from '@/lib/researcher-profile';

/** The signed-in researcher as the pages see it, built the same way on the server and in the browser. */
export type AuthUser = {
  id: string;
  email: string | null;
  fullName: string | null;
  specialty: string | null;
  specialtyDetail: string | null;
};

export function toAuthUser(user: { id: string; email?: string; user_metadata?: Record<string, unknown> } | null): AuthUser | null {
  if (!user) return null;
  const profile = researcherProfileFromMetadata(user.user_metadata);
  return { id: user.id, email: user.email ?? null, fullName: profile.fullName, specialty: profile.specialty, specialtyDetail: profile.specialtyDetail };
}
