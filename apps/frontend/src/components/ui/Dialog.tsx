import { useEffect, useRef, type ReactNode } from 'react';
import { Button } from './Button';
import './Dialog.css';

export interface DialogProps {
  open: boolean;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  confirmLoading?: boolean;
  confirmVariant?: 'primary' | 'danger';
  onCancel: () => void;
  onConfirm: () => void;
}

/**
 * Small modal dialog. Uses the native <dialog> element so focus and Escape work,
 * including a click on the backdrop to cancel.
 */
export function Dialog({
  open,
  title,
  children,
  confirmLabel,
  confirmLoading = false,
  confirmVariant = 'primary',
  onCancel,
  onConfirm,
}: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = 'ui-dialog-title';
  const bodyId = 'ui-dialog-body';

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open) {
      if (!el.open) el.showModal();
    } else if (el.open) {
      el.close();
    }
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="ui-dialog"
      aria-labelledby={titleId}
      aria-describedby={bodyId}
      onCancel={(event) => {
        event.preventDefault();
        if (!confirmLoading) onCancel();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget && !confirmLoading) onCancel();
      }}
    >
      <h2 id={titleId} className="ui-dialog__title">
        {title}
      </h2>
      <div id={bodyId} className="ui-dialog__body">
        {children}
      </div>
      <div className="ui-dialog__actions">
        <Button variant="secondary" onClick={onCancel} disabled={confirmLoading}>
          Anuluj
        </Button>
        <Button variant={confirmVariant} loading={confirmLoading} onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </dialog>
  );
}
