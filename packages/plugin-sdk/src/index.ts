import type { Clip, ExportSettings, Project } from '@open-factory/editor-core';

export type PluginHookName = 'onClipSelected' | 'onExportBefore' | 'onMenuRegister';
export type PluginPermission = 'read-project' | 'write-project' | 'export-hook' | 'menu-register';
export type PluginToastKind = 'info' | 'warning' | 'error';

export interface PluginMenuItem {
  id: string;
  label: string;
}

export interface PluginHookPayloads {
  onClipSelected: { clip?: Clip };
  onExportBefore: { project: Project; outputPath: string; settings?: Partial<Omit<ExportSettings, 'outputPath'>> };
  onMenuRegister: { menus: PluginMenuItem[] };
}

export type PluginHooks = Partial<{
  [K in PluginHookName]: (payload: PluginHookPayloads[K]) => unknown | Promise<unknown>;
}>;

export interface PluginMessagePayload<TData = unknown> {
  fromPluginId: string;
  event: string;
  data: TData;
}

export type PluginMessageHandler<TData = unknown> = (payload: PluginMessagePayload<TData>) => void | Promise<void>;

export interface PluginAPI {
  getProject(): Promise<Project>;
  updateProject(project: Project): Promise<void>;
  registerMenu(item: PluginMenuItem): Promise<void>;
  showToast(kind: PluginToastKind, title: string, message?: string): Promise<void>;
  readTextFile(path: string): Promise<string>;
  writeTextFile(path: string, contents: string): Promise<void>;
  sendMessage<TData = unknown>(pluginId: string, event: string, data: TData): Promise<void>;
  onMessage<TData = unknown>(handler: PluginMessageHandler<TData>): () => void;
}

declare global {
  const openFactory: PluginAPI;
}

export const PLUGIN_API_HOST_FUNCTIONS = [
  'getProject',
  'updateProject',
  'registerMenu',
  'showToast',
  'readTextFile',
  'writeTextFile',
  'sendMessage',
  'onMessage'
] as const satisfies readonly (keyof PluginAPI)[];

type MissingPluginApiHostFunctions = Exclude<keyof PluginAPI, (typeof PLUGIN_API_HOST_FUNCTIONS)[number]>;
const pluginApiHostFunctionCompletenessCheck: MissingPluginApiHostFunctions extends never ? true : never = true;
void pluginApiHostFunctionCompletenessCheck;

export interface OpenFactoryPluginManifest {
  id: string;
  name: string;
  version: string;
  description?: string;
  permissions?: PluginPermission[];
  main?: string;
  dev?: boolean;
}

export interface OpenFactoryPlugin {
  id: string;
  name: string;
  version: string;
  description: string;
  permissions: PluginPermission[];
  hooks: PluginHooks;
}

export type OpenFactoryPluginModule = OpenFactoryPlugin | {
  manifest: OpenFactoryPluginManifest;
  hooks?: PluginHooks;
};
