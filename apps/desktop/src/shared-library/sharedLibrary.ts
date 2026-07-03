import {
  normalizeSubtitleStyleTemplateStyle,
  type SubtitleStyleTemplate,
  type TimelineTemplateDefinition
} from '@open-factory/editor-core';
import {
  createSharedLibraryArchive,
  fsExists,
  getAppDataDir,
  importSharedLibraryArchive,
  readFile,
  writeFile,
  type SharedLibraryArchiveFileEntry,
  type SharedLibraryArchiveResult,
  type SharedLibraryImportResult
} from '../lib/tauri-bridge';

type SharedLibraryResourceType = 'export-preset' | 'subtitle-style' | 'macro' | 'title-template' | 'timeline-template' | 'lut' | 'workspace-layout' | 'custom-layout';
export type SharedLibraryConflictMode = 'overwrite' | 'keep-both';

export interface SharedLibraryResource<TPayload = unknown> {
  id: string;
  type: SharedLibraryResourceType;
  name: string;
  version: number;
  updatedAt: string;
  payload?: TPayload;
  filePath?: string;
}

interface SharedLibraryIndexFile {
  schemaVersion: 1;
  resources: SharedLibraryResource[];
}

export interface SharedLibraryStorage {
  getAppDataDir(): Promise<string> | string;
  fsExists(path: string): Promise<boolean> | boolean;
  readFile(path: string): Promise<string> | string;
  writeFile(path: string, contents: string): Promise<void> | void;
}

export interface SharedLibraryArchiveClient {
  createSharedLibraryArchive(request: { outputPath: string; manifestContents: string; files: SharedLibraryArchiveFileEntry[] }): Promise<SharedLibraryArchiveResult> | SharedLibraryArchiveResult;
  importSharedLibraryArchive(request: { archivePath: string; destinationDir: string }): Promise<SharedLibraryImportResult> | SharedLibraryImportResult;
}

export interface SharedLibraryUpsertResult {
  resources: SharedLibraryResource[];
  resource: SharedLibraryResource;
  action: 'created' | 'overwritten' | 'kept-both';
}

const SHARED_LIBRARY_DIR = 'shared-library';
const SHARED_LIBRARY_INDEX = 'index.json';

const bridgeStorage: SharedLibraryStorage = {
  getAppDataDir,
  fsExists,
  readFile,
  writeFile
};

const bridgeArchiveClient: SharedLibraryArchiveClient = {
  createSharedLibraryArchive,
  importSharedLibraryArchive
};

export function getSharedLibraryDir(appDataDir: string): string {
  return `${appDataDir.replace(/[\\/]+$/, '')}/${SHARED_LIBRARY_DIR}`;
}

export function getSharedLibraryIndexPath(appDataDir: string): string {
  return `${getSharedLibraryDir(appDataDir)}/${SHARED_LIBRARY_INDEX}`;
}

export async function loadSharedLibrary(storage: SharedLibraryStorage = bridgeStorage): Promise<SharedLibraryResource[]> {
  const path = getSharedLibraryIndexPath(await storage.getAppDataDir());
  if (!(await storage.fsExists(path))) {
    return [];
  }
  return parseSharedLibraryIndex(await storage.readFile(path));
}

async function saveSharedLibrary(resources: SharedLibraryResource[], storage: SharedLibraryStorage = bridgeStorage): Promise<void> {
  const path = getSharedLibraryIndexPath(await storage.getAppDataDir());
  await storage.writeFile(path, serializeSharedLibraryIndex(resources));
}

export async function addSharedLibraryResource(
  resource: Omit<SharedLibraryResource, 'version' | 'updatedAt'> & Partial<Pick<SharedLibraryResource, 'version' | 'updatedAt'>>,
  conflictMode: SharedLibraryConflictMode = 'overwrite',
  storage: SharedLibraryStorage = bridgeStorage
): Promise<SharedLibraryUpsertResult> {
  const current = await loadSharedLibrary(storage);
  const result = upsertSharedLibraryResource(current, resource, conflictMode);
  await saveSharedLibrary(result.resources, storage);
  return result;
}

