import { createContext, useContext } from 'react';
import type { LoginCredentials } from '../api/auth';

/** Why the last session ended: the user clicked "Wyloguj" or the API answered 401. */
export type LogoutReason = 'manual' | 'expired';

export interface AuthContextValue {
  /** Login of the signed-in user, or null when nobody is signed in. */
  user: string | null;
  logoutReason: LogoutReason | null;
  isLoggingOut: boolean;
  /** Throws LoginError when the credentials are rejected. */
  login: (credentials: LoginCredentials) => Promise<void>;
  /** Always clears the local session, even if the server call fails. */
  logout: (reason?: LogoutReason) => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside <AuthProvider>.');
  return value;
}
