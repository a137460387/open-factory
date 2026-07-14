import { logError } from '../lib/error-handlers';
import type { ExportSettings, Project } from '@open-factory/editor-core';
import { fsExists, getAppDataDir, getFileStat, readFile, removeFile, scanDirectory } from '../lib/tauri-bridge';
import {
  createBuiltinExamplePlugin,
  formatPluginError,
  getExportBeforePayload,
  loadPluginFiles,
  type LoadedPlugin,
  type OpenFactoryPluginManifest,
  type PluginHookName,
  type PluginHookPayloads,
  type PluginMessagePayload,
  type PluginRegistry,
  type PluginSourceFile,
} from './plugin-loader';

const PLUGIN_STATE_KEY = 'open-factory:plugins';

export interface PluginHookLogEntry {
  pluginId: string;
  hookName: PluginHookName;
  ok: boolean;
  result?: unknown;
  error?: string;
}

let registry: PluginRegistry | undefined;
let registryPromise: Promise<PluginRegistry> | undefined;
let devWatcher: PluginDevWatcher | undefined;
const hookLog: PluginHookLogEntry[] = [];

export async function refreshPluginRegistry(): Promise<PluginRegistry> {
  stopPluginDevWatcher();
  for (const plugin of registry?.plugins ?? []) {
    plugin.runtime.dispose();
  }
  registryPromise = loadRegistry().finally(() => {
    registryPromise = undefined;
  });
  registry = await registryPromise;
  wirePluginMessageRouting(registry);
  startPluginDevWatcher(registry);
  return registry;
}

async function ensurePluginRegistry(): Promise<PluginRegistry> {
  if (registry) {
    return registry;
  }
  if (registryPromise) {
    return registryPromise;
  }
  return refreshPluginRegistry();
}

export function getPluginRegistrySnapshot(): PluginRegistry | undefined {
  return registry;
}

async function runPluginHook<K extends PluginHookName>(
  hookName: K,
  payload: PluginHookPayloads[K],
): Promise<PluginHookLogEntry[]> {
  const current = await ensurePluginRegistry();
  return runPluginHookForRegistry(current, hookName, payload);
}

export async function runPluginHookForRegistry<K extends PluginHookName>(
  current: PluginRegistry,
  hookName: K,
  payload: PluginHookPayloads[K],
): Promise<PluginHookLogEntry[]> {
  const entries: PluginHookLogEntry[] = [];
  for (const loaded of current.plugins) {
    if (!loaded.enabled) {
      continue;
    }
    if (!loaded.plugin.hooks[hookName]) {
      continue;
    }
    try {
      const result = await loaded.runtime.invokeHook(hookName, payload);
      const entry = { pluginId: loaded.plugin.id, hookName, ok: true, result };
      hookLog.push(entry);
      entries.push(entry);
    } catch (error) {
      const message = formatPluginError(error);
      loaded.errors.push(message);
      const entry = { pluginId: loaded.plugin.id, hookName, ok: false, error: message };
      hookLog.push(entry);
      entries.push(entry);
    }
  }
  return entries;
}

export function runExportBeforePlugins(
  project: Project,
  outputPath: string,
  settings?: Partial<Omit<ExportSettings, 'outputPath'>>,
): Promise<PluginHookLogEntry[]> {
  return runPluginHook('onExportBefore', getExportBeforePayload(project, outputPath, settings));
}

export function getPluginHookLog(): PluginHookLogEntry[] {
  return [...hookLog];
}

export function clearPluginHookLog(): void {
  hookLog.length = 0;
}

export function setPluginEnabled(pluginId: string, enabled: boolean): PluginRegistry | undefined {
  const disabled = readDisabledPluginIds();
  if (enabled) {
    disabled.delete(pluginId);
  } else {
    disabled.add(pluginId);
  }
  writeDisabledPluginIds(disabled);
  if (!registry) {
    return registry;
  }
  registry = {
    ...registry,
    plugins: registry.plugins.map((entry) => (entry.plugin.id === pluginId ? { ...entry, enabled } : entry)),
  };
  return registry;
}

