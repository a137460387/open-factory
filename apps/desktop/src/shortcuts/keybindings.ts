import { getAppDataDir, readFile, writeFile } from '../lib/tauri-bridge';
import {
  TIMELINE_SHORTCUT_DEFINITIONS,
  normalizeAccelerator,
  type TimelineShortcutAction,
  type TimelineShortcutBindings,
} from './timeline-shortcuts';

export interface KeybindingStorage {
  getAppDataDir(): Promise<string> | string;
  readFile(path: string): Promise<string> | string;
  writeFile(path: string, contents: string): Promise<void> | void;
}

const KEYBINDINGS_FILE = 'keybindings.json';

const DEFAULT_STORAGE: KeybindingStorage = {
  getAppDataDir,
  readFile,
  writeFile,
};

const ACTIONS = new Set(TIMELINE_SHORTCUT_DEFINITIONS.map((definition) => definition.action));

export async function readCustomKeybindings(
  storage: KeybindingStorage = DEFAULT_STORAGE,
): Promise<TimelineShortcutBindings> {
  const root = normalizePath(await storage.getAppDataDir());
  try {
    return parseCustomKeybindings(await storage.readFile(joinConfigPath(root, KEYBINDINGS_FILE)));
  } catch {
    return {};
  }
}

export async function writeCustomKeybindings(
  bindings: TimelineShortcutBindings,
  storage: KeybindingStorage = DEFAULT_STORAGE,
): Promise<TimelineShortcutBindings> {
  const root = normalizePath(await storage.getAppDataDir());
  const sanitized = sanitizeCustomKeybindings(bindings);
  await storage.writeFile(joinConfigPath(root, KEYBINDINGS_FILE), JSON.stringify({ bindings: sanitized }, null, 2));
  return sanitized;
}

export function parseCustomKeybindings(raw: string): TimelineShortcutBindings {
  try {
    const parsed = JSON.parse(raw) as { bindings?: unknown };
    return sanitizeCustomKeybindings(parsed.bindings);
  } catch {
    return {};
  }
}

function sanitizeCustomKeybindings(input: unknown): TimelineShortcutBindings {
  if (!input || typeof input !== 'object') {
    return {};
  }
  const result: TimelineShortcutBindings = {};
  for (const [action, value] of Object.entries(input as Record<string, unknown>)) {
    if (!ACTIONS.has(action as TimelineShortcutAction)) {
      continue;
    }
    const rawBindings = Array.isArray(value) ? value : typeof value === 'string' ? [value] : [];
    const bindings = Array.from(
      new Set(
        rawBindings
          .filter((binding): binding is string => typeof binding === 'string')
          .map(normalizeAccelerator)
          .filter(Boolean),
      ),
    );
    if (bindings.length > 0) {
      result[action as TimelineShortcutAction] = bindings;
    }
  }
  return result;
}

function joinConfigPath(root: string, fileName: string): string {
  return `${root.replace(/\/+$/g, '')}/${fileName}`;
}

function normalizePath(path: string): string {
  return path.replace(/\\/g, '/');
}