export function upsertSharedLibraryResource(
  resources: SharedLibraryResource[],
  resource: Omit<SharedLibraryResource, 'version' | 'updatedAt'> & Partial<Pick<SharedLibraryResource, 'version' | 'updatedAt'>>,
  conflictMode: SharedLibraryConflictMode = 'overwrite',
  now = new Date(Date.now()).toISOString()
): SharedLibraryUpsertResult {
  const normalized = normalizeIncomingResource(resource, now);
  const conflictIndex = resources.findIndex((item) => item.type === normalized.type && item.name.trim().toLowerCase() === normalized.name.trim().toLowerCase());
  if (conflictIndex < 0) {
    return { resources: [...resources, normalized], resource: normalized, action: 'created' };
  }
  const existing = resources[conflictIndex];
  if (conflictMode === 'keep-both') {
    const kept: SharedLibraryResource = {
      ...normalized,
      id: uniqueSharedResourceId(normalized.id, resources),
      version: existing.version + 1,
      updatedAt: now
    };
    return { resources: [...resources, kept], resource: kept, action: 'kept-both' };
  }
  const overwritten: SharedLibraryResource = {
    ...normalized,
    id: existing.id,
    version: existing.version + 1,
    updatedAt: now
  };
  return {
    resources: resources.map((item, index) => (index === conflictIndex ? overwritten : item)),
    resource: overwritten,
    action: 'overwritten'
  };
}

export async function removeSharedLibraryResource(resourceId: string, storage: SharedLibraryStorage = bridgeStorage): Promise<SharedLibraryResource[]> {
  const next = (await loadSharedLibrary(storage)).filter((resource) => resource.id !== resourceId);
  await saveSharedLibrary(next, storage);
  return next;
}

export function parseSharedLibraryIndex(contents: string): SharedLibraryResource[] {
  try {
    const parsed = JSON.parse(contents) as Partial<SharedLibraryIndexFile>;
    if (parsed.schemaVersion !== 1 || !Array.isArray(parsed.resources)) {
      return [];
    }
    return parsed.resources.flatMap((resource) => normalizeStoredResource(resource));
  } catch {
    return [];
  }
}

export function serializeSharedLibraryIndex(resources: SharedLibraryResource[]): string {
  const payload: SharedLibraryIndexFile = {
    schemaVersion: 1,
    resources: resources.flatMap((resource) => normalizeStoredResource(resource))
  };
  return `${JSON.stringify(payload, null, 2)}\n`;
}

export function subtitleStyleTemplateToSharedResource(template: SubtitleStyleTemplate): Omit<SharedLibraryResource, 'version' | 'updatedAt'> {
  return {
    id: `shared-subtitle-${sanitizeId(template.id)}`,
    type: 'subtitle-style',
    name: template.name,
    payload: {
      id: template.id,
      name: template.name,
      style: normalizeSubtitleStyleTemplateStyle(template.style)
    }
  };
}

export function sharedResourceToSubtitleStyleTemplate(resource: SharedLibraryResource): SubtitleStyleTemplate | undefined {
  if (resource.type !== 'subtitle-style' || !resource.payload || typeof resource.payload !== 'object') {
    return undefined;
  }
  const payload = resource.payload as { id?: unknown; name?: unknown; style?: unknown };
  if (typeof payload.name !== 'string' || !payload.name.trim()) {
    return undefined;
  }
  return {
    id: typeof payload.id === 'string' && payload.id.trim() ? `shared-${payload.id.trim()}` : resource.id,
    kind: 'custom',
    name: payload.name.trim(),
    style: normalizeSubtitleStyleTemplateStyle((payload.style ?? {}) as Parameters<typeof normalizeSubtitleStyleTemplateStyle>[0])
  };
}

export async function loadSharedSubtitleStyleTemplates(storage: SharedLibraryStorage = bridgeStorage): Promise<SubtitleStyleTemplate[]> {
  return (await loadSharedLibrary(storage)).flatMap((resource) => {
    const template = sharedResourceToSubtitleStyleTemplate(resource);
    return template ? [template] : [];
  });
}

function timelineTemplateToSharedResource(template: TimelineTemplateDefinition): Omit<SharedLibraryResource, 'version' | 'updatedAt'> {
  return {
    id: `shared-timeline-${sanitizeId(template.id)}`,
    type: 'timeline-template',
    name: template.name,
    payload: template
  };
}

