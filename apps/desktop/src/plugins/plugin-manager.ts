import type { ExportSettings, Project } from '@open-factory/editor-core';
import { fsExists, getAppDataDir, readFile, removeFile, scanDirectory } from '../lib/tauri-bridge';
import {
  createBuiltinExamplePlugin,
  getExportBeforePayload,
  loadPluginFiles,
  type LoadedPlugin,
  type PluginHookName,
  type PluginHookPayloads,
  type PluginRegistry,
  type PluginSourceFile
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
const hookLog: PluginHookLogEntry[] = [];

export async function refreshPluginRegistry(): Promise<PluginRegistry> {
  for (const plugin of registry?.plugins ?? []) {
    plugin.runtime.dispose();
  }
  registryPromise = loadRegistry().finally(() => {
    registryPromise = undefined;
  });
  registry = await registryPromise;
  return registry;
}

export async function ensurePluginRegistry(): Promise<PluginRegistry> {
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

export async function runPluginHook<K extends PluginHookName>(hookName: K, payload: PluginHookPayloads[K]): Promise<PluginHookLogEntry[]> {
  const current = await ensurePluginRegistry();
  return runPluginHookForRegistry(current, hookName, payload);
}

export async function runPluginHookForRegistry<K extends PluginHookName>(
  current: PluginRegistry,
  hookName: K,
  payload: PluginHookPayloads[K]
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
      const message = error instanceof Error ? error.message : String(error);
      loaded.errors.push(message);
      const entry = { pluginId: loaded.plugin.id, hookName, ok: false, error: message };
      hookLog.push(entry);
      entries.push(entry);
    }
  }
  return entries;
}

export function runExportBeforePlugins(project: Project, outputPath: string, settings?: Partial<Omit<ExportSettings, 'outputPath'>>): Promise<PluginHookLogEntry[]> {
  return runPluginHook('onExportBefore', getExportBeforePayload(project, outputPath, settings));
}

export function getPluginHookLog(): PluginHookLogEntry[] {
  return [...hookLog];
}

export function clearPluginHookLog(): void {
  hookLog.length = 0;
}

export function resetPluginRegistryForTests(): void {
  for (const plugin of registry?.plugins ?? []) {
    plugin.runtime.dispose();
  }
  registry = undefined;
  registryPromise = undefined;
  clearPluginHookLog();
  writeDisabledPluginIds(new Set());
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
    plugins: registry.plugins.map((entry) => (entry.plugin.id === pluginId ? { ...entry, enabled } : entry))
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
      enabled: !disabledPluginIds.has(entry.plugin.id)
    })),
    errors: loaded.errors
  };
}

async function readPluginFiles(): Promise<PluginSourceFile[]> {
  const root = normalizePath(await getAppDataDir());
  const pluginDir = `${root}/plugins`;
  if (!(await fsExists(pluginDir))) {
    return [];
  }
  const paths = (await scanDirectory(pluginDir, 1)).map(normalizePath).filter((path) => path.toLowerCase().endsWith('.js'));
  const files: PluginSourceFile[] = [];
  for (const path of Array.from(new Set(paths)).sort((left, right) => left.localeCompare(right))) {
    files.push({ path, code: await readFile(path) });
  }
  return files;
}

function normalizePath(path: string): string {
  return path.replace(/\\/g, '/');
}

function readDisabledPluginIds(): Set<string> {
  if (typeof window === 'undefined') {
    return new Set();
  }
  try {
    const parsed = JSON.parse(window.localStorage.getItem(PLUGIN_STATE_KEY) ?? '{}') as { disabledPluginIds?: unknown };
    return new Set(Array.isArray(parsed.disabledPluginIds) ? parsed.disabledPluginIds.filter((id): id is string => typeof id === 'string') : []);
  } catch {
    return new Set();
  }
}

function writeDisabledPluginIds(disabledPluginIds: Set<string>): void {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.setItem(PLUGIN_STATE_KEY, JSON.stringify({ disabledPluginIds: Array.from(disabledPluginIds).sort() }));
}

export type { LoadedPlugin, PluginRegistry };
