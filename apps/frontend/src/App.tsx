import { useState } from 'react';
import { ROLES, type Role } from '@gamification/shared';
import { LoginPage } from './pages/LoginPage';

const roleLabels: Record<Role, string> = {
  student: 'Student',
  lecturer: 'Prowadzący',
  admin: 'Administrator',
};

export function App() {
  // Bez routera: prosty przełącznik widoku na podstawie stanu zalogowania.
  const [user, setUser] = useState<string | null>(null);

  if (!user) {
    return <LoginPage onSuccess={setUser} />;
  }

  return (
    <main className="page">
      <h1>Grywalizacja</h1>
      <p>Zalogowano jako {user}.</p>
      <button type="button" onClick={() => setUser(null)}>
        Wyloguj
      </button>
      <h2>Role w systemie</h2>
      <ul>
        {ROLES.map((role) => (
          <li key={role}>{roleLabels[role]}</li>
        ))}
      </ul>
    </main>
  );
}
