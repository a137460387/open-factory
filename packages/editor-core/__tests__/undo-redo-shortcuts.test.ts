// @vitest-environment jsdom
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { registerUndoRedoShortcuts } from '../src/commands/undo-redo-shortcuts';
import type { CommandManager } from '../src/commands/command-manager';
import type { HistoryMeta } from '../src/commands/command';

// ---------------------------------------------------------------------------
// Mock CommandManager factory — undo-redo-shortcuts only delegates, so we
// stub the methods it calls rather than instantiating a real CommandManager.
// ---------------------------------------------------------------------------

function createCommandManagerMock(overrides: Partial<{
  canUndo: boolean;
  canRedo: boolean;
  meta: HistoryMeta;
}> = {}): CommandManager & { undo: ReturnType<typeof vi.fn>; redo: ReturnType<typeof vi.fn> } {
  const meta: HistoryMeta = overrides.meta ?? {
    canUndo: overrides.canUndo ?? true,
    canRedo: overrides.canRedo ?? true,
    cursor: 0,
    entries: [
      { id: 'e0', description: 'first edit', timestamp: '', affectedClipCount: 1 },
      { id: 'e1', description: 'second edit', timestamp: '', affectedClipCount: 2 },
    ],
    position: 1,
    total: 2,
  };
  return {
    canUndo: vi.fn(() => overrides.canUndo ?? true),
    canRedo: vi.fn(() => overrides.canRedo ?? true),
    undo: vi.fn(),
    redo: vi.fn(),
    getHistoryMeta: vi.fn(() => meta),
  } as unknown as CommandManager & { undo: ReturnType<typeof vi.fn>; redo: ReturnType<typeof vi.fn> };
}

/**
 * Dispatch a keydown on a real DOM element so that e.target is a proper
 * HTMLElement with tagName (source code reads target.tagName.toLowerCase()).
 */
function dispatchKey(
  el: HTMLElement,
  key: string,
  opts: { ctrlKey?: boolean; metaKey?: boolean; shiftKey?: boolean; target?: HTMLElement } = {},
) {
  const event = new KeyboardEvent('keydown', {
    key,
    ctrlKey: opts.ctrlKey ?? false,
    metaKey: opts.metaKey ?? false,
    shiftKey: opts.shiftKey ?? false,
    bubbles: true,
    cancelable: true,
  });
  // When opts.target is set, make e.target point to it (e.g. an input inside the element).
  const effectiveTarget = opts.target ?? el;
  Object.defineProperty(event, 'target', { value: effectiveTarget, configurable: true });
  el.dispatchEvent(event);
  return event;
}

function setupTarget(): HTMLElement {
  const el = document.createElement('div');
  document.body.appendChild(el);
  return el;
}

// ---------------------------------------------------------------------------
// No-target branch (line 45-52)
// ---------------------------------------------------------------------------

