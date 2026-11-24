import { createContext, useContext } from 'react';
import type { AuthUser } from '@gamification/shared';
import type { LoginCredentials } from '../api/auth';

/** Why the last session ended: the user clicked "Wyloguj" or the API answered 401. */
export type LogoutReason = 'manual' | 'expired';

/**
 * State of the session check (GET /api/auth/me) run when the app starts:
 * checking -> ready (user known or nobody signed in), or error (server unreachable/failed).
 */
export type SessionStatus = 'checking' | 'ready' | 'error';

export interface AuthContextValue {
  /** The signed-in user (login and role), or null when nobody is signed in. */
  user: AuthUser | null;
  sessionStatus: SessionStatus;
  /** Message shown when the start-up session check failed for a reason other than 401. */
  sessionError: string | null;
  /** Runs the start-up session check again (after sessionStatus === 'error'). */
  retrySessionCheck: () => void;
  logoutReason: LogoutReason | null;
  isLoggingOut: boolean;
  /** Message shown when the "Wyloguj" request failed and the user is still signed in. */
  logoutError: string | null;
  /** Throws LoginError when the credentials are rejected. */
  login: (credentials: LoginCredentials) => Promise<void>;
  /**
   * Ends the session. A manual logout clears it only after the server confirms (or answers 401);
   * on any other failure the user stays signed in and logoutError is set.
   */
  logout: (reason?: LogoutReason) => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside <AuthProvider>.');
  return value;
}
