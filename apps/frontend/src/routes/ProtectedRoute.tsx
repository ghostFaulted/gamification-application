import type { Role } from '@gamification/shared';
import { Navigate, Outlet, useLocation } from 'react-router';
import { useAuth } from '../auth/AuthContext';
import { ROLE_HOME } from './roles';

export interface RedirectState {
  /** Page the user tried to open before being sent to /login. */
  from?: string;
}

/**
 * Renders the nested routes only for a signed-in user with one of the given roles.
 * Signed out -> /login (remembering the page, except after a manual logout);
 * wrong role -> the user's own start page.
 */
export function ProtectedRoute({ roles }: { roles?: readonly Role[] }) {
  const { user, logoutReason } = useAuth();
  const location = useLocation();

  if (!user) {
    // After "Wyloguj" the next person starts fresh; otherwise come back here after signing in.
    const state: RedirectState | undefined =
      logoutReason === 'manual' ? undefined : { from: location.pathname + location.search };
    return <Navigate to="/login" replace state={state} />;
  }
  if (roles && !roles.includes(user.role)) {
    return <Navigate to={ROLE_HOME[user.role]} replace />;
  }
  return <Outlet />;
}
