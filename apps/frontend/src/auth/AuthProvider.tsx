import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { login as apiLogin, logout as apiLogout, type LoginCredentials } from '../api/auth';
import { ApiError, setUnauthorizedHandler } from '../api/client';
import { AuthContext, type AuthContextValue, type LogoutReason } from './AuthContext';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<string | null>(null);
  const [logoutReason, setLogoutReason] = useState<LogoutReason | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);
  // True while the "Wyloguj" request is running, so its 401 is not treated as an expired session.
  const manualLogoutInProgress = useRef(false);

  const login = useCallback(async (credentials: LoginCredentials) => {
    await apiLogin(credentials);
    setLogoutReason(null);
    setUser(credentials.login);
  }, []);

  const logout = useCallback(async (reason: LogoutReason = 'manual') => {
    // An expired session is already gone on the server, so only a manual logout calls the API.
    if (reason === 'manual') {
      setIsLoggingOut(true);
      setLogoutError(null);
      manualLogoutInProgress.current = true;
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
        manualLogoutInProgress.current = false;
        setIsLoggingOut(false);
      }
    }
    setLogoutError(null);
    setLogoutReason(reason);
    setUser(null);
  }, []);

  // While someone is signed in, any 401 from apiFetch ends the session as expired.
  useEffect(() => {
    if (!user) return;
    setUnauthorizedHandler(() => {
      if (!manualLogoutInProgress.current) void logout('expired');
    });
    return () => setUnauthorizedHandler(null);
  }, [user, logout]);

  const value = useMemo<AuthContextValue>(
    () => ({ user, logoutReason, isLoggingOut, logoutError, login, logout }),
    [user, logoutReason, isLoggingOut, logoutError, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