export async function exportSharedLibrary(
  outputPath: string,
  storage: SharedLibraryStorage = bridgeStorage,
  archiveClient: SharedLibraryArchiveClient = bridgeArchiveClient
): Promise<SharedLibraryArchiveResult> {
  const resources = await loadSharedLibrary(storage);
  const files = resources
    .filter((resource) => resource.filePath)
    .map((resource): SharedLibraryArchiveFileEntry => ({ sourcePath: resource.filePath!, archivePath: `files/${sanitizeId(resource.id)}-${fileName(resource.filePath!)}` }));
  return archiveClient.createSharedLibraryArchive({
    outputPath,
    manifestContents: serializeSharedLibraryIndex(resources),
    files
  });
}

export async function importSharedLibrary(
  archivePath: string,
  conflictMode: SharedLibraryConflictMode = 'keep-both',
  storage: SharedLibraryStorage = bridgeStorage,
  archiveClient: SharedLibraryArchiveClient = bridgeArchiveClient
): Promise<SharedLibraryUpsertResult[]> {
  const destinationDir = getSharedLibraryDir(await storage.getAppDataDir());
  const imported = await archiveClient.importSharedLibraryArchive({ archivePath, destinationDir });
  const resources = parseSharedLibraryIndex(imported.manifestContents);
  const results: SharedLibraryUpsertResult[] = [];
  let current = await loadSharedLibrary(storage);
  for (const resource of resources) {
    const result = upsertSharedLibraryResource(current, resource, conflictMode);
    current = result.resources;
    results.push(result);
  }
  await saveSharedLibrary(current, storage);
  return results;
}

function normalizeIncomingResource(
  resource: Omit<SharedLibraryResource, 'version' | 'updatedAt'> & Partial<Pick<SharedLibraryResource, 'version' | 'updatedAt'>>,
  now: string
): SharedLibraryResource {
  const name = resource.name.trim();
  return {
    id: resource.id.trim() || `shared-${sanitizeId(resource.type)}-${sanitizeId(name)}`,
    type: resource.type,
    name: name || 'Shared Resource',
    version: Math.max(1, Math.floor(resource.version ?? 1)),
    updatedAt: normalizeIso(resource.updatedAt) ?? now,
    payload: resource.payload,
    filePath: resource.filePath?.trim() || undefined
  };
}

function normalizeStoredResource(value: unknown): SharedLibraryResource[] {
  if (!value || typeof value !== 'object') {
    return [];
  }
  const resource = value as Partial<SharedLibraryResource>;
  if (!resource.id || !resource.name || !isSharedLibraryResourceType(resource.type)) {
    return [];
  }
  return [
    {
      id: resource.id,
      type: resource.type,
      name: resource.name.trim() || 'Shared Resource',
      version: Math.max(1, Math.floor(Number(resource.version) || 1)),
      updatedAt: normalizeIso(resource.updatedAt) ?? new Date(0).toISOString(),
      payload: resource.payload,
      filePath: resource.filePath?.trim() || undefined
    }
  ];
}

function isSharedLibraryResourceType(value: unknown): value is SharedLibraryResourceType {
  return (
    value === 'export-preset' ||
    value === 'subtitle-style' ||
    value === 'macro' ||
    value === 'title-template' ||
    value === 'timeline-template' ||
    value === 'lut' ||
    value === 'workspace-layout' ||
    value === 'custom-layout'
  );
}

function uniqueSharedResourceId(id: string, resources: SharedLibraryResource[]): string {
  const used = new Set(resources.map((resource) => resource.id));
  if (!used.has(id)) {
    return id;
  }
  let index = 2;
  while (used.has(`${id}-${index}`)) {
    index += 1;
  }
  return `${id}-${index}`;
}

function fileName(path: string): string {
  return path.split(/[\\/]/).filter(Boolean).at(-1) ?? 'resource.bin';
}

function sanitizeId(value: string): string {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 64) || 'resource'
  );
}

function normalizeIso(value: unknown): string | undefined {
  if (typeof value !== 'string' || !value.trim()) {
    return undefined;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}
