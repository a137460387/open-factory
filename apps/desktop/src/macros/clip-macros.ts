import {
  AddEffectCommand,
  RemoveEffectCommand,
  ReorderEffectsCommand,
  UpdateClipCommand,
  UpdateEffectCommand,
  isEffectType,
  normalizeEffectParams,
  type AddEffectInput,
  type Clip,
  type ClipPatch,
  type ColorCorrection,
  type Command,
  type EffectPatch,
  type EffectParams,
  type EffectType,
  type Timeline,
  type TimelineAccessor,
  type Transform
} from '@open-factory/editor-core';
import { eventToAccelerator, getEffectiveTimelineShortcutBindings, normalizeAccelerator, type TimelineShortcutAction, type TimelineShortcutBindings, type TimelineShortcutKey } from '../shortcuts/timeline-shortcuts';
import { getAppDataDir, openFileDialog, readFile, saveFileDialog, writeFile } from '../lib/tauri-bridge';

export const MACRO_TARGET_CLIP_ID = '__TARGET_CLIP__';

export type CommandSnapshot =
  | { type: 'update-clip'; clipId: string; patch: ClipPatch }
  | { type: 'add-effect'; clipId: string; effect: AddEffectInput }
  | { type: 'remove-effect'; clipId: string; effectId: string }
  | { type: 'update-effect'; clipId: string; effectId: string; patch: EffectPatch }
  | { type: 'reorder-effects'; clipId: string; orderedEffectIds: string[] };

export interface ClipMacro {
  id: string;
  name: string;
  description?: string;
  shortcut?: string;
  patch?: ClipPatch;
  steps?: CommandSnapshot[];
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
    patch: { transform: { scale: 1.5 } },
    steps: [{ type: 'update-clip', clipId: MACRO_TARGET_CLIP_ID, patch: { transform: { scale: 1.5 } } }]
  },
  {
    id: 'macro-cinematic-grade',
    name: '电影感调色',
    description: '对比度 +0.2、饱和度 0.8，并添加轻微暗角。',
    steps: [
      {
        type: 'update-clip',
        clipId: MACRO_TARGET_CLIP_ID,
        patch: { colorCorrection: { contrast: 1.2, saturation: 0.8 } }
      },
      {
        type: 'add-effect',
        clipId: MACRO_TARGET_CLIP_ID,
        effect: { type: 'vignette', params: { intensity: 0.25, radius: 0.72 } }
      }
    ]
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
    const steps = sanitizeCommandSnapshots(record.steps);
    const effectiveSteps = steps.length > 0 ? steps : Object.keys(patch).length > 0 ? [{ type: 'update-clip' as const, clipId: MACRO_TARGET_CLIP_ID, patch }] : [];
    if (!id || seen.has(id) || effectiveSteps.length === 0) {
      continue;
    }
    seen.add(id);
    const shortcut = typeof record.shortcut === 'string' ? normalizeAccelerator(record.shortcut) : '';
    macros.push({
      id,
      name,
      description: typeof record.description === 'string' && record.description.trim() ? record.description.trim() : undefined,
      shortcut: shortcut || undefined,
      patch: Object.keys(patch).length > 0 ? patch : undefined,
      steps: effectiveSteps
    });
  }
  return macros;
}

export function getMacroSteps(macro: ClipMacro): CommandSnapshot[] {
  const steps = sanitizeCommandSnapshots(macro.steps);
  if (steps.length > 0) {
    return cloneCommandSnapshots(steps);
  }
  const patch = sanitizeClipPatch(macro.patch);
  return Object.keys(patch).length > 0 ? [{ type: 'update-clip', clipId: MACRO_TARGET_CLIP_ID, patch }] : [];
}

export function serializeCommandSnapshots(steps: CommandSnapshot[]): string {
  return JSON.stringify(sanitizeCommandSnapshots(steps), null, 2);
}

export function parseCommandSnapshotsJson(raw: string): CommandSnapshot[] {
  try {
    return sanitizeCommandSnapshots(JSON.parse(raw));
  } catch {
    return [];
  }
}

