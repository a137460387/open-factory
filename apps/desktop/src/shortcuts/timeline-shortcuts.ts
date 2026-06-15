export type TimelineShortcutAction =
  | 'toggle-playback'
  | 'reverse-playback'
  | 'pause-playback'
  | 'forward-playback'
  | 'step-back'
  | 'step-forward'
  | 'set-in-point'
  | 'set-out-point'
  | 'add-export-range-in'
  | 'add-export-range-out'
  | 'split-selected'
  | 'delete-selected'
  | 'ripple-delete'
  | 'select-all'
  | 'clear-selection'
  | 'add-annotation'
  | 'add-bookmark'
  | 'toggle-grid-snap'
  | 'jump-prev-navigation-point'
  | 'jump-next-navigation-point'
  | 'undo'
  | 'switch-previous-branch'
  | 'redo'
  | 'save'
  | 'export-current-frame';

export interface TimelineShortcutKey {
  key: string;
  code?: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
  isTyping?: boolean;
}

export interface TimelineShortcutDefinition {
  action: TimelineShortcutAction;
  defaultBindings: string[];
}

export type TimelineShortcutBindings = Partial<Record<TimelineShortcutAction, string[]>>;

export const TIMELINE_SHORTCUT_DEFINITIONS: TimelineShortcutDefinition[] = [
  { action: 'toggle-playback', defaultBindings: ['Space'] },
  { action: 'reverse-playback', defaultBindings: ['J'] },
  { action: 'pause-playback', defaultBindings: ['K'] },
  { action: 'forward-playback', defaultBindings: ['L'] },
  { action: 'step-back', defaultBindings: ['ArrowLeft'] },
  { action: 'step-forward', defaultBindings: ['ArrowRight'] },
  { action: 'set-in-point', defaultBindings: ['I'] },
  { action: 'set-out-point', defaultBindings: ['O'] },
  { action: 'add-export-range-in', defaultBindings: ['Shift+I'] },
  { action: 'add-export-range-out', defaultBindings: ['Shift+O'] },
  { action: 'split-selected', defaultBindings: ['S'] },
  { action: 'delete-selected', defaultBindings: ['Delete', 'Backspace'] },
  { action: 'ripple-delete', defaultBindings: ['Shift+Delete'] },
  { action: 'select-all', defaultBindings: ['Ctrl+A'] },
  { action: 'clear-selection', defaultBindings: ['Escape'] },
  { action: 'add-annotation', defaultBindings: ['N'] },
  { action: 'add-bookmark', defaultBindings: ['B'] },
  { action: 'toggle-grid-snap', defaultBindings: ['G'] },
  { action: 'jump-prev-navigation-point', defaultBindings: ['Ctrl+ArrowLeft'] },
  { action: 'jump-next-navigation-point', defaultBindings: ['Ctrl+ArrowRight'] },
  { action: 'undo', defaultBindings: ['Ctrl+Z'] },
  { action: 'switch-previous-branch', defaultBindings: ['Ctrl+Alt+Z'] },
  { action: 'redo', defaultBindings: ['Ctrl+Shift+Z', 'Ctrl+Y'] },
  { action: 'save', defaultBindings: ['Ctrl+S'] },
  { action: 'export-current-frame', defaultBindings: ['Shift+E'] }
];

export function resolveTimelineShortcutAction(event: TimelineShortcutKey, customBindings: TimelineShortcutBindings = {}): TimelineShortcutAction | null {
  if (event.isTyping) {
    return null;
  }

  const accelerator = eventToAccelerator(event);
  if (!accelerator) {
    return null;
  }
  for (const definition of TIMELINE_SHORTCUT_DEFINITIONS) {
    const bindings = getEffectiveBindings(definition, customBindings);
    if (bindings.some((binding) => normalizeAccelerator(binding) === accelerator)) {
      return definition.action;
    }
  }
  return null;
}

