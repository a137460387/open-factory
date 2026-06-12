import type { Clip, ClipPatch, ColorCorrection, Timeline, Transform } from '@open-factory/editor-core';
import { eventToAccelerator, getEffectiveTimelineShortcutBindings, normalizeAccelerator, type TimelineShortcutAction, type TimelineShortcutBindings, type TimelineShortcutKey } from '../shortcuts/timeline-shortcuts';
import { getAppDataDir, openFileDialog, readFile, saveFileDialog, writeFile } from '../lib/tauri-bridge';

export interface ClipMacro {
  id: string;
  name: string;
  description?: string;
  shortcut?: string;
  patch: ClipPatch;
}

export interface MacroHistoryEntry {
  id: string;
  macroId: string;
  macroName: string;
  triggeredAt: string;
  targetClipId?: string;
  targetClipName?: string;
  shortcut?: string;
  success: boolean;
  error?: string;
}

export interface MacroShortcutConflict {
  accelerator: string;
  type: 'timeline' | 'macro';
  timelineAction?: TimelineShortcutAction;
  macroId?: string;
  macroName?: string;
}

export interface MacroStorage {
  getAppDataDir(): Promise<string> | string;
  readFile(path: string): Promise<string> | string;
  writeFile(path: string, contents: string): Promise<void> | void;
}

export const MACROS_FILE = 'macros.json';
export const MACRO_HISTORY_FILE = 'macro-history.json';
export const MAX_MACRO_HISTORY_ENTRIES = 20;
export const MACRO_FILE_EXTENSION = 'macro.json';

export const DEFAULT_CLIP_MACROS: ClipMacro[] = [
  {
    id: 'macro-scale-150',
    name: '放大 150%',
    description: '将目标片段缩放到 150%。',
    patch: { transform: { scale: 1.5 } }
  }
];

const DEFAULT_STORAGE: MacroStorage = {
  getAppDataDir,
  readFile,
  writeFile
};

export async function readClipMacros(storage: MacroStorage = DEFAULT_STORAGE): Promise<ClipMacro[]> {
  const root = normalizePath(await storage.getAppDataDir());
  try {
    const parsed = parseMacroFile(await storage.readFile(joinConfigPath(root, MACROS_FILE)));
    return parsed.length > 0 ? parsed : cloneDefaultMacros();
  } catch {
    return cloneDefaultMacros();
  }
}

export async function writeClipMacros(macros: ClipMacro[], storage: MacroStorage = DEFAULT_STORAGE): Promise<ClipMacro[]> {
  const root = normalizePath(await storage.getAppDataDir());
  const sanitized = sanitizeClipMacros(macros);
  const next = sanitized.length > 0 ? sanitized : cloneDefaultMacros();
  await storage.writeFile(joinConfigPath(root, MACROS_FILE), serializeMacroFile(next));
  return next;
}

export async function importClipMacrosFromDialog(storage: MacroStorage = DEFAULT_STORAGE): Promise<ClipMacro[] | undefined> {
  const [path] = await openFileDialog(false, [{ name: 'Open Factory Macro', extensions: [MACRO_FILE_EXTENSION, 'json'] }]);
  if (!path) {
    return undefined;
  }
  const imported = parseMacroFile(await readFile(path));
  if (imported.length === 0) {
    return undefined;
  }
  return writeClipMacros(imported, storage);
}

export async function exportClipMacrosToDialog(macros: ClipMacro[]): Promise<string | undefined> {
  const path = await saveFileDialog('open-factory.macros.macro.json', [{ name: 'Open Factory Macro', extensions: [MACRO_FILE_EXTENSION, 'json'] }]);
  if (!path) {
    return undefined;
  }
  await writeFile(path, serializeMacroFile(macros));
  return path;
}

export function serializeMacroFile(macros: ClipMacro[]): string {
  return JSON.stringify({ version: 1, macros: sanitizeClipMacros(macros) }, null, 2);
}

export function parseMacroFile(raw: string): ClipMacro[] {
  try {
    const parsed = JSON.parse(raw) as { macros?: unknown };
    return sanitizeClipMacros(parsed.macros);
  } catch {
    return [];
  }
}