export function snapshotCommand(command: Command): CommandSnapshot | undefined {
  const record = command as unknown as Record<string, unknown>;
  if (command instanceof UpdateClipCommand) {
    const clipId = sanitizeIdentifier(record.clipId, 'clip');
    const patch = sanitizeClipPatch(record.patch);
    return clipId && Object.keys(patch).length > 0 ? { type: 'update-clip', clipId, patch } : undefined;
  }
  if (command instanceof AddEffectCommand) {
    const clipId = sanitizeIdentifier(record.clipId, 'clip');
    const effect = sanitizeAddEffectInput(record.input);
    return clipId && effect ? { type: 'add-effect', clipId, effect } : undefined;
  }
  if (command instanceof RemoveEffectCommand) {
    const clipId = sanitizeIdentifier(record.clipId, 'clip');
    const effectId = sanitizeIdentifier(record.effectId, 'effect');
    return clipId && effectId ? { type: 'remove-effect', clipId, effectId } : undefined;
  }
  if (command instanceof UpdateEffectCommand) {
    const clipId = sanitizeIdentifier(record.clipId, 'clip');
    const effectId = sanitizeIdentifier(record.effectId, 'effect');
    const patch = sanitizeEffectPatch(record.patch);
    return clipId && effectId && Object.keys(patch).length > 0 ? { type: 'update-effect', clipId, effectId, patch } : undefined;
  }
  if (command instanceof ReorderEffectsCommand) {
    const clipId = sanitizeIdentifier(record.clipId, 'clip');
    const orderedEffectIds = sanitizeIdentifierArray(record.orderedEffectIds, 'effect');
    return clipId && orderedEffectIds.length > 0 ? { type: 'reorder-effects', clipId, orderedEffectIds } : undefined;
  }
  return undefined;
}

export function replaceMacroTargetClipId(step: CommandSnapshot, targetClipId: string): CommandSnapshot {
  const clipId = sanitizeIdentifier(targetClipId, 'clip');
  if (!clipId) {
    return cloneCommandSnapshot(step);
  }
  if ('clipId' in step) {
    return { ...cloneCommandSnapshot(step), clipId };
  }
  return cloneCommandSnapshot(step);
}

export function buildMacroCommands(accessor: TimelineAccessor, macro: ClipMacro, targetClipId: string): Command[] {
  const commands: Command[] = [];
  for (const step of getMacroSteps(macro)) {
    const nextStep = replaceMacroTargetClipId(step, targetClipId);
    if (nextStep.type === 'update-clip') {
      commands.push(new UpdateClipCommand(accessor, nextStep.clipId, nextStep.patch));
      continue;
    }
    if (nextStep.type === 'add-effect') {
      commands.push(new AddEffectCommand(accessor, nextStep.clipId, nextStep.effect));
      continue;
    }
    if (nextStep.type === 'remove-effect') {
      commands.push(new RemoveEffectCommand(accessor, nextStep.clipId, nextStep.effectId));
      continue;
    }
    if (nextStep.type === 'update-effect') {
      commands.push(new UpdateEffectCommand(accessor, nextStep.clipId, nextStep.effectId, nextStep.patch));
      continue;
    }
    if (nextStep.type === 'reorder-effects') {
      commands.push(new ReorderEffectsCommand(accessor, nextStep.clipId, nextStep.orderedEffectIds));
    }
  }
  return commands;
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
  if (typeof record.name === 'string' && record.name.trim()) {
    patch.name = record.name.trim();
  }
  return patch;
}

