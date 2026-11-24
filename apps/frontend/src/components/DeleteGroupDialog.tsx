import { useState } from 'react';
import { deleteGroup, deleteGroupErrorMessage } from '../api/groups';
import { Alert, Dialog } from './ui';

export interface DeleteGroupTarget {
  id: string;
  name: string;
  studentCount: number;
}

export function DeleteGroupDialog({
  group,
  onCancel,
  onDeleted,
}: {
  group: DeleteGroupTarget;
  onCancel: () => void;
  onDeleted: (name: string) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    setError(null);
    setLoading(true);
    try {
      await deleteGroup(group.id);
      onDeleted(group.name);
    } catch (caught) {
      setError(deleteGroupErrorMessage(caught));
      setLoading(false);
    }
  }

  return (
    <Dialog
      open
      title="Usuń grupę"
      confirmLabel="Usuń"
      confirmVariant="danger"
      confirmLoading={loading}
      onCancel={onCancel}
      onConfirm={() => void confirm()}
    >
      <p>
        Usunąć grupę „{group.name}”?
        {group.studentCount > 0
          ? ` Studenci zostaną z niej wypisani (${group.studentCount === 1 ? '1 student' : `${group.studentCount} studentów`}).`
          : ''}
      </p>
      {error && (
        <Alert type="error" className="ui-dialog__error">
          {error}
        </Alert>
      )}
    </Dialog>
  );
}