export function getEffectiveTimelineShortcutBindings(customBindings: TimelineShortcutBindings = {}): Record<TimelineShortcutAction, string[]> {
  return Object.fromEntries(TIMELINE_SHORTCUT_DEFINITIONS.map((definition) => [definition.action, getEffectiveBindings(definition, customBindings)])) as Record<TimelineShortcutAction, string[]>;
}

export function detectTimelineShortcutConflicts(bindings: TimelineShortcutBindings): Record<TimelineShortcutAction, string[]> {
  const conflicts = {} as Record<TimelineShortcutAction, string[]>;
  for (const definition of TIMELINE_SHORTCUT_DEFINITIONS) {
    conflicts[definition.action] = [];
  }
  const seen = new Map<string, TimelineShortcutAction[]>();
  const effective = getEffectiveTimelineShortcutBindings(bindings);
  for (const definition of TIMELINE_SHORTCUT_DEFINITIONS) {
    for (const binding of effective[definition.action]) {
      const normalized = normalizeAccelerator(binding);
      const actions = seen.get(normalized) ?? [];
      actions.push(definition.action);
      seen.set(normalized, actions);
    }
  }
  for (const [binding, actions] of seen) {
    if (actions.length <= 1) {
      continue;
    }
    for (const action of actions) {
      conflicts[action].push(binding);
    }
  }
  return conflicts;
}

export function eventToAccelerator(event: TimelineShortcutKey): string | null {
  const key = normalizeKey(event);
  if (!key) {
    return null;
  }
  const parts: string[] = [];
  if (event.ctrlKey || event.metaKey) {
    parts.push('Ctrl');
  }
  if (event.altKey) {
    parts.push('Alt');
  }
  if (event.shiftKey && key !== 'Shift') {
    parts.push('Shift');
  }
  parts.push(key);
  return normalizeAccelerator(parts.join('+'));
}

export function normalizeAccelerator(input: string): string {
  const parts = input
    .split('+')
    .map((part) => part.trim())
    .filter(Boolean);
  const key = parts.pop();
  if (!key) {
    return '';
  }
  const modifiers = new Set(parts.map(normalizeModifier).filter(Boolean));
  const ordered = ['Ctrl', 'Alt', 'Shift'].filter((modifier) => modifiers.has(modifier));
  return [...ordered, normalizeKeyName(key)].join('+');
}

function getEffectiveBindings(definition: TimelineShortcutDefinition, customBindings: TimelineShortcutBindings): string[] {
  const custom = customBindings[definition.action]?.map(normalizeAccelerator).filter(Boolean);
  return custom && custom.length > 0 ? custom : definition.defaultBindings;
}

function normalizeKey(event: TimelineShortcutKey): string {
  if (event.code === 'Space' || event.key === ' ') {
    return 'Space';
  }
  return normalizeKeyName(event.key);
}

function normalizeKeyName(key: string): string {
  const lower = key.toLowerCase();
  if (lower === ' ') {
    return 'Space';
  }
  if (lower === 'spacebar') {
    return 'Space';
  }
  if (lower.startsWith('arrow')) {
    return `Arrow${lower.slice('arrow'.length, 'arrow'.length + 1).toUpperCase()}${lower.slice('arrow'.length + 1)}`;
  }
  if (lower === 'esc') {
    return 'Escape';
  }
  if (lower === 'del') {
    return 'Delete';
  }
  if (key.length === 1) {
    return key.toUpperCase();
  }
  return key.slice(0, 1).toUpperCase() + key.slice(1);
}

function normalizeModifier(modifier: string): string {
  const lower = modifier.toLowerCase();
  if (lower === 'cmd' || lower === 'command' || lower === 'meta' || lower === 'control' || lower === 'ctrl') {
    return 'Ctrl';
  }
  if (lower === 'option' || lower === 'alt') {
    return 'Alt';
  }
  if (lower === 'shift') {
    return 'Shift';
  }
  return '';
}
