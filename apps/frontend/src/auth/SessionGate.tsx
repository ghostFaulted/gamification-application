import type { ReactNode } from 'react';
import { Alert, Button } from '../components/ui';
import { SpinnerIcon } from '../components/ui/icons';
import { useAuth } from './AuthContext';
import './SessionGate.css';

/**
 * Renders the app only after the start-up session check (GET /api/auth/me) has finished,
 * so protected pages and /login never act on an unknown session.
 */
export function SessionGate({ children }: { children: ReactNode }) {
  const { sessionStatus, sessionError, retrySessionCheck } = useAuth();

  if (sessionStatus === 'checking') {
    return (
      <main className="session-gate">
        <p className="session-gate__loading" role="status">
          <SpinnerIcon className="session-gate__spinner" />
          Sprawdzanie sesji…
        </p>
      </main>
    );
  }

  if (sessionStatus === 'error') {
    return (
      <main className="session-gate">
        <div className="session-gate__card">
          <Alert type="error">{sessionError}</Alert>
          <Button onClick={retrySessionCheck}>Spróbuj ponownie</Button>
        </div>
      </main>
    );
  }

  return children;
}
