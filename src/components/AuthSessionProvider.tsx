'use client';

import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { toAuthUser, type AuthUser } from '@/lib/auth/auth-user';

export type { AuthUser };

type AuthSessionContextValue = {
  user: AuthUser | null;
  isAuthenticated: boolean;
  authResolved: boolean;
  signOut: () => Promise<boolean>;
};

const AuthSessionContext = createContext<AuthSessionContextValue | null>(null);

export default function AuthSessionProvider({
  children,
  initialUser,
}: {
  children: React.ReactNode;
  initialUser: AuthUser | null;
}) {
  const [user, setUser] = useState<AuthUser | null>(initialUser);
  const [authResolved, setAuthResolved] = useState(true);
  const signingOutRef = useRef(false);

  useEffect(() => {
    let active = true;
    void supabase.auth.getUser().then(({ data }) => {
      if (!active) return;
      setUser(toAuthUser(data.user));
      if (!signingOutRef.current) setAuthResolved(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      setUser(toAuthUser(session?.user ?? null));
      if (!signingOutRef.current) setAuthResolved(true);
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    signingOutRef.current = true;
    setAuthResolved(false);
    const response = await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' });
    if (!response.ok) {
      signingOutRef.current = false;
      setAuthResolved(true);
      return false;
    }
    await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
    setUser(null);
    return true;
  };

  const value = useMemo(() => ({
    user,
    isAuthenticated: Boolean(user),
    authResolved,
    signOut,
  }), [user, authResolved]);

  return <AuthSessionContext.Provider value={value}>{children}</AuthSessionContext.Provider>;
}

export function useAuthSession() {
  const context = useContext(AuthSessionContext);
  if (!context) throw new Error('useAuthSession must be used within AuthSessionProvider');
  return context;
}