export function sanitizeClipMacros(input: unknown): ClipMacro[] {
  if (!Array.isArray(input)) {
    return [];
  }
  const seen = new Set<string>();
  const macros: ClipMacro[] = [];
  for (const value of input) {
    if (!value || typeof value !== 'object') {
      continue;
    }
    const record = value as Record<string, unknown>;
    const id = sanitizeIdentifier(record.id, 'macro');
    const name = typeof record.name === 'string' && record.name.trim() ? record.name.trim() : id;
    const patch = sanitizeClipPatch(record.patch);
    if (!id || seen.has(id) || Object.keys(patch).length === 0) {
      continue;
    }
    seen.add(id);
    const shortcut = typeof record.shortcut === 'string' ? normalizeAccelerator(record.shortcut) : '';
    macros.push({
      id,
      name,
      description: typeof record.description === 'string' && record.description.trim() ? record.description.trim() : undefined,
      shortcut: shortcut || undefined,
      patch
    });
  }
  return macros;
}

export function findMacroTargetClip(timeline: Timeline, selectedClipIds: string[], playheadTime: number): Clip | undefined {
  const selected = new Set(selectedClipIds);
  if (selected.size > 0) {
    const selectedClip = timeline.tracks.flatMap((track) => track.clips).find((clip) => selected.has(clip.id));
    if (selectedClip) {
      return selectedClip;
    }
  }
  const targetTime = Math.max(0, playheadTime);
  return timeline.tracks
    .flatMap((track, trackIndex) => track.clips.map((clip) => ({ clip, trackIndex })))
    .filter(({ clip }) => targetTime >= clip.start && targetTime < clip.start + clip.duration)
    .sort((left, right) => left.trackIndex - right.trackIndex || left.clip.start - right.clip.start || left.clip.id.localeCompare(right.clip.id))[0]?.clip;
}

export function resolveClipMacroShortcut(event: TimelineShortcutKey, macros: ClipMacro[]): ClipMacro | undefined {
  if (event.isTyping) {
    return undefined;
  }
  const accelerator = eventToAccelerator(event);
  if (!accelerator) {
    return undefined;
  }
  return macros.find((macro) => macro.shortcut && normalizeAccelerator(macro.shortcut) === accelerator);
}

export function detectMacroShortcutConflicts(macros: ClipMacro[], timelineBindings: TimelineShortcutBindings): Record<string, MacroShortcutConflict[]> {
  const conflicts: Record<string, MacroShortcutConflict[]> = Object.fromEntries(macros.map((macro) => [macro.id, []]));
  const timelineByAccelerator = new Map<string, TimelineShortcutAction[]>();
  const effectiveTimelineBindings = getEffectiveTimelineShortcutBindings(timelineBindings);
  for (const [action, bindings] of Object.entries(effectiveTimelineBindings) as Array<[TimelineShortcutAction, string[]]>) {
    for (const binding of bindings) {
      const accelerator = normalizeAccelerator(binding);
      const actions = timelineByAccelerator.get(accelerator) ?? [];
      actions.push(action);
      timelineByAccelerator.set(accelerator, actions);
    }
  }

  const macrosByAccelerator = new Map<string, ClipMacro[]>();
  for (const macro of macros) {
    const accelerator = macro.shortcut ? normalizeAccelerator(macro.shortcut) : '';
    if (!accelerator) {
      continue;
    }
    const matchingTimelineActions = timelineByAccelerator.get(accelerator) ?? [];
    conflicts[macro.id] ??= [];
    for (const action of matchingTimelineActions) {
      conflicts[macro.id].push({ accelerator, type: 'timeline', timelineAction: action });
    }
    const matchingMacros = macrosByAccelerator.get(accelerator) ?? [];
    for (const previous of matchingMacros) {
      conflicts[macro.id].push({ accelerator, type: 'macro', macroId: previous.id, macroName: previous.name });
      conflicts[previous.id] ??= [];
      conflicts[previous.id].push({ accelerator, type: 'macro', macroId: macro.id, macroName: macro.name });
    }
    macrosByAccelerator.set(accelerator, [...matchingMacros, macro]);
  }
  return conflicts;
}

export async function readMacroHistory(storage: MacroStorage = DEFAULT_STORAGE): Promise<MacroHistoryEntry[]> {
  const root = normalizePath(await storage.getAppDataDir());
  try {
    return parseMacroHistory(await storage.readFile(joinConfigPath(root, MACRO_HISTORY_FILE)));
  } catch {
    return [];
  }
}

export async function writeMacroHistory(entries: MacroHistoryEntry[], storage: MacroStorage = DEFAULT_STORAGE): Promise<MacroHistoryEntry[]> {
  const root = normalizePath(await storage.getAppDataDir());
  const sanitized = sanitizeMacroHistory(entries);
  await storage.writeFile(joinConfigPath(root, MACRO_HISTORY_FILE), JSON.stringify({ entries: sanitized }, null, 2));
  return sanitized;
}

export async function appendMacroHistoryEntry(entry: MacroHistoryEntry, storage: MacroStorage = DEFAULT_STORAGE): Promise<MacroHistoryEntry[]> {
  const current = await readMacroHistory(storage);
  return writeMacroHistory([entry, ...current], storage);
}

