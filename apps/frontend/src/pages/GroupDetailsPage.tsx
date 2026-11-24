import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import type { GroupDto, GroupStudentDto } from '@gamification/shared';
import { Link } from 'react-router';
import { fetchGroup, fetchGroupStudents, importGroupStudents } from '../api/groups';
import { ImportError, validateCsvFile } from '../api/users';
import { useAuth } from '../auth/AuthContext';
import { GroupStudentsTable } from '../components/GroupStudentsTable';
import { Alert, Button, ButtonLink } from '../components/ui';
import { AlertCircleIcon, SpinnerIcon } from '../components/ui/icons';
import { ROLE_HOME } from '../routes/roles';
import { groupMeta, importSummary, toGroupLoadError, type GroupLoadError } from './groupDetails';
import './GroupDetailsPage.css';

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; error: GroupLoadError }
  | { status: 'ready'; group: GroupDto; students: GroupStudentDto[] };

type ImportState =
  { status: 'idle' } | { status: 'uploading' } | { status: 'error'; message: string };

/** How long the "Zaimportowano…" toast stays on screen. */
const TOAST_MS = 6000;

/** Group details with its students (SCRUM-78, Figma "06 Grupa po imporcie"). */
export function GroupDetailsPage({ groupId }: { groupId: string }) {
  const { user } = useAuth();
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  // Bumped to load the group again: "Spróbuj ponownie" (with the spinner) or after an import
  // (silently: the current list stays until the new one arrives).
  const [attempt, setAttempt] = useState(0);
  const [importState, setImportState] = useState<ImportState>({ status: 'idle' });
  const [toast, setToast] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  // "Moje grupy" is the lecturer's start page (group list, SCRUM-76).
  const groupsPath = user ? ROLE_HOME[user.role] : '/';

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      fetchGroup(groupId, controller.signal),
      fetchGroupStudents(groupId, controller.signal),
    ])
      .then(([group, students]) => setState({ status: 'ready', group, students }))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setState({ status: 'error', error: toGroupLoadError(error) });
      });
    return () => controller.abort();
  }, [groupId, attempt]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), TOAST_MS);
    return () => clearTimeout(timer);
  }, [toast]);

  function retry() {
    setState({ status: 'loading' });
    setAttempt((n) => n + 1);
  }

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Cleared so that choosing the same file again fires another change.
    event.target.value = '';
    if (!file) return;

    const invalid = validateCsvFile(file);
    if (invalid) {
      setImportState({ status: 'error', message: invalid });
      return;
    }

    setToast(null);
    setImportState({ status: 'uploading' });
    try {
      const report = await importGroupStudents(groupId, file);
      setImportState({ status: 'idle' });
      setToast(importSummary(report));
      setAttempt((n) => n + 1);
    } catch (error) {
      setImportState({
        status: 'error',
        message:
          error instanceof ImportError
            ? error.message
            : 'Nie udało się zaimportować pliku. Spróbuj ponownie.',
      });
    }
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

      {toast && (
        <Alert type="success" className="group-view__toast">
          {toast}
        </Alert>
      )}

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
          <ButtonLink to={groupsPath} variant="secondary">
            Wróć do listy grup
          </ButtonLink>
        </section>
      )}

      {state.status === 'ready' && (
        <>
          <header className="group-view__header">
            <div>
              <h1 className="group-view__title">{state.group.name}</h1>
              <p className="group-view__meta">{groupMeta(state.group, state.students.length)}</p>
              {state.group.description && (
                <p className="group-view__description">{state.group.description}</p>
              )}
            </div>
            <input
              ref={fileInput}
              type="file"
              accept=".csv,text/csv"
              className="group-view__file"
              aria-label="Plik CSV ze studentami"
              tabIndex={-1}
              onChange={(event) => void handleFile(event)}
            />
            <Button
              variant="secondary"
              loading={importState.status === 'uploading'}
              onClick={() => fileInput.current?.click()}
            >
              {importState.status === 'uploading' ? 'Importowanie…' : 'Import studentów z CSV'}
            </Button>
          </header>

          {importState.status === 'error' && <Alert type="error">{importState.message}</Alert>}

          <GroupStudentsPanel students={state.students} />
        </>
      )}
    </main>
  );
}

function GroupStudentsPanel({ students }: { students: readonly GroupStudentDto[] }) {
  return (
    <section className="group-view__panel" aria-labelledby="group-students-title">
      <h2 id="group-students-title" className="group-view__panel-title">
        Lista studentów ({students.length})
      </h2>
      {students.length === 0 ? (
        <div className="group-view__empty">
          <p className="group-view__empty-title">Brak studentów w grupie</p>
          <p className="group-view__empty-text">
            Do tej grupy nie przypisano jeszcze studentów. Dodaj ich przyciskiem „Import studentów z
            CSV” – listę uczestników pobierzesz z USOS.
          </p>
        </div>
      ) : (
        <GroupStudentsTable students={students} />
      )}
    </section>
  );
}
