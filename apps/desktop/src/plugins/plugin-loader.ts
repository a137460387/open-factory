import type { Clip, ExportSettings, Project } from '@open-factory/editor-core';
import type {
  OpenFactoryPlugin,
  OpenFactoryPluginManifest,
  PluginHookName,
  PluginHookPayloads,
  PluginHooks,
  PluginMessagePayload,
  PluginPermission
} from '@open-factory/plugin-sdk';

export type { OpenFactoryPlugin, OpenFactoryPluginManifest, PluginHookName, PluginHookPayloads, PluginHooks, PluginMessagePayload, PluginPermission };

export interface PluginSourceFile {
  path: string;
  code: string;
  rootPath?: string;
  manifestPath?: string;
  manifest?: Partial<OpenFactoryPluginManifest>;
  dev?: boolean;
}

export interface PluginRuntime {
  plugin: OpenFactoryPlugin;
  invokeHook<K extends PluginHookName>(hookName: K, payload: PluginHookPayloads[K]): Promise<unknown>;
  receiveMessage?(payload: PluginMessagePayload): Promise<void>;
  setMessageRouter?(router: PluginMessageRouter): void;
  dispose(): void;
}

export type PluginMessageRouter = (targetPluginId: string, event: string, data: unknown) => void | Promise<void>;

