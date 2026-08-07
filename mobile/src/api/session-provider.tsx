/** Loads the persisted session on boot and exposes sign in / sign out. */

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';

import { setSessionExpiredHandler } from './client';
import {
  clearTokens,
  loadSession,
  saveSession,
  SessionContext,
  type Session,
  type SessionContextValue,
} from './session';
import { clearSelectedAccount } from '@/lib/account-store';

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    loadSession()
      .then((restored) => {
        if (!cancelled) setSession(restored);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback(async (next: Session) => {
    await saveSession(next);
    setSession(next);
  }, []);

  const signOut = useCallback(async () => {
    await clearTokens();
    // The account scope belongs to the session that picked it.
    clearSelectedAccount();
    setSession(null);
  }, []);

  // The client can only clear SecureStore; dropping the in-memory session is
  // what actually sends the user to the login screen (see the handler's doc).
  useEffect(() => {
    setSessionExpiredHandler(() => {
      clearSelectedAccount();
      setSession(null);
    });
    return () => setSessionExpiredHandler(null);
  }, []);

  const value = useMemo<SessionContextValue>(
    () => ({ session, isLoading, signIn, signOut }),
    [session, isLoading, signIn, signOut],
  );

  return <SessionContext value={value}>{children}</SessionContext>;
}
