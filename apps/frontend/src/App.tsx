import { useState } from 'react';
import { ROLES, type Role } from '@gamification/shared';
import { useAuth } from './auth/AuthContext';
import { AuthProvider } from './auth/AuthProvider';
import { AppHeader } from './components/AppHeader';
import { ImportPage } from './pages/ImportPage';
import { LoginPage } from './pages/LoginPage';

const roleLabels: Record<Role, string> = {
  student: 'Student',
  lecturer: 'Prowadzący',
  admin: 'Administrator',
};

export function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

function AppContent() {
  // Bez routera: prosty przełącznik widoku na podstawie stanu zalogowania.
  const { user } = useAuth();

  if (!user) {
    return <LoginPage />;
  }

  return <SignedInContent user={user} />;
}

function SignedInContent({ user }: { user: string }) {
  // Bez routera: widok importu CSV do czasu dodania tras.
  // Po wylogowaniu stan znika razem z komponentem, więc widok wraca do strony głównej.
  const [view, setView] = useState<'home' | 'import'>('home');

  return (
    <>
      <AppHeader />
      {view === 'import' ? (
        <ImportPage onBack={() => setView('home')} />
      ) : (
        <main className="page">
          <h1>Grywalizacja</h1>
          <p>Zalogowano jako {user}.</p>
          <button type="button" onClick={() => setView('import')}>
            Import studentów z CSV
          </button>
          <h2>Role w systemie</h2>
          <ul>
            {ROLES.map((role) => (
              <li key={role}>{roleLabels[role]}</li>
            ))}
          </ul>
        </main>
      )}
    </>
  );
}