export interface LoadedPlugin {
  sourcePath: string;
  rootPath: string;
  manifestPath?: string;
  dev: boolean;
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
        rootPath: file.rootPath ?? directoryName(file.path),
        manifestPath: file.manifestPath,
        dev: file.dev === true,
        plugin: runtime.plugin,
        runtime: withPermissionGuard(runtime),
        errors: [],
        builtin: false,
        enabled: true
      });
    } catch (error) {
      errors.push({
        sourcePath: file.path,
        message: formatPluginError(error)
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
    rootPath: 'builtin:export-count',
    dev: false,
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

export function extractManifestPermissions(source: string): PluginPermission[] | undefined {
  const manifestRange = findStaticPropertyValueRange(source, 'manifest', '{', '}');
  if (!manifestRange) {
    return undefined;
  }
  const manifestSource = source.slice(manifestRange.start, manifestRange.end + 1);
  const permissionsRange = findStaticPropertyValueRange(manifestSource, 'permissions', '[', ']');
  if (!permissionsRange) {
    return undefined;
  }
  return normalizePluginPermissions(readStaticStringArray(manifestSource.slice(permissionsRange.start, permissionsRange.end + 1)));
}

async function createWorkerPluginRuntime(source: PluginSourceFile): Promise<PluginRuntime> {
  if (typeof Worker === 'undefined' || typeof URL === 'undefined' || typeof Blob === 'undefined') {
    throw new Error('Plugin workers are unavailable in this environment');
  }
  const workerUrl = URL.createObjectURL(new Blob([WORKER_BOOTSTRAP], { type: 'text/javascript' }));
  const worker = new Worker(workerUrl, { name: `open-factory-plugin-${source.path}` });
  URL.revokeObjectURL(workerUrl);
  let nextId = 1;
  let messageRouter: PluginMessageRouter | undefined;
  const pending = new Map<number, { resolve(value: unknown): void; reject(error: Error): void; timer: ReturnType<typeof setTimeout> }>();
  worker.addEventListener('message', (event: MessageEvent<WorkerResponse>) => {
    const response = event.data;
    if (!('id' in response)) {
      void messageRouter?.(response.toPluginId, response.event, response.data);
      return;
    }
    const entry = pending.get(response.id);
    if (!entry) {
      return;
    }
    clearTimeout(entry.timer);
    pending.delete(response.id);
    if (response.ok) {
      entry.resolve(response.value);
    } else {
      entry.reject(new Error(response.error || 'Plugin worker failed'));
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
  const plugin = normalizeWorkerMetadata(await request({ type: 'load', path: source.path, code: source.code, manifest: source.manifest }));
  return {
    plugin,
    invokeHook(hookName, payload) {
      if (!plugin.hooks[hookName]) {
        return Promise.resolve(undefined);
      }
      return request({ type: 'hook', hookName, payload });
    },
    async receiveMessage(payload) {
      await request({ type: 'message', message: payload });
    },
    setMessageRouter(router) {
      messageRouter = router;
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
  const manifest = record.manifest && typeof record.manifest === 'object' ? (record.manifest as Record<string, unknown>) : record;
  const hooks = Array.isArray(record.hooks) ? record.hooks : [];
  const hookMap: PluginHooks = {};
  for (const hookName of hooks) {
    if (isPluginHookName(hookName)) {
      hookMap[hookName] = (() => undefined) as never;
    }
  }
  return {
    id: typeof manifest.id === 'string' ? manifest.id : 'plugin',
    name: typeof manifest.name === 'string' ? manifest.name : 'plugin',
    version: typeof manifest.version === 'string' ? manifest.version : '0.0.0',
    description: typeof manifest.description === 'string' ? manifest.description : '',
    permissions: normalizePluginPermissions(manifest.permissions),
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

export function formatPluginError(error: unknown): string {
  if (error instanceof Error) {
    return error.stack || error.message;
  }
  return String(error);
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
    receiveMessage(payload) {
      return runtime.receiveMessage?.(payload) ?? Promise.resolve();
    },
    setMessageRouter(router) {
      runtime.setMessageRouter?.(router);
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

function findStaticPropertyValueRange(source: string, propertyName: string, open: '{' | '[', close: '}' | ']'): { start: number; end: number } | undefined {
  let index = 0;
  while (index < source.length) {
    index = skipIgnorable(source, index);
    if (index >= source.length) {
      break;
    }
    const property = readStaticPropertyName(source, index);
    if (!property) {
      index += 1;
      continue;
    }
    const colonIndex = skipIgnorable(source, property.end);
    if (source[colonIndex] !== ':') {
      index = property.end;
      continue;
    }
    const valueStart = skipIgnorable(source, colonIndex + 1);
    if (property.name === propertyName) {
      if (source[valueStart] !== open) {
        return undefined;
      }
      const end = findMatchingDelimiter(source, valueStart, open, close);
      return typeof end === 'number' ? { start: valueStart, end } : undefined;
    }
    index = skipStaticValue(source, valueStart);
  }
  return undefined;
}

function readStaticPropertyName(source: string, index: number): { name: string; end: number } | undefined {
  const quote = source[index];
  if (quote === '"' || quote === "'") {
    const literal = readStringLiteral(source, index);
    return literal ? { name: literal.value, end: literal.end } : undefined;
  }
  if (!isIdentifierStart(source[index])) {
    return undefined;
  }
  let end = index + 1;
  while (end < source.length && isIdentifierPart(source[end])) {
    end += 1;
  }
  return { name: source.slice(index, end), end };
}

function readStaticStringArray(source: string): string[] {
  const values: string[] = [];
  let index = 1;
  while (index < source.length - 1) {
    index = skipIgnorable(source, index);
    if (source[index] === '"' || source[index] === "'") {
      const literal = readStringLiteral(source, index);
      if (!literal) {
        break;
      }
      values.push(literal.value);
      index = literal.end;
      continue;
    }
    index += 1;
  }
  return values;
}

function findMatchingDelimiter(source: string, start: number, open: string, close: string): number | undefined {
  let depth = 0;
  let index = start;
  while (index < source.length) {
    index = skipIgnorable(source, index);
    const char = source[index];
    if (char === '"' || char === "'") {
      const literal = readStringLiteral(source, index);
      index = literal?.end ?? index + 1;
      continue;
    }
    if (char === open) {
      depth += 1;
    }
    if (char === close) {
      depth -= 1;
      if (depth === 0) {
        return index;
      }
    }
    index += 1;
  }
  return undefined;
}

function skipStaticValue(source: string, start: number): number {
  const char = source[start];
  if (char === '"' || char === "'") {
    return readStringLiteral(source, start)?.end ?? start + 1;
  }
  if (char === '{') {
    const end = findMatchingDelimiter(source, start, '{', '}');
    return typeof end === 'number' ? end + 1 : start + 1;
  }
  if (char === '[') {
    const end = findMatchingDelimiter(source, start, '[', ']');
    return typeof end === 'number' ? end + 1 : start + 1;
  }
  return start + 1;
}

function skipIgnorable(source: string, index: number): number {
  let current = index;
  while (current < source.length) {
    if (/\s/.test(source[current])) {
      current += 1;
      continue;
    }
    if (source[current] === '/' && source[current + 1] === '/') {
      current += 2;
      while (current < source.length && source[current] !== '\n') {
        current += 1;
      }
      continue;
    }
    if (source[current] === '/' && source[current + 1] === '*') {
      current += 2;
      while (current < source.length && !(source[current] === '*' && source[current + 1] === '/')) {
        current += 1;
      }
      current = Math.min(source.length, current + 2);
      continue;
    }
    break;
  }
  return current;
}

function readStringLiteral(source: string, start: number): { value: string; end: number } | undefined {
  const quote = source[start];
  let value = '';
  for (let index = start + 1; index < source.length; index += 1) {
    const char = source[index];
    if (char === '\\') {
      const next = source[index + 1];
      if (typeof next === 'string') {
        value += next;
        index += 1;
      }
      continue;
    }
    if (char === quote) {
      return { value, end: index + 1 };
    }
    value += char;
  }
  return undefined;
}

function isIdentifierStart(value: string | undefined): boolean {
  return typeof value === 'string' && /[A-Za-z_$]/.test(value);
}

function isIdentifierPart(value: string | undefined): boolean {
  return typeof value === 'string' && /[A-Za-z0-9_$]/.test(value);
}

function stableHash(input: string): string {
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 31 + input.charCodeAt(index)) >>> 0;
  }
  return hash.toString(16);
}

function directoryName(path: string): string {
  const normalized = path.replace(/\\/g, '/');
  const index = normalized.lastIndexOf('/');
  return index >= 0 ? normalized.slice(0, index) : '.';
}

interface WorkerRequest {
  id: number;
  type: 'load' | 'hook' | 'message';
  path?: string;
  code?: string;
  manifest?: Partial<OpenFactoryPluginManifest>;
  hookName?: PluginHookName;
  payload?: unknown;
  message?: PluginMessagePayload;
}

type WorkerResponse =
  | { id: number; ok: true; value: unknown }
  | { id: number; ok: false; error: string }
  | { type: 'host-send-message'; toPluginId: string; event: string; data: unknown };

const WORKER_BOOTSTRAP = `
let loadedPlugin;
const messageHandlers = [];
function createPluginApi(fromPluginId) {
  return {
    getProject() {
      return Promise.reject(new Error('getProject is unavailable in the current plugin sandbox'));
    },
    updateProject() {
      return Promise.reject(new Error('updateProject is unavailable in the current plugin sandbox'));
    },
    registerMenu() {
      return Promise.reject(new Error('registerMenu is unavailable in the current plugin sandbox'));
    },
    showToast() {
      return Promise.resolve();
    },
    readTextFile() {
      return Promise.reject(new Error('readTextFile is unavailable in the current plugin sandbox'));
    },
    writeTextFile() {
      return Promise.reject(new Error('writeTextFile is unavailable in the current plugin sandbox'));
    },
    sendMessage(pluginId, event, data) {
      self.postMessage({ type: 'host-send-message', fromPluginId, toPluginId: pluginId, event, data });
      return Promise.resolve();
    },
    onMessage(handler) {
      if (typeof handler !== 'function') {
        return () => undefined;
      }
      messageHandlers.push(handler);
      return () => {
        const index = messageHandlers.indexOf(handler);
        if (index >= 0) {
          messageHandlers.splice(index, 1);
        }
      };
    }
  };
}
function normalizePlugin(input, manifestOverride) {
  const record = input && typeof input === 'object' ? input : {};
  const manifest = manifestOverride && typeof manifestOverride === 'object' ? { ...(record.manifest && typeof record.manifest === 'object' ? record.manifest : record), ...manifestOverride } : record.manifest && typeof record.manifest === 'object' ? record.manifest : record;
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
      const preliminaryId = message.manifest && typeof message.manifest.id === 'string' ? message.manifest.id : 'plugin';
      const openFactory = createPluginApi(preliminaryId);
      sandbox.openFactory = openFactory;
      new Function('module', 'exports', 'globalThis', 'openFactory', '"use strict";\\n' + message.code)(module, exports, sandbox, openFactory);
      const exported = module.exports && Object.keys(module.exports).length > 0 ? module.exports : undefined;
      loadedPlugin = normalizePlugin(module.exports.default || exported || sandbox.openFactoryPlugin || sandbox.plugin, message.manifest);
      self.postMessage({ id: message.id, ok: true, value: metadata(loadedPlugin) });
      return;
    }
    if (!loadedPlugin) {
      throw new Error('Plugin is not loaded');
    }
    if (message.type === 'message') {
      await Promise.all(messageHandlers.map((handler) => handler(message.message)));
      self.postMessage({ id: message.id, ok: true, value: undefined });
      return;
    }
    const hook = loadedPlugin.hooks[message.hookName];
    const value = typeof hook === 'function' ? await hook(message.payload) : undefined;
    self.postMessage({ id: message.id, ok: true, value });
  } catch (error) {
    self.postMessage({ id: message.id, ok: false, error: error instanceof Error ? error.stack || error.message : String(error) });
  }
};
`;
