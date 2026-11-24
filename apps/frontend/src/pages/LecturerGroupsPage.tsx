import { useEffect, useState } from 'react';
import type { GroupDto } from '@gamification/shared';
import { ApiError } from '../api/client';
import { fetchGroups } from '../api/groups';
import { Alert, Button, ButtonLink } from '../components/ui';
import { SpinnerIcon, UsersIcon } from '../components/ui/icons';
import { GROUP_NEW_PATH, groupEditPath } from '../routes/roles';
import './LecturerGroupsPage.css';

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; groups: GroupDto[] };

/** "Moje grupy": the lecturer's groups (SCRUM-76, Figma "02 Panel prowadzącego"). */
export function LecturerGroupsPage() {
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  // Bumped by "Spróbuj ponownie" to load the list again.
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    fetchGroups(controller.signal)
      .then((groups) => setState({ status: 'ready', groups }))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setState({
          status: 'error',
          message:
            error instanceof ApiError
              ? error.message
              : 'Nie udało się pobrać listy grup. Spróbuj ponownie.',
        });
      });
    return () => controller.abort();
  }, [attempt]);

  function retry() {
    setState({ status: 'loading' });
    setAttempt((n) => n + 1);
  }

  return (
    <main className="groups">
      <div className="groups__header">
        <div>
          <h1 className="groups__title">Moje grupy</h1>
          {state.status === 'ready' && state.groups.length > 0 && (
            <p className="groups__subtitle">{subtitle(state.groups)}</p>
          )}
        </div>
        <div className="groups__actions">
          <ButtonLink to={GROUP_NEW_PATH} variant="secondary">
            Nowa grupa
          </ButtonLink>
          <ButtonLink to="/import">Import studentów z CSV</ButtonLink>
        </div>
      </div>

      {state.status === 'loading' && (
        <p className="groups__loading" role="status">
          <SpinnerIcon className="groups__spinner" />
          Ładowanie grup…
        </p>
      )}

      {state.status === 'error' && (
        <div className="groups__error">
          <Alert type="error">{state.message}</Alert>
          <Button variant="secondary" onClick={retry}>
            Spróbuj ponownie
          </Button>
        </div>
      )}

      {state.status === 'ready' && state.groups.length === 0 && (
        <section className="groups__empty" aria-labelledby="groups-empty-title">
          <UsersIcon className="groups__empty-icon" />
          <h2 id="groups-empty-title" className="groups__empty-title">
            Nie masz jeszcze żadnych grup
          </h2>
          <p className="groups__empty-text">
            Utwórz grupę zajęciową, a potem zaimportuj do niej listę studentów z USOS.
          </p>
          <ButtonLink to={GROUP_NEW_PATH}>Utwórz pierwszą grupę</ButtonLink>
        </section>
      )}

      {state.status === 'ready' && state.groups.length > 0 && (
        <ul className="groups__list" aria-label="Lista grup">
          {state.groups.map((group) => (
            <li key={group.id}>
              <GroupCard group={group} />
            </li>
          ))}
        </ul>
      )}

      <Alert type="info">
        Listę uczestników zajęć pobierzesz z USOS jako plik CSV i dodasz przyciskiem „Import
        studentów z CSV”.
      </Alert>
    </main>
  );
}

function GroupCard({ group }: { group: GroupDto }) {
  const course = group.courseCode ? `${group.courseName} (${group.courseCode})` : group.courseName;
  const meta = [course, group.semester].filter(Boolean).join(' · ');

  return (
    <article className="group-card">
      <div className="group-card__top">
        <h2 className="group-card__name">{group.name}</h2>
        <ButtonLink
          to={groupEditPath(group.id)}
          variant="secondary"
          className="group-card__edit"
          aria-label={`Edytuj grupę ${group.name}`}
        >
          Edytuj
        </ButtonLink>
      </div>
      <p className="group-card__meta">{meta}</p>
      {group.description && <p className="group-card__description">{group.description}</p>}

      {group.studentCount > 0 ? (
        <p className="group-card__count">
          <UsersIcon className="group-card__icon" />
          {studentCountLabel(group.studentCount)}
        </p>
      ) : (
        <div className="group-card__empty">
          <UsersIcon className="group-card__icon" />
          <p className="group-card__empty-title">Brak studentów w grupie</p>
          <p className="group-card__empty-text">Do tej grupy nie przypisano jeszcze studentów.</p>
        </div>
      )}
    </article>
  );
}

/** "Semestr zimowy 2026/2027 · 3 grupy zajęciowe"; the semester only if all groups share it. */
function subtitle(groups: GroupDto[]): string {
  const semesters = new Set(groups.map((group) => group.semester));
  const [semester] = semesters;
  const count = groupCountLabel(groups.length);
  return semesters.size === 1 && semester ? `Semestr ${semester} · ${count}` : count;
}

function studentCountLabel(count: number): string {
  return `${count} ${count === 1 ? 'student' : 'studentów'}`;
}

// Polish plural: 1 grupa, 2–4 grupy (but 12–14 grup), 5+ grup.
function groupCountLabel(count: number): string {
  if (count === 1) return '1 grupa zajęciowa';
  const lastDigit = count % 10;
  const lastTwo = count % 100;
  if (lastDigit >= 2 && lastDigit <= 4 && (lastTwo < 12 || lastTwo > 14)) {
    return `${count} grupy zajęciowe`;
  }
  return `${count} grup zajęciowych`;
}
