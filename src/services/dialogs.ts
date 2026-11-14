import { create } from 'zustand';

/**
 * In-app replacements for the browser's `confirm()` and `prompt()` boxes, so questions match the
 * current theme and say plainly what will happen. Rendered by <DialogHost /> in App.
 */
export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Style the confirm button as a destructive action. */
  danger?: boolean;
}

export interface PromptOptions {
  title: string;
  message?: string;
  placeholder?: string;
  defaultValue?: string;
  confirmLabel?: string;
}

export type DialogRequest =
  | ({ kind: 'confirm'; resolve: (ok: boolean) => void } & ConfirmOptions)
  | ({ kind: 'prompt'; resolve: (value: string | null) => void } & PromptOptions);

interface DialogState {
  queue: DialogRequest[];
  push: (request: DialogRequest) => void;
  shift: () => void;
}

export const useDialogStore = create<DialogState>((set) => ({
  queue: [],
  push: (request) => set((s) => ({ queue: [...s.queue, request] })),
  shift: () => set((s) => ({ queue: s.queue.slice(1) })),
}));

/** Asks a yes/no question. Resolves to true only if the user confirms. */
export function confirmDialog(options: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    useDialogStore.getState().push({ kind: 'confirm', resolve, ...options });
  });
}

/** Asks for a line of text. Resolves to null if the user cancels. */
export function promptDialog(options: PromptOptions): Promise<string | null> {
  return new Promise((resolve) => {
    useDialogStore.getState().push({ kind: 'prompt', resolve, ...options });
  });
}
