import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import type { GroupDto } from '@gamification/shared';
import { fetchGroup, groupErrorMessage } from '../api/groups';
import { Alert, ButtonLink } from '../components/ui';
import { ROLE_HOME } from '../routes/roles';
import { ImportPage } from './ImportPage';

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; group: GroupDto };

/** CSV import into one group (from the "Brak studentów w grupie" card); back to the group list. */
export function GroupImportPage() {
  const { groupId = '' } = useParams();
  const navigate = useNavigate();
  const [state, setState] = useState<LoadState>({ status: 'loading' });

  useEffect(() => {
    const controller = new AbortController();
    fetchGroup(groupId, controller.signal)
      .then((group) => setState({ status: 'ready', group }))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setState({ status: 'error', message: groupErrorMessage(error) });
      });
    return () => controller.abort();
  }, [groupId]);

  if (state.status === 'loading') {
    return (
      <main className="page">
        <p role="status">Ładowanie grupy…</p>
      </main>
    );
  }

  if (state.status === 'error') {
    return (
      <main className="page">
        <Alert type="error">{state.message}</Alert>
        <p>
          <ButtonLink to={ROLE_HOME.lecturer} variant="secondary">
            Wróć do listy grup
          </ButtonLink>
        </p>
      </main>
    );
  }

  return (
    <ImportPage
      group={{ id: state.group.id, name: state.group.name }}
      onBack={() => void navigate(ROLE_HOME.lecturer)}
    />
  );
}
