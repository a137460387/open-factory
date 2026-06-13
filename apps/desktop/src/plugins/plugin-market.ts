import { copyFile, getAppDataDir, readFile, writeFile } from '../lib/tauri-bridge';
import { refreshPluginRegistry, type PluginRegistry } from './plugin-manager';
import type { PluginPermission } from './plugin-loader';

export const PLUGIN_CATALOG_URL = '/plugin-catalog.json';
export const PLUGIN_CATALOG_CACHE_FILE = 'plugin-catalog-cache.json';

export interface PluginCatalogEntry {
  id: string;
  name: string;
  author: string;
  version: string;
  description: string;
  permissions: PluginPermission[];
  downloadUrl: string;
}

export interface PluginCatalogResult {
  entries: PluginCatalogEntry[];
  source: 'network' | 'cache';
}

export type PluginInstallStatus = 'not-installed' | 'installed' | 'update-available';

export interface PluginInstallState {
  status: PluginInstallStatus;
  installedVersion?: string;
}

export interface PluginCatalogResponseLike {
  ok: boolean;
  text(): Promise<string>;
}

export type PluginCatalogFetcher = (url: string) => Promise<PluginCatalogResponseLike>;

const VALID_PLUGIN_PERMISSIONS: PluginPermission[] = ['read-project', 'write-project', 'export-hook', 'menu-register'];

export async function loadPluginCatalog({
  url = PLUGIN_CATALOG_URL,
  fetcher = defaultFetcher,
  readCache = readDefaultCatalogCache,
  writeCache = writeDefaultCatalogCache
}: {
  url?: string;
  fetcher?: PluginCatalogFetcher;
  readCache?: () => Promise<string | undefined>;
  writeCache?: (contents: string) => Promise<void>;
} = {}): Promise<PluginCatalogResult> {
  try {
    const response = await fetcher(url);
    if (!response.ok) {
      throw new Error(`Catalog request failed: ${response.ok}`);
    }
    const contents = await response.text();
    const entries = parsePluginCatalogJson(contents);
    await writeCache(contents).catch(() => undefined);
    return { entries, source: 'network' };
  } catch (error) {
    const cached = await readCache();
    if (!cached) {
      throw error;
    }
    return { entries: parsePluginCatalogJson(cached), source: 'cache' };
  }
}

export function parsePluginCatalogJson(contents: string): PluginCatalogEntry[] {
  const parsed = JSON.parse(contents) as unknown;
  const rawEntries = Array.isArray(parsed) ? parsed : parsed && typeof parsed === 'object' && Array.isArray((parsed as { plugins?: unknown }).plugins) ? (parsed as { plugins: unknown[] }).plugins : [];
  return rawEntries.flatMap((entry) => {
    const normalized = normalizeCatalogEntry(entry);
    return normalized ? [normalized] : [];
  });
}

export function compareSemver(left: string, right: string): number {
  const leftParts = parseSemver(left);
  const rightParts = parseSemver(right);
  for (let index = 0; index < 3; index += 1) {
    const delta = leftParts[index] - rightParts[index];
    if (delta !== 0) {
      return delta > 0 ? 1 : -1;
    }
  }
  return 0;
}

export function getCatalogEntryInstallState(entry: PluginCatalogEntry, registry: PluginRegistry | undefined): PluginInstallState {
  const installed = registry?.plugins.find((plugin) => plugin.plugin.id === entry.id);
  if (!installed) {
    return { status: 'not-installed' };
  }
  return compareSemver(entry.version, installed.plugin.version) > 0
    ? { status: 'update-available', installedVersion: installed.plugin.version }
    : { status: 'installed', installedVersion: installed.plugin.version };
}

export async function installCatalogPlugin(entry: PluginCatalogEntry, fetcher: PluginCatalogFetcher = defaultFetcher): Promise<string> {
  const response = await fetcher(entry.downloadUrl);
  if (!response.ok) {
    throw new Error(`Plugin download failed: ${entry.downloadUrl}`);
  }
  const code = await response.text();
  if (!code.trim()) {
    throw new Error('Downloaded plugin was empty.');
  }
  const path = await pluginDestinationPath(`${entry.id}.js`);
  await writeFile(path, code);
  await refreshPluginRegistry();
  return path;
}

export async function installPluginFromFile(sourcePath: string): Promise<string> {
  const path = await pluginDestinationPath(fileNameFromPath(sourcePath));
  await copyFile(sourcePath, path);
  await refreshPluginRegistry();
  return path;
}

async function readDefaultCatalogCache(): Promise<string | undefined> {
  try {
    return await readFile(await catalogCachePath());
  } catch {
    return undefined;
  }
}

async function writeDefaultCatalogCache(contents: string): Promise<void> {
  await writeFile(await catalogCachePath(), contents);
}

async function catalogCachePath(): Promise<string> {
  return `${normalizePath(await getAppDataDir())}/${PLUGIN_CATALOG_CACHE_FILE}`;
}

async function pluginDestinationPath(fileName: string): Promise<string> {
  return `${normalizePath(await getAppDataDir())}/plugins/${sanitizePluginFileName(fileName)}`;
}

function normalizeCatalogEntry(input: unknown): PluginCatalogEntry | undefined {
  const record = input && typeof input === 'object' ? (input as Record<string, unknown>) : {};
  const id = stringValue(record.id);
  const name = stringValue(record.name);
  const author = stringValue(record.author);
  const version = stringValue(record.version);
  const downloadUrl = stringValue(record.downloadUrl);
  if (!id || !name || !author || !version || !downloadUrl) {
    return undefined;
  }
  return {
    id,
    name,
    author,
    version,
    description: stringValue(record.description),
    permissions: normalizePermissions(record.permissions),
    downloadUrl
  };
}

function normalizePermissions(input: unknown): PluginPermission[] {
  const permissions = Array.isArray(input) ? input : [];
  return permissions.filter((permission): permission is PluginPermission => VALID_PLUGIN_PERMISSIONS.includes(permission as PluginPermission));
}

function parseSemver(value: string): [number, number, number] {
  const [major = '0', minor = '0', patch = '0'] = value.split(/[+-]/)[0].split('.');
  return [major, minor, patch].map((part) => {
    const parsed = Number.parseInt(part, 10);
    return Number.isFinite(parsed) ? parsed : 0;
  }) as [number, number, number];
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function sanitizePluginFileName(fileName: string): string {
  const cleaned = fileNameFromPath(fileName)
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/-+/g, '-');
  return cleaned.toLowerCase().endsWith('.js') ? cleaned : `${cleaned || 'plugin'}.js`;
}

function fileNameFromPath(path: string): string {
  return path.split(/[\\/]/).filter(Boolean).at(-1) ?? 'plugin.js';
}

function normalizePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/\/+$/, '');
}

async function defaultFetcher(url: string): Promise<PluginCatalogResponseLike> {
  if (typeof fetch !== 'function') {
    throw new Error('Plugin catalog fetch is unavailable.');
  }
  return fetch(url);
}
