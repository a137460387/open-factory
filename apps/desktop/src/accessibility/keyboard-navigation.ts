const CORE_KEYBOARD_FOCUS_ORDER = [
  'toolbar-file-menu-button',
  'toolbar-import-menu-button',
  'toolbar-export-button',
  'media-search-input',
  'media-filter-all',
  'media-view-grid',
  'timeline-root',
  'inspector-empty-state'
] as const;

export function getCoreKeyboardFocusOrder(): readonly string[] {
  return CORE_KEYBOARD_FOCUS_ORDER;
}

export function isEditableKeyboardTarget(target: EventTarget | null): boolean {
  const element = target instanceof HTMLElement ? target : null;
  if (!element) {
    return false;
  }
  return element.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(element.tagName);
}

export function isShortcutCheatsheetKey(event: Pick<KeyboardEvent, 'key' | 'shiftKey' | 'ctrlKey' | 'metaKey' | 'altKey'>): boolean {
  if (event.ctrlKey || event.metaKey || event.altKey) {
    return false;
  }
  return event.key === '?' || (event.shiftKey && event.key === '/');
}

export function resolveSliderKeyboardValue(input: {
  key: string;
  value: number;
  min: number;
  max: number;
  step: number;
  shiftKey?: boolean;
}): number | undefined {
  const direction = input.key === 'ArrowLeft' || input.key === 'ArrowDown' ? -1 : input.key === 'ArrowRight' || input.key === 'ArrowUp' ? 1 : 0;
  if (direction === 0) {
    return undefined;
  }
  const step = Math.max(0, Number.isFinite(input.step) ? input.step : 0);
  const delta = direction * step * (input.shiftKey ? 10 : 1);
  const next = input.value + delta;
  return clampToRange(next, input.min, input.max);
}

function clampToRange(value: number, min: number, max: number): number {
  const lower = Math.min(min, max);
  const upper = Math.max(min, max);
  return Math.min(upper, Math.max(lower, Number(value.toFixed(6))));
}
