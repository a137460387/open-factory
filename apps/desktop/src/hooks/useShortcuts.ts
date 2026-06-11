import { useEffect } from 'react';
import { resolveTimelineShortcutAction, type TimelineShortcutBindings } from '../shortcuts/timeline-shortcuts';

interface ShortcutHandlers {
  togglePlayback(): void;
  reversePlayback(): void;
  pausePlayback(): void;
  forwardPlayback(): void;
  stepBackwardFrame(): void;
  stepForwardFrame(): void;
  setInPoint(): void;
  setOutPoint(): void;
  deleteSelected(): void;
  splitSelected(): void;
  selectAll(): void;
  clearSelection(): void;
  undo(): void;
  redo(): void;
  save(): void;
  exportCurrentFrame(): void;
}

export function useShortcuts(handlers: ShortcutHandlers, bindings: TimelineShortcutBindings = {}): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTyping =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.tagName === 'SELECT' ||
        target?.tagName === 'BUTTON' ||
        target?.isContentEditable;

      if (!isTimelineShortcutScopeActive(target)) {
        return;
      }

      const action = resolveTimelineShortcutAction({
        key: event.key,
        code: event.code,
        ctrlKey: event.ctrlKey,
        metaKey: event.metaKey,
        altKey: event.altKey,
        shiftKey: event.shiftKey,
        isTyping
      }, bindings);
      if (!action) {
        return;
      }

      event.preventDefault();
      switch (action) {
        case 'toggle-playback':
          handlers.togglePlayback();
          break;
        case 'reverse-playback':
          handlers.reversePlayback();
          break;
        case 'pause-playback':
          handlers.pausePlayback();
          break;
        case 'forward-playback':
          handlers.forwardPlayback();
          break;
        case 'step-back':
          handlers.stepBackwardFrame();
          break;
        case 'step-forward':
          handlers.stepForwardFrame();
          break;
        case 'set-in-point':
          handlers.setInPoint();
          break;
        case 'set-out-point':
          handlers.setOutPoint();
          break;
        case 'delete-selected':
          handlers.deleteSelected();
          break;
        case 'split-selected':
          handlers.splitSelected();
          break;
        case 'select-all':
          handlers.selectAll();
          break;
        case 'clear-selection':
          handlers.clearSelection();
          break;
        case 'undo':
          handlers.undo();
          break;
        case 'redo':
          handlers.redo();
          break;
        case 'save':
          handlers.save();
          break;
        case 'export-current-frame':
          handlers.exportCurrentFrame();
          break;
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [bindings, handlers]);
}

function isTimelineShortcutScopeActive(target: HTMLElement | null): boolean {
  const active = document.activeElement as HTMLElement | null;
  return Boolean(active?.closest('[data-timeline-shortcuts-root="true"]') || target?.closest('[data-timeline-shortcuts-root="true"]'));
}
