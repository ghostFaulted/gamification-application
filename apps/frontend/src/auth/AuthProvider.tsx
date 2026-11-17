import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { login as apiLogin, logout as apiLogout, type LoginCredentials } from '../api/auth';
import { setUnauthorizedHandler } from '../api/client';
import { AuthContext, type AuthContextValue, type LogoutReason } from './AuthContext';
import type { AuthUser } from '@gamification/shared';
import { loadStoredUser, storeUser } from './storage';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(loadStoredUser);
  const [logoutReason, setLogoutReason] = useState<LogoutReason | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const login = useCallback(async (credentials: LoginCredentials) => {
    const signedIn = await apiLogin(credentials);
    setLogoutReason(null);
    setUser(signedIn);
  }, []);

  const logout = useCallback(async (reason: LogoutReason = 'manual') => {
    // An expired session is already gone on the server, so only a manual logout calls the API.
    if (reason === 'manual') {
      setIsLoggingOut(true);
      // The user is leaving anyway, so a 401 from the logout call must not show "Sesja wygasła".
      setUnauthorizedHandler(null);
      try {
        await apiLogout();
      } catch {
        // Ignore: the local session is cleared anyway and the server one will expire.
      } finally {
        setIsLoggingOut(false);
      }
    }
    setLogoutReason(reason);
    setUser(null);
  }, []);

  // Keep the user across page reloads (see storage.ts).
  useEffect(() => storeUser(user), [user]);

  // While someone is signed in, any 401 from apiFetch ends the session as expired.
  useEffect(() => {
    if (!user) return;
    setUnauthorizedHandler(() => void logout('expired'));
    return () => setUnauthorizedHandler(null);
  }, [user, logout]);

  const value = useMemo<AuthContextValue>(
    () => ({ user, logoutReason, isLoggingOut, login, logout }),
    [user, logoutReason, isLoggingOut, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
