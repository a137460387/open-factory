import type { Clip, ExportSettings, Project } from '@open-factory/editor-core';

export type PluginHookName = 'onClipSelected' | 'onExportBefore' | 'onMenuRegister';
export type PluginPermission = 'read-project' | 'write-project' | 'export-hook' | 'menu-register';

export interface PluginHookPayloads {
  onClipSelected: { clip?: Clip };
  onExportBefore: { project: Project; outputPath: string; settings?: Partial<Omit<ExportSettings, 'outputPath'>> };
  onMenuRegister: { menus: Array<{ id: string; label: string }> };
}

export type PluginHooks = Partial<{
  [K in PluginHookName]: (payload: PluginHookPayloads[K]) => unknown | Promise<unknown>;
}>;

export interface OpenFactoryPlugin {
  id: string;
  name: string;
  version: string;
  description: string;
  permissions: PluginPermission[];
  hooks: PluginHooks;
}

export interface PluginSourceFile {
  path: string;
  code: string;
}

export interface PluginRuntime {
  plugin: OpenFactoryPlugin;
  invokeHook<K extends PluginHookName>(hookName: K, payload: PluginHookPayloads[K]): Promise<unknown>;
  dispose(): void;
}

export interface LoadedPlugin {
  sourcePath: string;
  plugin: OpenFactoryPlugin;
  runtime: PluginRuntime;
  errors: string[];
  builtin: boolean;
  enabled: boolean;
}

export interface PluginRegistry {
  plugins: LoadedPlugin[];
  errors: Array<{ sourcePath: string; message: string }>;
}

export type PluginRuntimeFactory = (source: PluginSourceFile) => Promise<PluginRuntime> | PluginRuntime;

export async function loadPluginFiles(files: PluginSourceFile[], runtimeFactory: PluginRuntimeFactory = createWorkerPluginRuntime): Promise<PluginRegistry> {
  const plugins: LoadedPlugin[] = [];
  const errors: Array<{ sourcePath: string; message: string }> = [];
  for (const file of files) {
    try {
      const runtime = await runtimeFactory(file);
      plugins.push({
        sourcePath: file.path,
        plugin: runtime.plugin,
        runtime: withPermissionGuard(runtime),
        errors: [],
        builtin: false,
        enabled: true
      });
    } catch (error) {
      errors.push({
        sourcePath: file.path,
        message: error instanceof Error ? error.message : String(error)
      });
    }
  }
  return { plugins, errors };
}

export function createBuiltinExamplePlugin(): LoadedPlugin {
  const plugin = normalizePluginMetadata({
    id: 'open-factory.example.export-count',
    name: '导出片段计数示例',
    version: '1.0.0',
    description: '导出前统计项目片段数量。',
    permissions: ['export-hook'],
    hooks: {
      onExportBefore(payload: PluginHookPayloads['onExportBefore']) {
        const clipCount = payload.project.timeline.tracks.reduce((count, track) => count + track.clips.length, 0);
        return { message: `导出前片段数: ${clipCount}` };
      }
    }
  });
  const runtime: PluginRuntime = {
    plugin,
    async invokeHook(hookName, payload) {
      const hook = plugin.hooks[hookName] as ((input: unknown) => unknown) | undefined;
      return hook?.(payload);
    },
    dispose() {
      return undefined;
    }
  };
  const guardedRuntime = withPermissionGuard(runtime);
  return {
    sourcePath: 'builtin:export-count',
    plugin,
    runtime: guardedRuntime,
    errors: [],
    builtin: true,
    enabled: true
  };
}

export function getExportBeforePayload(
  project: Project,
  outputPath: string,
  settings?: Partial<Omit<ExportSettings, 'outputPath'>>
): PluginHookPayloads['onExportBefore'] {
  return { project, outputPath, settings };
}

