import { useState, type ReactNode } from 'react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  destructive?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  destructive,
  busy,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={(next) => !next && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="text-sm text-muted-foreground">{description}</div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(event) => {
              event.preventDefault();
              onConfirm();
            }}
            disabled={busy}
            className={
              destructive
                ? 'bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-600'
                : undefined
            }
          >
            {busy ? 'Working…' : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** Small hook that wires a button to a confirmation before running an action. */
export function useConfirm() {
  const [state, setState] = useState<{
    open: boolean;
    title: string;
    description: ReactNode;
    confirmLabel: string;
    destructive?: boolean;
    action: () => Promise<void> | void;
  } | null>(null);
  const [busy, setBusy] = useState(false);

  const confirm = (config: {
    title: string;
    description: ReactNode;
    confirmLabel: string;
    destructive?: boolean;
    action: () => Promise<void> | void;
  }) => setState({ ...config, open: true });

  const dialog = state ? (
    <ConfirmDialog
      open={state.open}
      title={state.title}
      description={state.description}
      confirmLabel={state.confirmLabel}
      destructive={state.destructive}
      busy={busy}
      onCancel={() => setState(null)}
      onConfirm={async () => {
        setBusy(true);
        try {
          await state.action();
          setState(null);
        } finally {
          setBusy(false);
        }
      }}
    />
  ) : null;

  return { confirm, dialog };
}
