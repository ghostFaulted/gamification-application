import { useEffect, useState } from 'react';
import type { GroupDto } from '@gamification/shared';
import { Link } from 'react-router';
import { fetchGroup } from '../api/groupDetails';
import { useAuth } from '../auth/AuthContext';
import { GroupStudentsTable, type GroupStudentRow } from '../components/GroupStudentsTable';
import { Alert, Button } from '../components/ui';
import { AlertCircleIcon, InfoIcon, SpinnerIcon } from '../components/ui/icons';
import { ROLE_HOME } from '../routes/roles';
import { groupMeta, toGroupLoadError, type GroupLoadError } from './groupDetails';
import './GroupDetailsPage.css';

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; error: GroupLoadError }
  | { status: 'ready'; group: GroupDto };

/** Group details with its students (SCRUM-78, Figma "06 Grupa po imporcie"). */
export function GroupDetailsPage({ groupId }: { groupId: string }) {
  const { user } = useAuth();
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  // Bumped by "Spróbuj ponownie" to load the group again.
  const [attempt, setAttempt] = useState(0);
  // "Moje grupy" is the lecturer's start page (group list, SCRUM-76).
  const groupsPath = user ? ROLE_HOME[user.role] : '/';

  useEffect(() => {
    const controller = new AbortController();
    fetchGroup(groupId, controller.signal)
      .then((group) => setState({ status: 'ready', group }))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setState({ status: 'error', error: toGroupLoadError(error) });
      });
    return () => controller.abort();
  }, [groupId, attempt]);

  function retry() {
    setState({ status: 'loading' });
    setAttempt((n) => n + 1);
  }

  return (
    <main className="group-view">
      <nav className="group-view__breadcrumb" aria-label="Ścieżka">
        <Link to={groupsPath} className="group-view__breadcrumb-link">
          Moje grupy
        </Link>
        {state.status === 'ready' && (
          <>
            <span aria-hidden="true">/</span>
            <span aria-current="page">{state.group.name}</span>
          </>
        )}
      </nav>

      {state.status === 'loading' && (
        <p className="group-view__loading" role="status">
          <SpinnerIcon className="group-view__spinner" />
          Ładowanie grupy…
        </p>
      )}

      {state.status === 'error' && state.error.kind === 'failed' && (
        <div className="group-view__error">
          <Alert type="error">{state.error.message}</Alert>
          <Button variant="secondary" onClick={retry}>
            Spróbuj ponownie
          </Button>
        </div>
      )}

      {state.status === 'error' && state.error.kind !== 'failed' && (
        <section className="group-view__blocked" aria-labelledby="group-blocked-title">
          <AlertCircleIcon className="group-view__blocked-icon" />
          <h1 id="group-blocked-title" className="group-view__blocked-title">
            {state.error.kind === 'forbidden'
              ? 'Brak dostępu do tej grupy'
              : 'Nie znaleziono grupy'}
          </h1>
          <p className="group-view__blocked-text">
            {state.error.kind === 'forbidden'
              ? 'Ta grupa należy do innego prowadzącego. Możesz przeglądać tylko własne grupy.'
              : 'Grupa nie istnieje albo została usunięta. Sprawdź adres lub wróć do listy grup.'}
          </p>
          <Link to={groupsPath} className="ui-button ui-button--secondary group-view__back">
            Wróć do listy grup
          </Link>
        </section>
      )}

      {state.status === 'ready' && (
        <>
          <header className="group-view__header">
            <h1 className="group-view__title">{state.group.name}</h1>
            <p className="group-view__meta">{groupMeta(state.group)}</p>
            {state.group.description && (
              <p className="group-view__description">{state.group.description}</p>
            )}
          </header>
          {/* No endpoint returns a group's students yet, so only the count is known for now. */}
          <GroupStudentsPanel studentCount={state.group.studentCount} />
        </>
      )}
    </main>
  );
}

function GroupStudentsPanel({
  studentCount,
  students,
}: {
  studentCount: number;
  /** Members of the group; undefined while the API does not return them. */
  students?: readonly GroupStudentRow[];
}) {
  const count = students?.length ?? studentCount;

  return (
    <section className="group-view__panel" aria-labelledby="group-students-title">
      <h2 id="group-students-title" className="group-view__panel-title">
        Lista studentów ({count})
      </h2>
      {count === 0 ? (
        <div className="group-view__empty">
          <p className="group-view__empty-title">Brak studentów w grupie</p>
          <p className="group-view__empty-text">
            Do tej grupy nie przypisano jeszcze studentów. Pojawią się tutaj po imporcie listy z
            USOS.
          </p>
        </div>
      ) : students ? (
        <GroupStudentsTable students={students} />
      ) : (
        <p className="group-view__pending" role="note">
          <InfoIcon className="group-view__pending-icon" />
          Szczegółowa lista studentów nie jest jeszcze dostępna.
        </p>
      )}
    </section>
  );
}
