import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { login as apiLogin, logout as apiLogout, type LoginCredentials } from '../api/auth';
import { ApiError, setUnauthorizedHandler } from '../api/client';
import { AuthContext, type AuthContextValue, type LogoutReason } from './AuthContext';
import type { AuthUser } from '@gamification/shared';
import { loadStoredUser, storeUser } from './storage';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(loadStoredUser);
  const [logoutReason, setLogoutReason] = useState<LogoutReason | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);

  const login = useCallback(async (credentials: LoginCredentials) => {
    const signedIn = await apiLogin(credentials);
    setLogoutReason(null);
    // A failed "Wyloguj" may have ended after the session expired; do not show its error now.
    setLogoutError(null);
    setUser(signedIn);
  }, []);

  const logout = useCallback(async (reason: LogoutReason = 'manual') => {
    // An expired session is already gone on the server, so only a manual logout calls the API.
    if (reason === 'manual') {
      setIsLoggingOut(true);
      setLogoutError(null);
      try {
        await apiLogout();
      } catch (error) {
        // 401 means the server session is already gone, so the logout has succeeded anyway.
        // Any other failure keeps the user signed in, so they can try again.
        if (!(error instanceof ApiError && error.status === 401)) {
          setLogoutError('Nie udało się wylogować. Spróbuj ponownie.');
          return;
        }
      } finally {
        setIsLoggingOut(false);
      }
    }
    setLogoutError(null);
    setLogoutReason(reason);
    setUser(null);
  }, []);

  // Keep the user across page reloads (see storage.ts).
  useEffect(() => storeUser(user), [user]);

  // While someone is signed in, any 401 from apiFetch ends the session as expired.
  // A 401 from the logout request itself is handled by logout() above, so it is skipped here.
  useEffect(() => {
    if (!user) return;
    setUnauthorizedHandler((path) => {
      if (path !== '/api/auth/logout') void logout('expired');
    });
    return () => setUnauthorizedHandler(null);
  }, [user, logout]);

  const value = useMemo<AuthContextValue>(
    () => ({ user, logoutReason, isLoggingOut, logoutError, login, logout }),
    [user, logoutReason, isLoggingOut, logoutError, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