function sanitizeCommandSnapshots(input: unknown): CommandSnapshot[] {
  if (!Array.isArray(input)) {
    return [];
  }
  return input.flatMap((value): CommandSnapshot[] => {
    if (!value || typeof value !== 'object') {
      return [];
    }
    const record = value as Record<string, unknown>;
    const type = typeof record.type === 'string' ? record.type : '';
    const clipId = sanitizeIdentifier(record.clipId, 'clip');
    if (!clipId) {
      return [];
    }
    if (type === 'update-clip') {
      const patch = sanitizeClipPatch(record.patch);
      return Object.keys(patch).length > 0 ? [{ type, clipId, patch }] : [];
    }
    if (type === 'add-effect') {
      const effect = sanitizeAddEffectInput(record.effect);
      return effect ? [{ type, clipId, effect }] : [];
    }
    if (type === 'remove-effect') {
      const effectId = sanitizeIdentifier(record.effectId, 'effect');
      return effectId ? [{ type, clipId, effectId }] : [];
    }
    if (type === 'update-effect') {
      const effectId = sanitizeIdentifier(record.effectId, 'effect');
      const patch = sanitizeEffectPatch(record.patch);
      return effectId && Object.keys(patch).length > 0 ? [{ type, clipId, effectId, patch }] : [];
    }
    if (type === 'reorder-effects') {
      const orderedEffectIds = sanitizeIdentifierArray(record.orderedEffectIds, 'effect');
      return orderedEffectIds.length > 0 ? [{ type, clipId, orderedEffectIds }] : [];
    }
    return [];
  });
}

function sanitizeAddEffectInput(input: unknown): AddEffectInput | undefined {
  if (!input || typeof input !== 'object') {
    return undefined;
  }
  const record = input as Record<string, unknown>;
  const type = sanitizeEffectType(record.type);
  if (!type) {
    return undefined;
  }
  const id = typeof record.id === 'string' && record.id.trim() ? sanitizeIdentifier(record.id, 'effect') : undefined;
  return {
    id,
    type,
    enabled: typeof record.enabled === 'boolean' ? record.enabled : undefined,
    params: sanitizeEffectParams(type, record.params)
  };
}

function sanitizeEffectPatch(input: unknown): EffectPatch {
  if (!input || typeof input !== 'object') {
    return {};
  }
  const record = input as Record<string, unknown>;
  const patch: EffectPatch = {};
  const type = sanitizeEffectType(record.type);
  if (type) {
    patch.type = type;
  }
  if (typeof record.enabled === 'boolean') {
    patch.enabled = record.enabled;
  }
  const params = sanitizeLooseEffectParams(record.params);
  if (Object.keys(params).length > 0) {
    patch.params = type ? normalizeEffectParams(type, params) : params;
  }
  return patch;
}

function sanitizeEffectType(value: unknown): EffectType | undefined {
  return typeof value === 'string' && isEffectType(value) ? value : undefined;
}

function sanitizeEffectParams(type: EffectType, input: unknown): EffectParams {
  return normalizeEffectParams(type, sanitizeLooseEffectParams(input));
}

function sanitizeLooseEffectParams(input: unknown): EffectParams {
  if (!input || typeof input !== 'object') {
    return {};
  }
  const params: EffectParams = {};
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if ((typeof value === 'number' && Number.isFinite(value)) || typeof value === 'string') {
      params[key] = value;
    }
  }
  return params;
}

function sanitizeIdentifierArray(input: unknown, fallbackPrefix: string): string[] {
  if (!Array.isArray(input)) {
    return [];
  }
  return input.flatMap((value) => {
    const id = sanitizeIdentifier(value, fallbackPrefix);
    return id ? [id] : [];
  });
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
  return DEFAULT_CLIP_MACROS.map(cloneMacro);
}

function cloneMacro(macro: ClipMacro): ClipMacro {
  return {
    ...macro,
    patch: macro.patch ? cloneJson(macro.patch) : undefined,
    steps: macro.steps ? cloneCommandSnapshots(macro.steps) : undefined
  };
}

function cloneCommandSnapshots(steps: CommandSnapshot[]): CommandSnapshot[] {
  return steps.map(cloneCommandSnapshot);
}

function cloneCommandSnapshot<T extends CommandSnapshot>(step: T): T {
  return cloneJson(step);
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
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
