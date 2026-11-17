import type { Role } from '@gamification/shared';
import { useAuth } from '../auth/AuthContext';
import { ROLE_LABELS } from '../routes/roles';

const descriptions: Record<Role, string> = {
  student: 'Tu pojawią się Twoje kursy, zadania i punkty.',
  lecturer: 'Tu pojawią się Twoje kursy, grupy studentów i import kont z pliku CSV.',
  admin: 'Tu pojawi się zarządzanie użytkownikami i kursami.',
};

/** Placeholder start page of a role, to be replaced by the real views. */
export function RoleHomePage({ role }: { role: Role }) {
  const { user } = useAuth();

  return (
    <>
      <h1>Panel: {ROLE_LABELS[role]}</h1>
      <p>Zalogowano jako {user?.login}.</p>
      <p>{descriptions[role]}</p>
    </>
  );
}
