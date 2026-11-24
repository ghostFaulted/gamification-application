import { useEffect, useState } from 'react';
import type { GroupDto } from '@gamification/shared';
import { Link, useLocation, useNavigate } from 'react-router';
import { userFacingApiError } from '../api/client';
import { fetchGroups } from '../api/groups';
import { useAuth } from '../auth/AuthContext';
import { DeleteGroupDialog, type DeleteGroupTarget } from '../components/DeleteGroupDialog';
import { Alert, Button, ButtonLink } from '../components/ui';
import { SpinnerIcon, UsersIcon } from '../components/ui/icons';
import { GROUP_NEW_PATH, groupEditPath, groupImportPath, groupPath } from '../routes/roles';
import './LecturerGroupsPage.css';

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; groups: GroupDto[] };

const TOAST_MS = 6000;

interface ListLocationState {
  toast?: string;
}

/** Group list: the lecturer's groups, or all groups for an admin (SCRUM-76 / SCRUM-22). */
export function LecturerGroupsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const location = useLocation();
  const navigate = useNavigate();
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  // Bumped by "Spróbuj ponownie" or after a delete, to load the list again.
  const [attempt, setAttempt] = useState(0);
  const [pendingDelete, setPendingDelete] = useState<DeleteGroupTarget | null>(null);
  const toast = (location.state as ListLocationState | null)?.toast ?? null;

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => {
      navigate('.', { replace: true, state: {} });
    }, TOAST_MS);
    return () => clearTimeout(timer);
  }, [toast, navigate]);

  useEffect(() => {
    const controller = new AbortController();
    fetchGroups(controller.signal)
      .then((groups) => setState({ status: 'ready', groups }))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setState({
          status: 'error',
          message: userFacingApiError(error, 'Nie udało się pobrać listy grup. Spróbuj ponownie.'),
        });
      });
    return () => controller.abort();
  }, [attempt]);

  function retry() {
    setState({ status: 'loading' });
    setAttempt((n) => n + 1);
  }

  function handleDeleted(name: string) {
    setPendingDelete(null);
    navigate('.', { replace: true, state: { toast: `Usunięto grupę „${name}”.` } });
    setAttempt((n) => n + 1);
  }

  const title = isAdmin ? 'Grupy' : 'Moje grupy';

  return (
    <main className="groups">
      {toast && (
        <Alert type="success" className="groups__toast">
          {toast}
        </Alert>
      )}

      <div className="groups__header">
        <div>
          <h1 className="groups__title">{title}</h1>
          {state.status === 'ready' && state.groups.length > 0 && (
            <p className="groups__subtitle">{subtitle(state.groups)}</p>
          )}
        </div>
        <div className="groups__actions">
          <ButtonLink to={GROUP_NEW_PATH} variant="secondary">
            Nowa grupa
          </ButtonLink>
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
            {isAdmin ? 'Brak grup' : 'Nie masz jeszcze żadnych grup'}
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
              <GroupCard group={group} onDelete={() => setPendingDelete(group)} />
            </li>
          ))}
        </ul>
      )}

      <Alert type="info">
        Listę uczestników zajęć pobierzesz z USOS jako plik CSV i zaimportujesz do wybranej grupy.
      </Alert>

      {pendingDelete && (
        <DeleteGroupDialog
          group={pendingDelete}
          onCancel={() => setPendingDelete(null)}
          onDeleted={handleDeleted}
        />
      )}
    </main>
  );
}

function GroupCard({ group, onDelete }: { group: GroupDto; onDelete: () => void }) {
  const course = group.courseCode ? `${group.courseName} (${group.courseCode})` : group.courseName;
  const meta = [course, group.semester].filter(Boolean).join(' · ');

  return (
    <article className="group-card">
      <div className="group-card__top">
        <h2 className="group-card__name">
          <Link to={groupPath(group.id)} className="group-card__link">
            {group.name}
          </Link>
        </h2>
        <div className="group-card__actions">
          <ButtonLink
            to={groupEditPath(group.id)}
            variant="secondary"
            className="group-card__edit"
            aria-label={`Edytuj grupę ${group.name}`}
          >
            Edytuj
          </ButtonLink>
          <Button
            variant="danger-secondary"
            className="group-card__edit"
            aria-label={`Usuń grupę ${group.name}`}
            onClick={onDelete}
          >
            Usuń
          </Button>
        </div>
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
          <p className="group-card__empty-text">
            Zaimportuj listę uczestników z pliku CSV pobranego z USOS.
          </p>
          <ButtonLink
            to={groupImportPath(group.id)}
            variant="secondary"
            aria-label={`Import studentów z CSV do grupy ${group.name}`}
          >
            Import studentów z CSV
          </ButtonLink>
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