describe('registerUndoRedoShortcuts — no target', () => {
  test('target:null returns a handle with no-op dispose and delegating canUndo/canRedo', () => {
    const cm = createCommandManagerMock({ canUndo: true, canRedo: false });
    const handle = registerUndoRedoShortcuts({ commandManager: cm, target: null });

    expect(handle.dispose()).toBeUndefined();
    expect(handle.canUndo()).toBe(true);
    expect(handle.canRedo()).toBe(false);
    expect(cm.canUndo).toHaveBeenCalled();
    expect(cm.canRedo).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Event filtering (line 57-68)
// ---------------------------------------------------------------------------

describe('registerUndoRedoShortcuts — event filtering', () => {
  let cm: ReturnType<typeof createCommandManagerMock>;
  let el: HTMLElement;

  beforeEach(() => {
    cm = createCommandManagerMock();
    el = setupTarget();
    registerUndoRedoShortcuts({ commandManager: cm, target: el });
  });

  test('plain "z" without modifier does not trigger undo', () => {
    dispatchKey(el, 'z');
    expect(cm.undo).not.toHaveBeenCalled();
  });

  test('Ctrl+non-z key does not trigger undo', () => {
    dispatchKey(el, 'x', { ctrlKey: true });
    expect(cm.undo).not.toHaveBeenCalled();
  });

  test('Cmd+Z (metaKey) triggers undo on macOS', () => {
    dispatchKey(el, 'z', { metaKey: true });
    expect(cm.undo).toHaveBeenCalledTimes(1);
  });

  test('Ctrl+Z inside <input> is ignored', () => {
    const input = document.createElement('input');
    dispatchKey(el, 'z', { ctrlKey: true, target: input });
    expect(cm.undo).not.toHaveBeenCalled();
  });

  test('Ctrl+Z inside contenteditable is ignored', () => {
    const div = document.createElement('div');
    div.contentEditable = 'true';
    // jsdom 29.1.1 does not implement the isContentEditable getter (returns undefined).
    // Source code reads target.isContentEditable directly, so stub it on the element.
    Object.defineProperty(div, 'isContentEditable', { value: true, configurable: true });
    dispatchKey(el, 'z', { ctrlKey: true, target: div });
    expect(cm.undo).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Undo branch (line 79-88)
// ---------------------------------------------------------------------------

describe('registerUndoRedoShortcuts — undo (Ctrl+Z)', () => {
  test('calls commandManager.undo() and onAction with entry description', () => {
    const cm = createCommandManagerMock({ canUndo: true });
    const onAction = vi.fn();
    const el = setupTarget();
    registerUndoRedoShortcuts({ commandManager: cm, target: el, onAction });

    dispatchKey(el, 'z', { ctrlKey: true });

    expect(cm.undo).toHaveBeenCalledTimes(1);
    expect(onAction).toHaveBeenCalledWith('undo', 'first edit');
  });

  test('does nothing when canUndo() is false', () => {
    const cm = createCommandManagerMock({ canUndo: false });
    const onAction = vi.fn();
    const el = setupTarget();
    registerUndoRedoShortcuts({ commandManager: cm, target: el, onAction });

    const event = dispatchKey(el, 'z', { ctrlKey: true });

    expect(cm.undo).not.toHaveBeenCalled();
    expect(onAction).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });

  test('preventDefault:false does not call e.preventDefault', () => {
    const cm = createCommandManagerMock({ canUndo: true });
    const el = setupTarget();
    registerUndoRedoShortcuts({ commandManager: cm, target: el, preventDefault: false });

    const event = dispatchKey(el, 'z', { ctrlKey: true });
    expect(event.defaultPrevented).toBe(false);
  });

  test('onAction description falls back to "undo" when entry is undefined', () => {
    const cm = createCommandManagerMock({
      canUndo: true,
      meta: { canUndo: true, canRedo: false, cursor: -1, entries: [], position: 0, total: 0 },
    });
    const onAction = vi.fn();
    const el = setupTarget();
    registerUndoRedoShortcuts({ commandManager: cm, target: el, onAction });

    dispatchKey(el, 'z', { ctrlKey: true });
    expect(onAction).toHaveBeenCalledWith('undo', 'undo');
  });
});

// ---------------------------------------------------------------------------
// Redo branch (line 70-78)
// ---------------------------------------------------------------------------

describe('registerUndoRedoShortcuts — redo (Ctrl+Shift+Z)', () => {
  test('calls commandManager.redo() and onAction with next entry description', () => {
    const cm = createCommandManagerMock({
      canUndo: true,
      canRedo: true,
      meta: {
        canUndo: true, canRedo: true, cursor: 0,
        entries: [
          { id: 'e0', description: 'first', timestamp: '', affectedClipCount: 1 },
          { id: 'e1', description: 'second', timestamp: '', affectedClipCount: 2 },
        ],
        position: 1, total: 2,
      },
    });
    const onAction = vi.fn();
    const el = setupTarget();
    registerUndoRedoShortcuts({ commandManager: cm, target: el, onAction });

    dispatchKey(el, 'z', { ctrlKey: true, shiftKey: true });

    expect(cm.redo).toHaveBeenCalledTimes(1);
    expect(onAction).toHaveBeenCalledWith('redo', 'second');
  });

  test('does nothing when canRedo() is false', () => {
    const cm = createCommandManagerMock({ canRedo: false });
    const onAction = vi.fn();
    const el = setupTarget();
    registerUndoRedoShortcuts({ commandManager: cm, target: el, onAction });

    dispatchKey(el, 'z', { ctrlKey: true, shiftKey: true });
    expect(cm.redo).not.toHaveBeenCalled();
    expect(onAction).not.toHaveBeenCalled();
  });

  test('onAction description falls back to "redo" when next entry is undefined', () => {
    const cm = createCommandManagerMock({
      canRedo: true,
      meta: { canUndo: false, canRedo: true, cursor: 0, entries: [], position: 0, total: 0 },
    });
    const onAction = vi.fn();
    const el = setupTarget();
    registerUndoRedoShortcuts({ commandManager: cm, target: el, onAction });

    dispatchKey(el, 'z', { ctrlKey: true, shiftKey: true });
    expect(onAction).toHaveBeenCalledWith('redo', 'redo');
  });

  test('preventDefault is called on redo', () => {
    const cm = createCommandManagerMock({ canRedo: true });
    const el = setupTarget();
    registerUndoRedoShortcuts({ commandManager: cm, target: el, preventDefault: true });

    const event = dispatchKey(el, 'z', { ctrlKey: true, shiftKey: true });
    expect(event.defaultPrevented).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Handle dispose + canUndo/canRedo delegation (line 93-98)
// ---------------------------------------------------------------------------

describe('registerUndoRedoShortcuts — handle', () => {
  test('dispose() removes listener so subsequent key events do nothing', () => {
    const cm = createCommandManagerMock();
    const el = setupTarget();
    const handle = registerUndoRedoShortcuts({ commandManager: cm, target: el });

    dispatchKey(el, 'z', { ctrlKey: true });
    expect(cm.undo).toHaveBeenCalledTimes(1);

    handle.dispose();

    dispatchKey(el, 'z', { ctrlKey: true });
    expect(cm.undo).toHaveBeenCalledTimes(1); // still 1, listener removed
  });

  test('dispose() can be called multiple times without error', () => {
    const cm = createCommandManagerMock();
    const el = setupTarget();
    const handle = registerUndoRedoShortcuts({ commandManager: cm, target: el });

    expect(() => {
      handle.dispose();
      handle.dispose();
    }).not.toThrow();
  });

  test('handle.canUndo/canRedo delegate to commandManager', () => {
    const cm = createCommandManagerMock({ canUndo: true, canRedo: false });
    const el = setupTarget();
    const handle = registerUndoRedoShortcuts({ commandManager: cm, target: el });

    expect(handle.canUndo()).toBe(true);
    expect(handle.canRedo()).toBe(false);
    expect(cm.canUndo).toHaveBeenCalled();
    expect(cm.canRedo).toHaveBeenCalled();
  });
});
