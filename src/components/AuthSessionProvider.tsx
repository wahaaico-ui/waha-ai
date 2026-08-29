'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase/client';

export type AuthUser = {
  id: string;
  email: string | null;
  fullName: string | null;
  specialty: string | null;
};

type AuthSessionContextValue = {
  user: AuthUser | null;
  isAuthenticated: boolean;
  authResolved: boolean;
};

const AuthSessionContext = createContext<AuthSessionContextValue | null>(null);

function normalizeUser(user: {
  id: string;
  email?: string;
  user_metadata?: Record<string, unknown>;
} | null): AuthUser | null {
  if (!user) return null;
  const metadata = user.user_metadata ?? {};
  const fullName = typeof metadata.full_name === 'string'
    ? metadata.full_name
    : typeof metadata.name === 'string'
      ? metadata.name
      : null;
  return {
    id: user.id,
    email: user.email ?? null,
    fullName,
    specialty: typeof metadata.specialty === 'string' ? metadata.specialty : null,
  };
}

export default function AuthSessionProvider({
  children,
  initialUser,
}: {
  children: React.ReactNode;
  initialUser: AuthUser | null;
}) {
  const [user, setUser] = useState<AuthUser | null>(initialUser);
  const [authResolved, setAuthResolved] = useState(true);

  useEffect(() => {
    let active = true;
    void supabase.auth.getUser().then(({ data }) => {
      if (!active) return;
      setUser(normalizeUser(data.user));
      setAuthResolved(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      setUser(normalizeUser(session?.user ?? null));
      setAuthResolved(true);
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo(() => ({
    user,
    isAuthenticated: Boolean(user),
    authResolved,
  }), [user, authResolved]);

  return <AuthSessionContext.Provider value={value}>{children}</AuthSessionContext.Provider>;
}

export function useAuthSession() {
  const context = useContext(AuthSessionContext);
  if (!context) throw new Error('useAuthSession must be used within AuthSessionProvider');
  return context;
}