export async function uninstallPlugin(sourcePath: string): Promise<PluginRegistry> {
  const entry = registry?.plugins.find((plugin) => plugin.sourcePath === sourcePath);
  if (entry?.builtin) {
    throw new Error('Built-in plugins cannot be uninstalled.');
  }
  await removeFile(sourcePath);
  return refreshPluginRegistry();
}

async function loadRegistry(): Promise<PluginRegistry> {
  const disabledPluginIds = readDisabledPluginIds();
  const builtin = createBuiltinExamplePlugin();
  const files = await readPluginFiles();
  const loaded = await loadPluginFiles(files);
  return {
    plugins: [builtin, ...loaded.plugins].map((entry) => ({
      ...entry,
      enabled: !disabledPluginIds.has(entry.plugin.id),
    })),
    errors: loaded.errors,
  };
}

async function readPluginFiles(): Promise<PluginSourceFile[]> {
  const root = normalizePath(await getAppDataDir());
  const pluginDir = `${root}/plugins`;
  if (!(await fsExists(pluginDir))) {
    return [];
  }
  const paths = (await scanDirectory(pluginDir, 2)).map(normalizePath);
  const files: PluginSourceFile[] = [];
  const manifestPaths = new Set(paths.filter((path) => fileName(path).toLowerCase() === 'plugin.json'));
  const manifestRoots = new Set(Array.from(manifestPaths).map(directoryName));

  for (const manifestPath of Array.from(manifestPaths).sort((left, right) => left.localeCompare(right))) {
    const rootPath = directoryName(manifestPath);
    const manifest = parsePluginManifest(await readFile(manifestPath));
    const main = sanitizeManifestMain(manifest.main);
    const entryPath = normalizePath(`${rootPath}/${main}`);
    if (!(await fsExists(entryPath))) {
      throw new Error(`Plugin entry not found: ${entryPath}`);
    }
    files.push({
      path: entryPath,
      rootPath,
      manifestPath,
      manifest,
      dev: manifest.dev === true,
      code: await readFile(entryPath),
    });
  }

  for (const path of Array.from(new Set(paths)).sort((left, right) => left.localeCompare(right))) {
    if (!path.toLowerCase().endsWith('.js')) {
      continue;
    }
    if (manifestRoots.has(directoryName(path))) {
      continue;
    }
    files.push({ path, rootPath: directoryName(path), code: await readFile(path) });
  }
  return files;
}

function normalizePath(path: string): string {
  return path.replace(/\\/g, '/');
}

function parsePluginManifest(contents: string): Partial<OpenFactoryPluginManifest> {
  const parsed = JSON.parse(contents) as unknown;
  return parsed && typeof parsed === 'object' ? (parsed as Partial<OpenFactoryPluginManifest>) : {};
}

function sanitizeManifestMain(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) {
    return 'index.js';
  }
  return value.replace(/\\/g, '/').replace(/^\/+/, '');
}

function fileName(path: string): string {
  return path.split('/').filter(Boolean).at(-1) ?? path;
}

function directoryName(path: string): string {
  const normalized = normalizePath(path).replace(/\/+$/, '');
  const index = normalized.lastIndexOf('/');
  return index >= 0 ? normalized.slice(0, index) : '.';
}

export interface PluginDevWatcher {
  start(): void;
  stop(): void;
  tick(): Promise<boolean>;
}

