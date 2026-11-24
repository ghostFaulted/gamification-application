// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { polyfillDialog } from '../../test/dialog';
import { Dialog } from './Dialog';

beforeAll(() => {
  polyfillDialog();
});

afterEach(() => {
  cleanup();
});

function CancelHost({
  onCancel,
  confirmLoading = false,
}: {
  onCancel: () => void;
  confirmLoading?: boolean;
}) {
  const [open, setOpen] = useState(true);
  if (!open) return null;
  return (
    <Dialog
      open
      title="Usuń grupę"
      confirmLabel="Usuń"
      confirmLoading={confirmLoading}
      onCancel={() => {
        onCancel();
        setOpen(false);
      }}
      onConfirm={() => undefined}
    >
      <p>Treść</p>
    </Dialog>
  );
}

function closeOrder(run: (dialog: HTMLDialogElement) => void): string[] {
  const order: string[] = [];
  const original = HTMLDialogElement.prototype.close;
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    order.push('close');
    original.call(this);
  };
  try {
    const onCancel = () => {
      order.push('onCancel');
    };
    render(<CancelHost onCancel={onCancel} />);
    const dialog = document.querySelector('dialog');
    if (!dialog) throw new Error('dialog missing');
    run(dialog);
    return order;
  } finally {
    HTMLDialogElement.prototype.close = original;
  }
}

describe('Dialog', () => {
  it('closes the native dialog before onCancel when Anuluj is clicked', () => {
    expect(
      closeOrder(() => fireEvent.click(screen.getByRole('button', { name: 'Anuluj' }))),
    ).toEqual(['close', 'onCancel']);
  });

  it('closes the native dialog before onCancel on Escape', () => {
    expect(
      closeOrder((dialog) => {
        fireEvent(dialog, new Event('cancel', { cancelable: true }));
      }),
    ).toEqual(['close', 'onCancel']);
  });

  it('closes the native dialog before onCancel on a backdrop click', () => {
    expect(
      closeOrder((dialog) => {
        fireEvent.click(dialog);
      }),
    ).toEqual(['close', 'onCancel']);
  });

  it('does not close or cancel while confirm is loading', () => {
    const order: string[] = [];
    const original = HTMLDialogElement.prototype.close;
    HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
      order.push('close');
      original.call(this);
    };
    try {
      render(<CancelHost onCancel={() => order.push('onCancel')} confirmLoading />);
      fireEvent.click(screen.getByRole('button', { name: 'Anuluj' }));
      const dialog = document.querySelector('dialog');
      if (!dialog) throw new Error('dialog missing');
      fireEvent(dialog, new Event('cancel', { cancelable: true }));
      fireEvent.click(dialog);
      expect(order).toEqual([]);
      expect(dialog.open).toBe(true);
    } finally {
      HTMLDialogElement.prototype.close = original;
    }
  });
});
