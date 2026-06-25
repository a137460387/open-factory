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
  addExportRangeIn(): void;
  addExportRangeOut(): void;
  deleteSelected(): void;
  rippleDeleteSelected(): void;
  splitSelected(): void;
  selectAll(): void;
  clearSelection(): void;
  addAnnotation(): void;
  addBookmark(): void;
  toggleGridSnap(): void;
  jumpToPreviousNavigationPoint(): void;
  jumpToNextNavigationPoint(): void;
  undo(): void;
  switchToPreviousHistoryBranch(): void;
  redo(): void;
  save(): void;
  exportCurrentFrame(): void;
  matchFrame(): void;
  revealInTimeline(): void;
  navigateNextInstance(): void;
  navigatePrevGap(): void;
  navigateNextGap(): void;
  renderInOut(): void;
}

export function useShortcuts(handlers: ShortcutHandlers, bindings: TimelineShortcutBindings = {}): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) {
        return;
      }
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
        case 'add-export-range-in':
          handlers.addExportRangeIn();
          break;
        case 'add-export-range-out':
          handlers.addExportRangeOut();
          break;
        case 'delete-selected':
          handlers.deleteSelected();
          break;
        case 'ripple-delete':
          handlers.rippleDeleteSelected();
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
        case 'add-annotation':
          handlers.addAnnotation();
          break;
        case 'add-bookmark':
          handlers.addBookmark();
          break;
        case 'toggle-grid-snap':
          handlers.toggleGridSnap();
          break;
        case 'jump-prev-navigation-point':
          handlers.jumpToPreviousNavigationPoint();
          break;
        case 'jump-next-navigation-point':
          handlers.jumpToNextNavigationPoint();
          break;
        case 'undo':
          handlers.undo();
          break;
        case 'switch-previous-branch':
          handlers.switchToPreviousHistoryBranch();
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
        case 'match-frame':
          handlers.matchFrame();
          break;
        case 'reveal-in-timeline':
          handlers.revealInTimeline();
          break;
        case 'navigate-next-instance':
          handlers.navigateNextInstance();
          break;
        case 'navigate-prev-gap':
          handlers.navigatePrevGap();
          break;
        case 'navigate-next-gap':
          handlers.navigateNextGap();
          break;
        case 'render-in-out':
          handlers.renderInOut();
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
