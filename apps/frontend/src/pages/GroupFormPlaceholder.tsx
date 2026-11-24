import { ButtonLink } from '../components/ui';
import { ROLE_HOME } from '../routes/roles';

/** Temporary target of "Nowa grupa" / "Edytuj" until the group form (SCRUM-77) is ready. */
export function GroupFormPlaceholder({ mode }: { mode: 'create' | 'edit' }) {
  return (
    <main className="page">
      <h1>{mode === 'create' ? 'Nowa grupa' : 'Edycja grupy'}</h1>
      <p>Formularz tworzenia i edycji grupy jest w przygotowaniu.</p>
      <ButtonLink to={ROLE_HOME.lecturer} variant="secondary">
        Wróć do listy grup
      </ButtonLink>
    </main>
  );
}
