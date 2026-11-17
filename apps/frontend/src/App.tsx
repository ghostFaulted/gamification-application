import { ROLES, type Role } from '@gamification/shared';
import { useAuth } from './auth/AuthContext';
import { AuthProvider } from './auth/AuthProvider';
import { AppHeader } from './components/AppHeader';
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

  return (
    <>
      <AppHeader />
      <main className="page">
        <h1>Grywalizacja</h1>
        <p>Zalogowano jako {user}.</p>
        <h2>Role w systemie</h2>
        <ul>
          {ROLES.map((role) => (
            <li key={role}>{roleLabels[role]}</li>
          ))}
        </ul>
      </main>
    </>
  );
}
