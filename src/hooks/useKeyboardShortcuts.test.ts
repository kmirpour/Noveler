import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useKeyboardShortcuts } from './useKeyboardShortcuts';
import { useEditorStore } from '../stores/editorStore';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function Probe() {
  useKeyboardShortcuts();
  return null;
}

let root: Root;
let container: HTMLElement;
const newFile = vi.fn();
const toggleTypewriterMode = vi.fn();

const press = (init: KeyboardEventInit) => {
  const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init });
  window.dispatchEvent(event);
  return event;
};

beforeEach(() => {
  newFile.mockReset();
  toggleTypewriterMode.mockReset();
  useEditorStore.setState({ newFile, toggleTypewriterMode } as never);
  container = document.createElement('div');
  root = createRoot(container);
  act(() => root.render(createElement(Probe)));
});
afterEach(() => {
  act(() => root.unmount());
  delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__;
});

describe('shortcuts the browser keeps for itself', () => {
  it('can be reached with Alt+Shift in a browser', () => {
    const n = press({ code: 'KeyN', key: 'N', altKey: true, shiftKey: true });
    expect(newFile).toHaveBeenCalledTimes(1);
    expect(n.defaultPrevented).toBe(true);

    const t = press({ code: 'KeyT', key: 'T', altKey: true, shiftKey: true });
    expect(toggleTypewriterMode).toHaveBeenCalledTimes(1);
    expect(t.defaultPrevented).toBe(true);
  });

  it('ignores other Alt combinations, and does not hijack Ctrl+Alt+Shift', () => {
    press({ code: 'KeyN', key: 'n', altKey: true });
    press({ code: 'KeyN', key: 'N', altKey: true, shiftKey: true, ctrlKey: true });
    press({ code: 'KeyM', key: 'M', altKey: true, shiftKey: true });
    expect(newFile).not.toHaveBeenCalled();
    expect(toggleTypewriterMode).not.toHaveBeenCalled();
  });

  it('still uses Ctrl+Shift+T for typewriter scrolling where the browser allows it, and in the desktop app', () => {
    press({ code: 'KeyT', key: 'T', ctrlKey: true, shiftKey: true });
    expect(toggleTypewriterMode).toHaveBeenCalledTimes(1);
  });

  it('adds nothing in the desktop app', () => {
    (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {};
    const event = press({ code: 'KeyN', key: 'N', altKey: true, shiftKey: true });
    expect(newFile).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });
});
