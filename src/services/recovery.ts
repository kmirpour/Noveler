/**
 * Crash / accidental-close recovery.
 *
 * While a document has unsaved changes, a copy of its Markdown is kept in
 * localStorage (persisted by the WebView across restarts). It is cleared as
 * soon as the document is saved or the user deliberately discards changes.
 * This covers Untitled documents, which autosave can't reach.
 */

const KEY = 'noveler-recovery';

export interface RecoverySnapshot {
  markdown: string;
  fileName: string | null;
  filePath: string | null;
  savedAt: number; // epoch ms
}

export function saveRecovery(snapshot: Omit<RecoverySnapshot, 'savedAt'>): void {
  try {
    const data: RecoverySnapshot = { ...snapshot, savedAt: Date.now() };
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch (err) {
    // Quota exceeded or storage disabled: recovery is best-effort.
    console.warn('Could not write recovery snapshot:', err);
  }
}

export function loadRecovery(): RecoverySnapshot | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as Partial<RecoverySnapshot>;
    if (typeof data.markdown !== 'string' || typeof data.savedAt !== 'number') return null;
    return {
      markdown: data.markdown,
      fileName: data.fileName ?? null,
      filePath: data.filePath ?? null,
      savedAt: data.savedAt,
    };
  } catch {
    return null;
  }
}

export function clearRecovery(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