export function normalizePluginMetadata(input: unknown): OpenFactoryPlugin {
  const record = input && typeof input === 'object' ? (input as Record<string, unknown>) : {};
  const manifest = record.manifest && typeof record.manifest === 'object' ? (record.manifest as Record<string, unknown>) : record;
  const hooks = record.hooks && typeof record.hooks === 'object' ? (record.hooks as Record<string, unknown>) : {};
  const normalizedHooks: PluginHooks = {};
  for (const hookName of ['onClipSelected', 'onExportBefore', 'onMenuRegister'] as const) {
    if (typeof hooks[hookName] === 'function') {
      normalizedHooks[hookName] = hooks[hookName] as never;
    }
  }
  const id = typeof manifest.id === 'string' && manifest.id.trim() ? manifest.id.trim() : `plugin-${stableHash(JSON.stringify(Object.keys(normalizedHooks)))}`;
  const name = typeof manifest.name === 'string' && manifest.name.trim() ? manifest.name.trim() : id;
  const version = typeof manifest.version === 'string' && manifest.version.trim() ? manifest.version.trim() : '0.0.0';
  const description = typeof manifest.description === 'string' ? manifest.description.trim() : '';
  return { id, name, version, description, permissions: normalizePluginPermissions(manifest.permissions), hooks: normalizedHooks };
}

async function createWorkerPluginRuntime(source: PluginSourceFile): Promise<PluginRuntime> {
  if (typeof Worker === 'undefined' || typeof URL === 'undefined' || typeof Blob === 'undefined') {
    throw new Error('Plugin workers are unavailable in this environment');
  }
  const workerUrl = URL.createObjectURL(new Blob([WORKER_BOOTSTRAP], { type: 'text/javascript' }));
  const worker = new Worker(workerUrl, { name: `open-factory-plugin-${source.path}` });
  URL.revokeObjectURL(workerUrl);
  let nextId = 1;
  const pending = new Map<number, { resolve(value: unknown): void; reject(error: Error): void; timer: ReturnType<typeof setTimeout> }>();
  worker.addEventListener('message', (event: MessageEvent<WorkerResponse>) => {
    const entry = pending.get(event.data.id);
    if (!entry) {
      return;
    }
    clearTimeout(entry.timer);
    pending.delete(event.data.id);
    if (event.data.ok) {
      entry.resolve(event.data.value);
    } else {
      entry.reject(new Error(event.data.error || 'Plugin worker failed'));
    }
  });
  const request = (message: Omit<WorkerRequest, 'id'>) =>
    new Promise<unknown>((resolve, reject) => {
      const id = nextId;
      nextId += 1;
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error('Plugin worker timed out'));
      }, 5_000);
      pending.set(id, { resolve, reject, timer });
      worker.postMessage({ ...message, id });
    });
  const plugin = normalizeWorkerMetadata(await request({ type: 'load', path: source.path, code: source.code }));
  return {
    plugin,
    invokeHook(hookName, payload) {
      if (!plugin.hooks[hookName]) {
        return Promise.resolve(undefined);
      }
      return request({ type: 'hook', hookName, payload });
    },
    dispose() {
      for (const [id, entry] of pending) {
        clearTimeout(entry.timer);
        entry.reject(new Error('Plugin disposed'));
        pending.delete(id);
      }
      worker.terminate();
    }
  };
}

function normalizeWorkerMetadata(input: unknown): OpenFactoryPlugin {
  const record = input && typeof input === 'object' ? (input as Record<string, unknown>) : {};
  const hooks = Array.isArray(record.hooks) ? record.hooks : [];
  const hookMap: PluginHooks = {};
  for (const hookName of hooks) {
    if (isPluginHookName(hookName)) {
      hookMap[hookName] = (() => undefined) as never;
    }
  }
  return {
    id: typeof record.id === 'string' ? record.id : 'plugin',
    name: typeof record.name === 'string' ? record.name : 'plugin',
    version: typeof record.version === 'string' ? record.version : '0.0.0',
    description: typeof record.description === 'string' ? record.description : '',
    permissions: normalizePluginPermissions(record.permissions),
    hooks: hookMap
  };
}

export function getRequiredPermissionForHook(hookName: PluginHookName): PluginPermission {
  if (hookName === 'onExportBefore') {
    return 'export-hook';
  }
  if (hookName === 'onMenuRegister') {
    return 'menu-register';
  }
  return 'read-project';
}

export function assertPluginHookPermission(plugin: OpenFactoryPlugin, hookName: PluginHookName): void {
  const required = getRequiredPermissionForHook(hookName);
  if (!plugin.permissions.includes(required)) {
    throw new Error(`${plugin.name} missing ${required} permission for ${hookName}`);
  }
}

