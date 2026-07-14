import { logError } from '../lib/error-handlers';
import { bridgeConfirm, copyFile, getAppDataDir, readFile, writeFile } from '../lib/tauri-bridge';
import { refreshPluginRegistry, type PluginRegistry } from './plugin-manager';
import { extractManifestPermissions, type PluginPermission } from './plugin-loader';

const PLUGIN_CATALOG_URL = '/plugin-catalog.json';
const PLUGIN_CATALOG_CACHE_FILE = 'plugin-catalog-cache.json';

export interface PluginCatalogEntry {
  id: string;
  name: string;
  author: string;
  version: string;
  description: string;
  permissions: PluginPermission[];
  downloadUrl: string;
  sha256: string;
}

export interface PluginCatalogResult {
  entries: PluginCatalogEntry[];
  source: 'network' | 'cache';
}

type PluginInstallStatus = 'not-installed' | 'installed' | 'update-available';

export interface PluginInstallState {
  status: PluginInstallStatus;
  installedVersion?: string;
}

interface PluginCatalogResponseLike {
  ok: boolean;
  text(): Promise<string>;
}

export type PluginCatalogFetcher = (url: string) => Promise<PluginCatalogResponseLike>;
type PluginInstallConfirmer = (
  entry: PluginCatalogEntry,
  permissions: PluginPermission[],
) => Promise<boolean> | boolean;
type PluginHashProvider = (contents: string) => Promise<string> | string;

export interface PluginInstallOptions {
  fetcher?: PluginCatalogFetcher;
  confirmInstall?: PluginInstallConfirmer;
  hashProvider?: PluginHashProvider;
}

const VALID_PLUGIN_PERMISSIONS: PluginPermission[] = ['read-project', 'write-project', 'export-hook', 'menu-register'];
const SHA256_HEX_PATTERN = /^[a-f0-9]{64}$/i;

export async function loadPluginCatalog({
  url = PLUGIN_CATALOG_URL,
  fetcher = defaultFetcher,
  readCache = readDefaultCatalogCache,
  writeCache = writeDefaultCatalogCache,
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
    await writeCache(contents).catch(logError('plugin-market'));
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
  const rawEntries = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === 'object' && Array.isArray((parsed as { plugins?: unknown }).plugins)
      ? (parsed as { plugins: unknown[] }).plugins
      : [];
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

export function getCatalogEntryInstallState(
  entry: PluginCatalogEntry,
  registry: PluginRegistry | undefined,
): PluginInstallState {
  const installed = registry?.plugins.find((plugin) => plugin.plugin.id === entry.id);
  if (!installed) {
    return { status: 'not-installed' };
  }
  return compareSemver(entry.version, installed.plugin.version) > 0
    ? { status: 'update-available', installedVersion: installed.plugin.version }
    : { status: 'installed', installedVersion: installed.plugin.version };
}

export async function installCatalogPlugin(
  entry: PluginCatalogEntry,
  optionsOrFetcher: PluginCatalogFetcher | PluginInstallOptions = defaultFetcher,
): Promise<string> {
  const options = typeof optionsOrFetcher === 'function' ? { fetcher: optionsOrFetcher } : optionsOrFetcher;
  const fetcher = options.fetcher ?? defaultFetcher;
  const declaredHash = normalizeSha256(entry.sha256);
  if (!declaredHash) {
    throw new Error('Plugin catalog entry is missing a valid SHA-256 hash.');
  }
  const response = await fetcher(entry.downloadUrl);
  if (!response.ok) {
    throw new Error(`Plugin download failed: ${entry.downloadUrl}`);
  }
  const code = await response.text();
  if (!code.trim()) {
    throw new Error('Downloaded plugin was empty.');
  }
  const actualHash = normalizeSha256(await (options.hashProvider ?? computeSha256Hex)(code));
  if (!actualHash || actualHash !== declaredHash) {
    throw new Error('Plugin integrity check failed: SHA-256 mismatch.');
  }
  const manifestPermissions = extractManifestPermissions(code);
  if (!manifestPermissions) {
    throw new Error('Plugin manifest permissions could not be verified.');
  }
  if (!samePermissionSet(entry.permissions, manifestPermissions)) {
    throw new Error('Plugin manifest permissions do not match the catalog entry.');
  }
  const accepted = await (options.confirmInstall ?? confirmCatalogPluginInstall)(entry, manifestPermissions);
  if (!accepted) {
    throw new Error('Plugin installation canceled.');
  }
  const path = await pluginDestinationPath(`${entry.id}.js`);
  await writeFile(path, code);
  await refreshPluginRegistry();
  return path;
}

async function computeSha256Hex(contents: string): Promise<string> {
  if (!globalThis.crypto?.subtle) {
    throw new Error('Web Crypto API is unavailable for plugin verification.');
  }
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(contents));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
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
  const sha256 = normalizeSha256(stringValue(record.sha256));
  if (!id || !name || !author || !version || !downloadUrl || !sha256) {
    return undefined;
  }
  return {
    id,
    name,
    author,
    version,
    description: stringValue(record.description),
    permissions: normalizePermissions(record.permissions),
    downloadUrl,
    sha256,
  };
}

function normalizePermissions(input: unknown): PluginPermission[] {
  const permissions = Array.isArray(input) ? input : [];
  return permissions.filter((permission): permission is PluginPermission =>
    VALID_PLUGIN_PERMISSIONS.includes(permission as PluginPermission),
  );
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

function normalizeSha256(value: unknown): string | undefined {
  const hash = stringValue(value).toLowerCase();
  return SHA256_HEX_PATTERN.test(hash) ? hash : undefined;
}

function samePermissionSet(left: PluginPermission[], right: PluginPermission[]): boolean {
  const leftSet = new Set(left);
  const rightSet = new Set(right);
  return leftSet.size === rightSet.size && Array.from(leftSet).every((permission) => rightSet.has(permission));
}

function confirmCatalogPluginInstall(entry: PluginCatalogEntry, permissions: PluginPermission[]): Promise<boolean> {
  const permissionList = permissions.length > 0 ? permissions.join(', ') : 'none';
  return bridgeConfirm(
    [
      `插件名称：${entry.name}`,
      `来源 URL：${entry.downloadUrl}`,
      `所需权限：${permissionList}`,
      '此插件来自第三方，请确认来源可信',
    ].join('\n'),
    {
      title: '安装第三方插件',
      kind: 'warning',
    },
  );
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