export function parseMacroHistory(raw: string): MacroHistoryEntry[] {
  try {
    const parsed = JSON.parse(raw) as { entries?: unknown };
    return sanitizeMacroHistory(parsed.entries);
  } catch {
    return [];
  }
}

export function sanitizeMacroHistory(input: unknown): MacroHistoryEntry[] {
  if (!Array.isArray(input)) {
    return [];
  }
  return input
    .flatMap((value): MacroHistoryEntry[] => {
      if (!value || typeof value !== 'object') {
        return [];
      }
      const record = value as Record<string, unknown>;
      const id = sanitizeIdentifier(record.id, 'macro-history');
      const macroId = sanitizeIdentifier(record.macroId, 'macro');
      const macroName = typeof record.macroName === 'string' && record.macroName.trim() ? record.macroName.trim() : macroId;
      const triggeredAt = typeof record.triggeredAt === 'string' && record.triggeredAt.trim() ? record.triggeredAt.trim() : new Date(0).toISOString();
      if (!id || !macroId) {
        return [];
      }
      return [
        {
          id,
          macroId,
          macroName,
          triggeredAt,
          targetClipId: typeof record.targetClipId === 'string' && record.targetClipId.trim() ? record.targetClipId.trim() : undefined,
          targetClipName: typeof record.targetClipName === 'string' && record.targetClipName.trim() ? record.targetClipName.trim() : undefined,
          shortcut: typeof record.shortcut === 'string' && record.shortcut.trim() ? normalizeAccelerator(record.shortcut) : undefined,
          success: record.success === true,
          error: typeof record.error === 'string' && record.error.trim() ? record.error.trim() : undefined
        }
      ];
    })
    .sort((left, right) => right.triggeredAt.localeCompare(left.triggeredAt))
    .slice(0, MAX_MACRO_HISTORY_ENTRIES);
}

function sanitizeClipPatch(input: unknown): ClipPatch {
  if (!input || typeof input !== 'object') {
    return {};
  }
  const record = input as Record<string, unknown>;
  const patch: ClipPatch = {};
  if (record.transform && typeof record.transform === 'object') {
    const transform = pickFiniteNumbers<Transform>(record.transform as Record<string, unknown>, ['x', 'y', 'scale', 'scaleX', 'scaleY', 'rotation', 'opacity']);
    if (Object.keys(transform).length > 0) {
      patch.transform = transform;
    }
  }
  if (record.colorCorrection && typeof record.colorCorrection === 'object') {
    const source = record.colorCorrection as Record<string, unknown>;
    const colorCorrection = pickFiniteNumbers<ColorCorrection>(source, ['brightness', 'contrast', 'saturation', 'hue']);
    if (typeof source.lutPath === 'string' || source.lutPath === null) {
      colorCorrection.lutPath = source.lutPath;
    }
    if (Object.keys(colorCorrection).length > 0) {
      patch.colorCorrection = colorCorrection;
    }
  }
  if (typeof record.speed === 'number' && Number.isFinite(record.speed)) {
    patch.speed = record.speed;
  }
  if (typeof record.volume === 'number' && Number.isFinite(record.volume)) {
    patch.volume = record.volume;
  }
  if (typeof record.text === 'string') {
    patch.text = record.text;
  }
  return patch;
}

function pickFiniteNumbers<T extends object>(record: Record<string, unknown>, keys: string[]): Partial<T> {
  const output: Partial<T> = {};
  for (const key of keys) {
    if (typeof record[key] === 'number' && Number.isFinite(record[key])) {
      (output as Record<string, unknown>)[key] = record[key];
    }
  }
  return output;
}

function cloneDefaultMacros(): ClipMacro[] {
  return DEFAULT_CLIP_MACROS.map((macro) => ({
    ...macro,
    patch: {
      ...macro.patch,
      transform: macro.patch.transform ? { ...macro.patch.transform } : undefined,
      colorCorrection: macro.patch.colorCorrection ? { ...macro.patch.colorCorrection } : undefined
    }
  }));
}

function sanitizeIdentifier(value: unknown, fallbackPrefix: string): string {
  if (typeof value !== 'string') {
    return '';
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }
  return trimmed.replace(/[^\w.-]+/g, '-').replace(/^-+|-+$/g, '') || `${fallbackPrefix}-${Date.now()}`;
}

function joinConfigPath(root: string, fileName: string): string {
  return `${root.replace(/\/+$/g, '')}/${fileName}`;
}

function normalizePath(path: string): string {
  return path.replace(/\\/g, '/');
}
