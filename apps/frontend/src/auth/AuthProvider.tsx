import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  fetchCurrentUser,
  login as apiLogin,
  logout as apiLogout,
  type LoginCredentials,
} from '../api/auth';
import { ApiError, setUnauthorizedHandler } from '../api/client';
import {
  AuthContext,
  type AuthContextValue,
  type LogoutReason,
  type SessionStatus,
} from './AuthContext';
import type { AuthUser } from '@gamification/shared';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [sessionStatus, setSessionStatus] = useState<SessionStatus>('checking');
  const [sessionError, setSessionError] = useState<string | null>(null);
  // Bumped by retrySessionCheck() to run the check again.
  const [sessionCheck, setSessionCheck] = useState(0);
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

  // The JWT is in an httpOnly cookie that JS cannot read, so on start (and after a reload)
  // the server tells who is signed in. A 401 simply means nobody is.
  useEffect(() => {
    const controller = new AbortController();
    fetchCurrentUser(controller.signal)
      .then((current) => {
        setUser(current);
        setSessionStatus('ready');
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        if (error instanceof ApiError && error.status === 401) {
          setUser(null);
          setSessionStatus('ready');
          return;
        }
        setSessionError(
          error instanceof ApiError && error.status === 0
            ? error.message
            : 'Nie udało się sprawdzić sesji. Spróbuj ponownie.',
        );
        setSessionStatus('error');
      });
    return () => controller.abort();
  }, [sessionCheck]);

  const retrySessionCheck = useCallback(() => {
    setSessionError(null);
    setSessionStatus('checking');
    setSessionCheck((n) => n + 1);
  }, []);

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
    () => ({
      user,
      sessionStatus,
      sessionError,
      retrySessionCheck,
      logoutReason,
      isLoggingOut,
      logoutError,
      login,
      logout,
    }),
    [
      user,
      sessionStatus,
      sessionError,
      retrySessionCheck,
      logoutReason,
      isLoggingOut,
      logoutError,
      login,
      logout,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