export function createPluginDevWatcher({
  roots,
  intervalMs = 750,
  readSignature,
  onReload,
  setTimer = setInterval,
  clearTimer = clearInterval,
}: {
  roots: string[];
  intervalMs?: number;
  readSignature(roots: string[]): Promise<string>;
  onReload(): Promise<void> | void;
  setTimer?(handler: () => void, intervalMs: number): ReturnType<typeof setInterval>;
  clearTimer?(handle: ReturnType<typeof setInterval>): void;
}): PluginDevWatcher {
  let stopped = true;
  let timer: ReturnType<typeof setInterval> | undefined;
  let lastSignature: string | undefined;
  let checking = false;
  const tick = async () => {
    if (checking) {
      return false;
    }
    checking = true;
    try {
      const nextSignature = await readSignature(roots);
      if (lastSignature === undefined) {
        lastSignature = nextSignature;
        return false;
      }
      if (nextSignature === lastSignature) {
        return false;
      }
      lastSignature = nextSignature;
      await onReload();
      return true;
    } finally {
      checking = false;
    }
  };
  return {
    start() {
      if (!stopped) {
        return;
      }
      stopped = false;
      void tick();
      timer = setTimer(() => {
        void tick();
      }, intervalMs);
    },
    stop() {
      stopped = true;
      if (timer !== undefined) {
        clearTimer(timer);
        timer = undefined;
      }
    },
    tick,
  };
}

async function readPluginDevSignature(roots: string[]): Promise<string> {
  const entries: string[] = [];
  for (const root of Array.from(new Set(roots.map(normalizePath))).sort((left, right) => left.localeCompare(right))) {
    const paths = (await scanDirectory(root, 3).catch(() => []))
      .map(normalizePath)
      .sort((left, right) => left.localeCompare(right));
    for (const path of paths) {
      const stat = await getFileStat(path).catch(logError('plugin-manager'));
      entries.push(`${path}:${stat?.size ?? -1}:${stat?.mtimeMs ?? -1}`);
    }
  }
  return entries.join('|');
}

export function wirePluginMessageRouting(current: PluginRegistry): void {
  for (const source of current.plugins) {
    source.runtime.setMessageRouter?.(async (targetPluginId, event, data) => {
      await routePluginMessageForRegistry(current, source.plugin.id, targetPluginId, event, data);
    });
  }
}

export async function routePluginMessageForRegistry(
  current: PluginRegistry,
  fromPluginId: string,
  targetPluginId: string,
  event: string,
  data: unknown,
): Promise<boolean> {
  const target = current.plugins.find((plugin) => plugin.enabled && plugin.plugin.id === targetPluginId);
  if (!target?.runtime.receiveMessage) {
    return false;
  }
  const payload: PluginMessagePayload = { fromPluginId, event, data };
  await target.runtime.receiveMessage(payload);
  return true;
}

function startPluginDevWatcher(current: PluginRegistry): void {
  const roots = current.plugins.filter((plugin) => plugin.dev && !plugin.builtin).map((plugin) => plugin.rootPath);
  if (roots.length === 0 || typeof window === 'undefined') {
    return;
  }
  devWatcher = createPluginDevWatcher({
    roots,
    readSignature: readPluginDevSignature,
    onReload: async () => {
      await refreshPluginRegistry();
    },
  });
  devWatcher.start();
}

function stopPluginDevWatcher(): void {
  devWatcher?.stop();
  devWatcher = undefined;
}

function readDisabledPluginIds(): Set<string> {
  if (typeof window === 'undefined') {
    return new Set();
  }
  try {
    const parsed = JSON.parse(window.localStorage.getItem(PLUGIN_STATE_KEY) ?? '{}') as { disabledPluginIds?: unknown };
    return new Set(
      Array.isArray(parsed.disabledPluginIds)
        ? parsed.disabledPluginIds.filter((id): id is string => typeof id === 'string')
        : [],
    );
  } catch {
    return new Set();
  }
}

function writeDisabledPluginIds(disabledPluginIds: Set<string>): void {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.setItem(
    PLUGIN_STATE_KEY,
    JSON.stringify({ disabledPluginIds: Array.from(disabledPluginIds).sort() }),
  );
}

export type { LoadedPlugin, PluginRegistry };
