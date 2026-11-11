import { ROLES, type Role } from '@gamification/shared';

const roleLabels: Record<Role, string> = {
  student: 'Student',
  lecturer: 'Prowadzący',
  admin: 'Administrator',
};

export function App() {
  return (
    <main className="page">
      <h1>Grywalizacja</h1>
      <p>Aplikacja wspomagająca grywalizację zajęć dydaktycznych na WMiI UAM.</p>
      <h2>Role w systemie</h2>
      <ul>
        {ROLES.map((role) => (
          <li key={role}>{roleLabels[role]}</li>
        ))}
      </ul>
    </main>
  );
}
