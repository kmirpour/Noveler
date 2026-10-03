import { beforeEach, describe, expect, it } from 'vitest';
import { clearRecovery, loadRecovery, saveRecovery } from './recovery';

beforeEach(() => localStorage.clear());

describe('recovery snapshots', () => {
  it('round-trips a snapshot with a timestamp', () => {
    const before = Date.now();
    saveRecovery({ markdown: '# Draft', fileName: null, filePath: null });
    const snap = loadRecovery();
    expect(snap?.markdown).toBe('# Draft');
    expect(snap?.fileName).toBeNull();
    expect(snap!.savedAt).toBeGreaterThanOrEqual(before);
  });

  it('clears the snapshot', () => {
    saveRecovery({ markdown: 'x', fileName: 'a.md', filePath: 'C:/a.md' });
    clearRecovery();
    expect(loadRecovery()).toBeNull();
  });

  it('ignores corrupt data', () => {
    localStorage.setItem('noveler-recovery', '{not json');
    expect(loadRecovery()).toBeNull();
    localStorage.setItem('noveler-recovery', JSON.stringify({ markdown: 42 }));
    expect(loadRecovery()).toBeNull();
  });
});
