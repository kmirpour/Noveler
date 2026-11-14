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

export interface ChoiceOptions {
  title: string;
  message?: string;
  choices: { id: string; label: string; primary?: boolean; danger?: boolean }[];
  /** Label of the button that closes the dialog without choosing (default "Cancel"). */
  cancelLabel?: string;
}

export type DialogRequest =
  | ({ kind: 'confirm'; resolve: (ok: boolean) => void } & ConfirmOptions)
  | ({ kind: 'prompt'; resolve: (value: string | null) => void } & PromptOptions)
  | ({ kind: 'choice'; resolve: (id: string | null) => void } & ChoiceOptions);

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

/** Offers several actions. Resolves to the chosen action's id, or null if the dialog is dismissed. */
export function choiceDialog(options: ChoiceOptions): Promise<string | null> {
  return new Promise((resolve) => {
    useDialogStore.getState().push({ kind: 'choice', resolve, ...options });
  });
}

/** Asks for a line of text. Resolves to null if the user cancels. */
export function promptDialog(options: PromptOptions): Promise<string | null> {
  return new Promise((resolve) => {
    useDialogStore.getState().push({ kind: 'prompt', resolve, ...options });
  });
}