export function getLoadedPluginStatus(plugin: LoadedPlugin): 'enabled' | 'disabled' | 'error' {
  if (!plugin.enabled) {
    return 'disabled';
  }
  return plugin.errors.length > 0 ? 'error' : 'enabled';
}

function withPermissionGuard(runtime: PluginRuntime): PluginRuntime {
  return {
    plugin: runtime.plugin,
    async invokeHook(hookName, payload) {
      if (!runtime.plugin.hooks[hookName]) {
        return undefined;
      }
      assertPluginHookPermission(runtime.plugin, hookName);
      return runtime.invokeHook(hookName, payload);
    },
    dispose() {
      runtime.dispose();
    }
  };
}

function normalizePluginPermissions(input: unknown): PluginPermission[] {
  if (!Array.isArray(input)) {
    return [];
  }
  return Array.from(new Set(input.filter(isPluginPermission)));
}

function isPluginPermission(value: unknown): value is PluginPermission {
  return value === 'read-project' || value === 'write-project' || value === 'export-hook' || value === 'menu-register';
}

function isPluginHookName(value: unknown): value is PluginHookName {
  return value === 'onClipSelected' || value === 'onExportBefore' || value === 'onMenuRegister';
}

function stableHash(input: string): string {
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 31 + input.charCodeAt(index)) >>> 0;
  }
  return hash.toString(16);
}

interface WorkerRequest {
  id: number;
  type: 'load' | 'hook';
  path?: string;
  code?: string;
  hookName?: PluginHookName;
  payload?: unknown;
}

type WorkerResponse = { id: number; ok: true; value: unknown } | { id: number; ok: false; error: string };

const WORKER_BOOTSTRAP = `
let loadedPlugin;
function normalizePlugin(input) {
  const record = input && typeof input === 'object' ? input : {};
  const manifest = record.manifest && typeof record.manifest === 'object' ? record.manifest : record;
  const hooks = record.hooks && typeof record.hooks === 'object' ? record.hooks : {};
  return {
    id: typeof manifest.id === 'string' && manifest.id.trim() ? manifest.id.trim() : 'plugin',
    name: typeof manifest.name === 'string' && manifest.name.trim() ? manifest.name.trim() : 'plugin',
    version: typeof manifest.version === 'string' && manifest.version.trim() ? manifest.version.trim() : '0.0.0',
    description: typeof manifest.description === 'string' && manifest.description.trim() ? manifest.description.trim() : '',
    permissions: Array.isArray(manifest.permissions) ? Array.from(new Set(manifest.permissions.filter((permission) => ['read-project', 'write-project', 'export-hook', 'menu-register'].includes(permission)))) : [],
    hooks
  };
}
function metadata(plugin) {
  return {
    id: plugin.id,
    name: plugin.name,
    version: plugin.version,
    description: plugin.description,
    permissions: plugin.permissions,
    hooks: Object.keys(plugin.hooks).filter((key) => typeof plugin.hooks[key] === 'function')
  };
}
self.onmessage = async (event) => {
  const message = event.data;
  try {
    if (message.type === 'load') {
      const module = { exports: {} };
      const exports = module.exports;
      const sandbox = {};
      new Function('module', 'exports', 'globalThis', '"use strict";\\n' + message.code)(module, exports, sandbox);
      const exported = module.exports && Object.keys(module.exports).length > 0 ? module.exports : undefined;
      loadedPlugin = normalizePlugin(module.exports.default || exported || sandbox.openFactoryPlugin || sandbox.plugin);
      self.postMessage({ id: message.id, ok: true, value: metadata(loadedPlugin) });
      return;
    }
    if (!loadedPlugin) {
      throw new Error('Plugin is not loaded');
    }
    const hook = loadedPlugin.hooks[message.hookName];
    const value = typeof hook === 'function' ? await hook(message.payload) : undefined;
    self.postMessage({ id: message.id, ok: true, value });
  } catch (error) {
    self.postMessage({ id: message.id, ok: false, error: error instanceof Error ? error.message : String(error) });
  }
};
`;
