import { hasExportMasterProcessing, normalizeAudioVisualizationTheme, normalizeExportMasterProcessing, normalizeSubtitleLanguage, normalizeSubtitleLanguageList, type ExportSettings } from '@open-factory/editor-core';
import { zhCN } from '../i18n/strings';
import { fsExists, getAppDataDir, getWebdavText, putWebdavText, readFile, writeFile, type WebdavTextPutRequest, type WebdavTextRequest, type WebdavTextResult } from '../lib/tauri-bridge';

export type ExportPresetSettings = Partial<Omit<ExportSettings, 'outputPath'>>;

export interface ExportPreset {
  id: string;
  name: string;
  description: string;
  builtin: boolean;
  settings: ExportPresetSettings;
  updatedAt?: string;
}

export type ExportPresetImportConflictMode = 'overwrite' | 'rename' | 'skip';
export type ExportPresetSyncConflictResolution = 'merge' | 'keep-local' | 'keep-remote';

export interface StoredExportPresetsFile {
  schemaVersion: 1;
  presets: Array<Omit<ExportPreset, 'builtin'>>;
}

export interface ExportPresetPackagePreset {
  id?: string;
  name: string;
  description?: string;
  settings?: ExportPresetSettings;
  updatedAt?: string;
}

export interface ExportPresetPackageFile {
  version: 1;
  presets: ExportPresetPackagePreset[];
  exportedAt: string;
  creator?: string;
  ffmpegMetadataArgsTemplate?: string[];
}

export interface ExportPresetImportResult {
  presets: ExportPreset[];
  imported: number;
  skipped: number;
  renamed: number;
  overwritten: number;
}

export interface ExportPresetStorage {
  getAppDataDir(): Promise<string> | string;
  fsExists(path: string): Promise<boolean> | boolean;
  readFile(path: string): Promise<string> | string;
  writeFile(path: string, contents: string): Promise<void> | void;
}

export interface ExportPresetSyncConflict {
  name: string;
  localUpdatedAt: string;
  remoteUpdatedAt: string;
  newer: 'local' | 'remote' | 'same';
}

export interface ExportPresetSyncClient {
  getText(request: WebdavTextRequest): Promise<WebdavTextResult> | WebdavTextResult;
  putText(request: WebdavTextPutRequest): Promise<{ status: number }> | { status: number };
}

export interface ExportPresetSyncRequest {
  url: string;
  username?: string;
  password?: string;
  conflictResolution?: ExportPresetSyncConflictResolution;
}

export interface ExportPresetSyncResult {
  presets: ExportPreset[];
  conflicts: ExportPresetSyncConflict[];
  syncedAt: string;
  uploadedCount: number;
  importedCount: number;
  remoteWasMissing: boolean;
}

const PRESETS_FILE_NAME = 'presets.json';
export const EXPORT_PRESET_PACKAGE_EXTENSION = 'ofpreset.json';
export const OFFICIAL_EXPORT_PRESET_PACKAGE_URL = 'https://github.com/open-factory/open-factory/releases/latest/download/export-presets.ofpreset.json';

export const BUILTIN_EXPORT_PRESETS: ExportPreset[] = [
  {
    id: 'web-1080p',
    name: zhCN.exportPresets.builtins.web1080p.name,
    description: zhCN.exportPresets.builtins.web1080p.description,
    builtin: true,
    settings: {
      width: 1920,
      height: 1080,
      fps: 30,
      videoCodec: 'libx264',
      audioCodec: 'aac',
      videoBitrate: '8M',
      audioBitrate: '192k',
      format: 'mp4',
      outputMode: 'video',
      scaleMode: 'none',
      targetAspectRatio: 'source',
      reframeOffsetX: 0,
      reframeOffsetY: 0,
      hardwareEncoding: false
    }
  },
  {
    id: '4k',
    name: zhCN.exportPresets.builtins.fourK.name,
    description: zhCN.exportPresets.builtins.fourK.description,
    builtin: true,
    settings: {
      width: 3840,
      height: 2160,
      fps: 30,
      videoCodec: 'libx264',
      audioCodec: 'aac',
      videoBitrate: '35M',
      audioBitrate: '320k',
      format: 'mp4',
      outputMode: 'video',
      scaleMode: 'none',
      targetAspectRatio: 'source',
      reframeOffsetX: 0,
      reframeOffsetY: 0,
      hardwareEncoding: false
    }
  },
  {
    id: 'youtube-1080p',
    name: zhCN.exportPresets.builtins.youtube1080p.name,
    description: zhCN.exportPresets.builtins.youtube1080p.description,
    builtin: true,
    settings: {
      width: 1920,
      height: 1080,
      fps: 30,
      videoCodec: 'libx264',
      audioCodec: 'aac',
      videoBitrate: '8M',
      audioBitrate: '192k',
      format: 'mp4',
      outputMode: 'video',
      scaleMode: 'fit',
      targetAspectRatio: 'source',
      reframeOffsetX: 0,
      reframeOffsetY: 0,
      hardwareEncoding: false,
      platformPreset: 'youtube-1080p'
    }
  },
  {
    id: 'youtube-shorts',
    name: zhCN.exportPresets.builtins.youtubeShorts.name,
    description: zhCN.exportPresets.builtins.youtubeShorts.description,
    builtin: true,
    settings: {
      width: 1080,
      height: 1920,
      fps: 60,
      videoCodec: 'libx264',
      audioCodec: 'aac',
      videoBitrate: '8M',
      audioBitrate: '192k',
      format: 'mp4',
      outputMode: 'video',
      scaleMode: 'fit',
      targetAspectRatio: 'source',
      reframeOffsetX: 0,
      reframeOffsetY: 0,
      hardwareEncoding: false,
      platformPreset: 'youtube-shorts'
    }
  },
  {
    id: 'tiktok',
    name: zhCN.exportPresets.builtins.tiktok.name,
    description: zhCN.exportPresets.builtins.tiktok.description,
    builtin: true,
    settings: {
      width: 1080,
      height: 1920,
      fps: 60,
      videoCodec: 'libx264',
      audioCodec: 'aac',
      videoBitrate: '6M',
      audioBitrate: '192k',
      format: 'mp4',
      outputMode: 'video',
      scaleMode: 'fit',
      targetAspectRatio: 'source',
      reframeOffsetX: 0,
      reframeOffsetY: 0,
      hardwareEncoding: false,
      loudnessNormalization: 'youtube',
      platformPreset: 'tiktok'
    }
  },
  {
    id: 'instagram-reels',
    name: zhCN.exportPresets.builtins.instagramReels.name,
    description: zhCN.exportPresets.builtins.instagramReels.description,
    builtin: true,
    settings: {
      width: 1080,
      height: 1920,
      fps: 30,
      videoCodec: 'libx264',
      audioCodec: 'aac',
      videoBitrate: '3500k',
      audioBitrate: '128k',
      format: 'mp4',
      outputMode: 'video',
      scaleMode: 'fit',
      targetAspectRatio: 'source',
      reframeOffsetX: 0,
      reframeOffsetY: 0,
      hardwareEncoding: false,
      platformPreset: 'instagram-reels'
    }
  },
  {
    id: 'twitter-x',
    name: zhCN.exportPresets.builtins.twitterX.name,
    description: zhCN.exportPresets.builtins.twitterX.description,
    builtin: true,
    settings: {
      width: 1280,
      height: 720,
      fps: 30,
      videoCodec: 'libx264',
      audioCodec: 'aac',
      videoBitrate: '5M',
      audioBitrate: '128k',
      format: 'mp4',
      outputMode: 'video',
      scaleMode: 'fit',
      targetAspectRatio: 'source',
      reframeOffsetX: 0,
      reframeOffsetY: 0,
      hardwareEncoding: false,
      platformPreset: 'twitter-x'
    }
  },
  {
    id: 'bilibili',
    name: zhCN.exportPresets.builtins.bilibili.name,
    description: zhCN.exportPresets.builtins.bilibili.description,
    builtin: true,
    settings: {
      width: 1920,
      height: 1080,
      fps: 60,
      videoCodec: 'libx264',
      audioCodec: 'aac',
      videoBitrate: '10M',
      audioBitrate: '192k',
      format: 'mp4',
      outputMode: 'video',
      scaleMode: 'fit',
      targetAspectRatio: 'source',
      reframeOffsetX: 0,
      reframeOffsetY: 0,
      hardwareEncoding: false,
      platformPreset: 'bilibili',
      videoProfile: 'high'
    }
  },
  {
    id: 'gif-loop',
    name: zhCN.exportPresets.builtins.gif.name,
    description: zhCN.exportPresets.builtins.gif.description,
    builtin: true,
    settings: {
      width: 1080,
      height: 608,
      fps: 30,
      videoCodec: 'gif',
      audioCodec: 'aac',
      format: 'gif',
      outputMode: 'video',
      scaleMode: 'fit',
      targetAspectRatio: 'source',
      reframeOffsetX: 0,
      reframeOffsetY: 0,
      hardwareEncoding: false
    }
  },
  {
    id: 'webp-animated',
    name: zhCN.exportPresets.builtins.webp.name,
    description: zhCN.exportPresets.builtins.webp.description,
    builtin: true,
    settings: {
      width: 1280,
      height: 720,
      fps: 24,
      videoCodec: 'libwebp_anim',
      audioCodec: 'aac',
      format: 'webp',
      outputMode: 'video',
      scaleMode: 'fit',
      targetAspectRatio: 'source',
      reframeOffsetX: 0,
      reframeOffsetY: 0,
      hardwareEncoding: false
    }
  },
  {
    id: 'apng',
    name: zhCN.exportPresets.builtins.apng.name,
    description: zhCN.exportPresets.builtins.apng.description,
    builtin: true,
    settings: {
      width: 1280,
      height: 720,
      fps: 24,
      videoCodec: 'apng',
      audioCodec: 'aac',
      format: 'apng',
      outputMode: 'video',
      scaleMode: 'fit',
      targetAspectRatio: 'source',
      reframeOffsetX: 0,
      reframeOffsetY: 0,
      hardwareEncoding: false
    }
  },
  {
    id: 'audio-m4a',
    name: zhCN.exportPresets.builtins.audioM4a.name,
    description: zhCN.exportPresets.builtins.audioM4a.description,
    builtin: true,
    settings: {
      audioCodec: 'aac',
      audioBitrate: '192k',
      format: 'm4a',
      outputMode: 'audio'
    }
  }
];

const bridgePresetStorage: ExportPresetStorage = {
  getAppDataDir,
  fsExists,
  readFile,
  writeFile
};

const bridgeExportPresetSyncClient: ExportPresetSyncClient = {
  getText: getWebdavText,
  putText: putWebdavText
};

export function getExportPreset(id: string, presets: ExportPreset[] = BUILTIN_EXPORT_PRESETS): ExportPreset {
  return presets.find((preset) => preset.id === id) ?? presets[0] ?? BUILTIN_EXPORT_PRESETS[0];
}

export function isBuiltinExportPreset(id: string): boolean {
  return BUILTIN_EXPORT_PRESETS.some((preset) => preset.id === id);
}

export function getExportPresetsPath(appDataDir: string): string {
  return `${appDataDir.replace(/[\\/]+$/, '')}/${PRESETS_FILE_NAME}`;
}

export async function loadExportPresets(storage: ExportPresetStorage = bridgePresetStorage): Promise<ExportPreset[]> {
  const customPresets = await loadCustomExportPresets(storage);
  return mergeExportPresets(customPresets);
}

export async function saveCustomExportPreset(
  name: string,
  settings: ExportPresetSettings,
  storage: ExportPresetStorage = bridgePresetStorage
): Promise<ExportPreset[]> {
  const trimmedName = name.trim();
  if (!trimmedName) {
    throw new Error(zhCN.exportPresets.nameRequired);
  }
  const customs = await loadCustomExportPresets(storage);
  const nextPreset: ExportPreset = {
    id: createCustomPresetId(trimmedName),
    name: trimmedName,
    description: zhCN.exportPresets.customDescription,
    builtin: false,
    settings: sanitizeExportSettings(settings),
    updatedAt: new Date(Date.now()).toISOString()
  };
  await writeCustomExportPresets([...customs, nextPreset], storage);
  return mergeExportPresets([...customs, nextPreset]);
}

export async function deleteCustomExportPreset(id: string, storage: ExportPresetStorage = bridgePresetStorage): Promise<ExportPreset[]> {
  if (isBuiltinExportPreset(id)) {
    throw new Error(zhCN.exportPresets.cannotDeleteBuiltin);
  }
  const customs = await loadCustomExportPresets(storage);
  const remaining = customs.filter((preset) => preset.id !== id);
  await writeCustomExportPresets(remaining, storage);
  return mergeExportPresets(remaining);
}

export function mergeExportPresets(customPresets: ExportPreset[]): ExportPreset[] {
  const customIds = new Set(BUILTIN_EXPORT_PRESETS.map((preset) => preset.id));
  const sanitizedCustoms = customPresets
    .filter((preset) => !customIds.has(preset.id))
    .map((preset) => ({ ...preset, builtin: false, settings: sanitizeExportSettings(preset.settings), updatedAt: normalizeIsoString(preset.updatedAt) }));
  return [...BUILTIN_EXPORT_PRESETS, ...sanitizedCustoms];
}

export function parseStoredExportPresets(contents: string): ExportPreset[] {
  try {
    const parsed = JSON.parse(contents) as Partial<StoredExportPresetsFile>;
    if (parsed.schemaVersion !== 1 || !Array.isArray(parsed.presets)) {
      return [];
    }
    return parsed.presets.flatMap((preset) => {
      if (!preset || typeof preset.id !== 'string' || typeof preset.name !== 'string') {
        return [];
      }
      return [
        {
          id: preset.id,
          name: preset.name,
          description: typeof preset.description === 'string' ? preset.description : zhCN.exportPresets.customDescription,
          builtin: false,
          settings: sanitizeExportSettings(preset.settings),
          updatedAt: normalizeIsoString((preset as { updatedAt?: unknown }).updatedAt)
        }
      ];
    });
  } catch {
    return [];
  }
}

export function serializeCustomExportPresets(presets: ExportPreset[]): string {
  const payload: StoredExportPresetsFile = {
    schemaVersion: 1,
    presets: presets
      .filter((preset) => !preset.builtin)
      .map((preset) => ({
        id: preset.id,
        name: preset.name,
        description: preset.description,
        settings: sanitizeExportSettings(preset.settings),
        updatedAt: normalizeIsoString(preset.updatedAt)
      }))
  };
  return `${JSON.stringify(payload, null, 2)}\n`;
}

export function serializeExportPresetPackage(
  presets: ExportPreset[],
  options: { exportedAt?: string; creator?: string; ffmpegMetadataArgsTemplate?: string[] } = {}
): string {
  const payload: ExportPresetPackageFile = {
    version: 1,
    presets: presets.map((preset) => ({
      id: preset.id,
      name: preset.name,
      description: preset.description,
      settings: sanitizeExportSettings(preset.settings),
      updatedAt: normalizeIsoString(preset.updatedAt)
    })),
    exportedAt: options.exportedAt ?? new Date(Date.now()).toISOString()
  };
  if (options.creator?.trim()) {
    payload.creator = options.creator.trim();
  }
  const metadataTemplate = sanitizeFfmpegMetadataArgsTemplate(options.ffmpegMetadataArgsTemplate);
  if (metadataTemplate) {
    payload.ffmpegMetadataArgsTemplate = metadataTemplate;
  }
  return `${JSON.stringify(payload, null, 2)}\n`;
}

export function parseExportPresetPackage(contents: string): ExportPresetPackageFile {
  const parsed = JSON.parse(contents) as Partial<ExportPresetPackageFile>;
  if (parsed.version !== 1) {
    throw new Error(zhCN.exportPresets.packageUnsupportedVersion);
  }
  if (!Array.isArray(parsed.presets)) {
    throw new Error(zhCN.exportPresets.packageInvalid);
  }
  const presets = parsed.presets.flatMap((preset): ExportPresetPackagePreset[] => {
    if (!preset || typeof preset.name !== 'string' || !preset.name.trim()) {
      return [];
    }
    const normalizedPreset: ExportPresetPackagePreset = {
      id: typeof preset.id === 'string' && preset.id.trim() ? preset.id.trim() : undefined,
      name: preset.name.trim(),
      description: typeof preset.description === 'string' && preset.description.trim() ? preset.description.trim() : zhCN.exportPresets.customDescription,
      settings: sanitizeExportSettings(preset.settings)
    };
    const updatedAt = normalizeIsoString(preset.updatedAt);
    if (updatedAt) {
      normalizedPreset.updatedAt = updatedAt;
    }
    return [normalizedPreset];
  });
  if (presets.length === 0) {
    throw new Error(zhCN.exportPresets.packageInvalid);
  }
  return {
    version: 1,
    presets,
    exportedAt: typeof parsed.exportedAt === 'string' && parsed.exportedAt.trim() ? parsed.exportedAt.trim() : new Date(0).toISOString(),
    creator: typeof parsed.creator === 'string' && parsed.creator.trim() ? parsed.creator.trim() : undefined,
    ffmpegMetadataArgsTemplate: sanitizeFfmpegMetadataArgsTemplate(parsed.ffmpegMetadataArgsTemplate)
  };
}

export function applyExportPresetPackage(
  existingPresets: ExportPreset[],
  packageFile: ExportPresetPackageFile,
  conflictMode: ExportPresetImportConflictMode
): ExportPresetImportResult {
  let customPresets = existingPresets.filter((preset) => !preset.builtin).map((preset) => ({ ...preset, builtin: false as const, settings: sanitizeExportSettings(preset.settings), updatedAt: normalizeIsoString(preset.updatedAt) }));
  const builtinNames = new Set(BUILTIN_EXPORT_PRESETS.map((preset) => preset.name.toLowerCase()));
  const result = { imported: 0, skipped: 0, renamed: 0, overwritten: 0 };

  for (const preset of packageFile.presets) {
    const normalizedName = preset.name.trim();
    const existingCustomIndex = customPresets.findIndex((item) => item.name.toLowerCase() === normalizedName.toLowerCase());
    const conflictsWithBuiltin = builtinNames.has(normalizedName.toLowerCase());
    if (existingCustomIndex >= 0 || conflictsWithBuiltin) {
      if (conflictMode === 'skip') {
        result.skipped += 1;
        continue;
      }
      if (conflictMode === 'overwrite' && existingCustomIndex >= 0) {
        customPresets[existingCustomIndex] = {
          id: customPresets[existingCustomIndex].id,
          name: normalizedName,
          description: preset.description ?? zhCN.exportPresets.customDescription,
          builtin: false,
          settings: sanitizeExportSettings(preset.settings),
          updatedAt: preset.updatedAt
        };
        result.imported += 1;
        result.overwritten += 1;
        continue;
      }
    }
    const name = existingCustomIndex >= 0 || conflictsWithBuiltin ? nextImportedPresetName(normalizedName, [...BUILTIN_EXPORT_PRESETS, ...customPresets]) : normalizedName;
    if (name !== normalizedName) {
      result.renamed += 1;
    }
    customPresets = [
      ...customPresets,
      {
        id: uniqueImportedPresetId(preset.id, name, [...BUILTIN_EXPORT_PRESETS, ...customPresets]),
        name,
        description: preset.description ?? zhCN.exportPresets.customDescription,
        builtin: false,
        settings: sanitizeExportSettings(preset.settings),
        updatedAt: preset.updatedAt
      }
    ];
    result.imported += 1;
  }

  return {
    presets: mergeExportPresets(customPresets),
    ...result
  };
}

export async function importExportPresetPackage(
  contents: string,
  conflictMode: ExportPresetImportConflictMode,
  storage: ExportPresetStorage = bridgePresetStorage
): Promise<ExportPresetImportResult> {
  const packageFile = parseExportPresetPackage(contents);
  const existing = mergeExportPresets(await loadCustomExportPresets(storage));
  const result = applyExportPresetPackage(existing, packageFile, conflictMode);
  await writeCustomExportPresets(result.presets.filter((preset) => !preset.builtin), storage);
  return result;
}

export async function fetchOfficialExportPresetPackage(fetcher: typeof fetch = fetch): Promise<ExportPresetPackageFile | undefined> {
  try {
    const response = await fetcher(OFFICIAL_EXPORT_PRESET_PACKAGE_URL, { cache: 'no-store' });
    if (!response.ok) {
      return undefined;
    }
    return parseExportPresetPackage(await response.text());
  } catch {
    return undefined;
  }
}

export function detectExportPresetSyncConflicts(
  localPackage: ExportPresetPackageFile,
  remotePackage: ExportPresetPackageFile
): ExportPresetSyncConflict[] {
  const localByName = new Map(localPackage.presets.map((preset) => [preset.name.trim().toLowerCase(), preset]));
  return remotePackage.presets.flatMap((remotePreset) => {
    const localPreset = localByName.get(remotePreset.name.trim().toLowerCase());
    if (!localPreset || exportPresetPackagePresetsEqual(localPreset, remotePreset)) {
      return [];
    }
    const localUpdatedAt = getPackagePresetUpdatedAt(localPreset, localPackage.exportedAt);
    const remoteUpdatedAt = getPackagePresetUpdatedAt(remotePreset, remotePackage.exportedAt);
    const comparison = compareIsoTimestamps(localUpdatedAt, remoteUpdatedAt);
    return [
      {
        name: remotePreset.name,
        localUpdatedAt,
        remoteUpdatedAt,
        newer: comparison > 0 ? 'local' : comparison < 0 ? 'remote' : 'same'
      }
    ];
  });
}

export function mergeExportPresetPackages(
  localPackage: ExportPresetPackageFile,
  remotePackage: ExportPresetPackageFile,
  conflictResolution: ExportPresetSyncConflictResolution = 'merge',
  exportedAt: string = new Date(Date.now()).toISOString()
): ExportPresetPackageFile {
  const merged = new Map<string, ExportPresetPackagePreset>();
  for (const preset of localPackage.presets) {
    const sanitized = sanitizePackagePreset(preset, localPackage.exportedAt);
    merged.set(sanitized.name.trim().toLowerCase(), sanitized);
  }
  for (const remotePreset of remotePackage.presets) {
    const sanitizedRemote = sanitizePackagePreset(remotePreset, remotePackage.exportedAt);
    const key = sanitizedRemote.name.trim().toLowerCase();
    const localPreset = merged.get(key);
    if (!localPreset) {
      merged.set(key, sanitizedRemote);
      continue;
    }
    if (exportPresetPackagePresetsEqual(localPreset, sanitizedRemote)) {
      merged.set(key, selectNewerPackagePreset(localPreset, sanitizedRemote, localPackage.exportedAt, remotePackage.exportedAt));
      continue;
    }
    if (conflictResolution === 'keep-local') {
      continue;
    }
    if (conflictResolution === 'keep-remote') {
      merged.set(key, sanitizedRemote);
      continue;
    }
    merged.set(key, selectNewerPackagePreset(localPreset, sanitizedRemote, localPackage.exportedAt, remotePackage.exportedAt));
  }
  return {
    version: 1,
    presets: Array.from(merged.values()).sort((left, right) => left.name.localeCompare(right.name)),
    exportedAt
  };
}

export async function syncExportPresetsWithWebdav(
  request: ExportPresetSyncRequest,
  options: {
    storage?: ExportPresetStorage;
    client?: ExportPresetSyncClient;
    now?: () => Date;
  } = {}
): Promise<ExportPresetSyncResult> {
  const url = request.url.trim();
  if (!url) {
    throw new Error(zhCN.exportPresets.syncUrlMissing);
  }
  const storage = options.storage ?? bridgePresetStorage;
  const client = options.client ?? bridgeExportPresetSyncClient;
  const now = options.now ?? (() => new Date());
  const syncedAt = now().toISOString();
  const localCustomPresets = await loadCustomExportPresets(storage);
  const localPackage = buildExportPresetPackageFromCustomPresets(localCustomPresets, syncedAt);
  let remoteWasMissing = false;
  let remotePackage: ExportPresetPackageFile;

  try {
    const remote = await client.getText({
      url,
      username: request.username,
      password: request.password
    });
    remotePackage = parseExportPresetPackage(remote.contents);
  } catch {
    remoteWasMissing = true;
    remotePackage = {
      version: 1,
      presets: [],
      exportedAt: new Date(0).toISOString()
    };
  }

  const conflicts = detectExportPresetSyncConflicts(localPackage, remotePackage);
  const mergedPackage = mergeExportPresetPackages(localPackage, remotePackage, request.conflictResolution ?? 'merge', syncedAt);
  await client.putText({
    url,
    username: request.username,
    password: request.password,
    contents: `${JSON.stringify(mergedPackage, null, 2)}\n`,
    contentType: 'application/json'
  });
  const nextCustomPresets = exportPresetPackageToCustomPresets(mergedPackage, localCustomPresets);
  await writeCustomExportPresets(nextCustomPresets, storage);
  return {
    presets: mergeExportPresets(nextCustomPresets),
    conflicts,
    syncedAt,
    uploadedCount: mergedPackage.presets.length,
    importedCount: nextCustomPresets.filter((preset) => !localCustomPresets.some((localPreset) => presetNamesEqual(localPreset.name, preset.name))).length,
    remoteWasMissing
  };
}

async function loadCustomExportPresets(storage: ExportPresetStorage): Promise<ExportPreset[]> {
  const path = getExportPresetsPath(await storage.getAppDataDir());
  if (!(await storage.fsExists(path))) {
    return [];
  }
  return parseStoredExportPresets(await storage.readFile(path));
}

async function writeCustomExportPresets(presets: ExportPreset[], storage: ExportPresetStorage): Promise<void> {
  const path = getExportPresetsPath(await storage.getAppDataDir());
  await storage.writeFile(path, serializeCustomExportPresets(presets));
}

function buildExportPresetPackageFromCustomPresets(presets: ExportPreset[], exportedAt: string): ExportPresetPackageFile {
  return {
    version: 1,
    exportedAt,
    presets: presets
      .filter((preset) => !preset.builtin)
      .map((preset) => ({
        id: preset.id,
        name: preset.name,
        description: preset.description,
        settings: sanitizeExportSettings(preset.settings),
        updatedAt: normalizeIsoString(preset.updatedAt) ?? exportedAt
      }))
  };
}

function exportPresetPackageToCustomPresets(packageFile: ExportPresetPackageFile, existingCustomPresets: ExportPreset[]): ExportPreset[] {
  const builtinNames = new Set(BUILTIN_EXPORT_PRESETS.map((preset) => preset.name.toLowerCase()));
  const existingByName = new Map(existingCustomPresets.map((preset) => [preset.name.trim().toLowerCase(), preset]));
  const nextPresets: ExportPreset[] = [];
  for (const preset of packageFile.presets) {
    const name = preset.name.trim();
    if (!name || builtinNames.has(name.toLowerCase())) {
      continue;
    }
    const existing = existingByName.get(name.toLowerCase());
    const usedPresets = [...BUILTIN_EXPORT_PRESETS, ...existingCustomPresets, ...nextPresets];
    nextPresets.push({
      id: existing?.id ?? uniqueImportedPresetId(preset.id, name, usedPresets),
      name,
      description: preset.description ?? zhCN.exportPresets.customDescription,
      builtin: false,
      settings: sanitizeExportSettings(preset.settings),
      updatedAt: getPackagePresetUpdatedAt(preset, packageFile.exportedAt)
    });
  }
  return nextPresets;
}

function sanitizePackagePreset(preset: ExportPresetPackagePreset, fallbackUpdatedAt: string): ExportPresetPackagePreset {
  return {
    id: typeof preset.id === 'string' && preset.id.trim() ? preset.id.trim() : undefined,
    name: preset.name.trim(),
    description: preset.description?.trim() || zhCN.exportPresets.customDescription,
    settings: sanitizeExportSettings(preset.settings),
    updatedAt: normalizeIsoString(preset.updatedAt) ?? fallbackUpdatedAt
  };
}

function selectNewerPackagePreset(
  localPreset: ExportPresetPackagePreset,
  remotePreset: ExportPresetPackagePreset,
  localExportedAt: string,
  remoteExportedAt: string
): ExportPresetPackagePreset {
  const comparison = compareIsoTimestamps(getPackagePresetUpdatedAt(localPreset, localExportedAt), getPackagePresetUpdatedAt(remotePreset, remoteExportedAt));
  return comparison >= 0 ? localPreset : remotePreset;
}

function exportPresetPackagePresetsEqual(left: ExportPresetPackagePreset, right: ExportPresetPackagePreset): boolean {
  return (
    left.name.trim().toLowerCase() === right.name.trim().toLowerCase() &&
    (left.description ?? zhCN.exportPresets.customDescription) === (right.description ?? zhCN.exportPresets.customDescription) &&
    stableStringify(sanitizeExportSettings(left.settings)) === stableStringify(sanitizeExportSettings(right.settings))
  );
}

function getPackagePresetUpdatedAt(preset: ExportPresetPackagePreset, fallback: string): string {
  return normalizeIsoString(preset.updatedAt) ?? normalizeIsoString(fallback) ?? new Date(0).toISOString();
}

function compareIsoTimestamps(left: string, right: string): number {
  const leftTime = new Date(left).getTime();
  const rightTime = new Date(right).getTime();
  const safeLeft = Number.isFinite(leftTime) ? leftTime : 0;
  const safeRight = Number.isFinite(rightTime) ? rightTime : 0;
  return safeLeft === safeRight ? 0 : safeLeft > safeRight ? 1 : -1;
}

function presetNamesEqual(left: string, right: string): boolean {
  return left.trim().toLowerCase() === right.trim().toLowerCase();
}

function normalizeIsoString(value: unknown): string | undefined {
  if (typeof value !== 'string' || !value.trim()) {
    return undefined;
  }
  const date = new Date(value.trim());
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableStringify(entry)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function sanitizeExportSettings(settings: unknown): ExportPresetSettings {
  if (!settings || typeof settings !== 'object') {
    return {};
  }
  const input = settings as Record<string, unknown>;
  const output: ExportPresetSettings = {};
  copyNumber(input, output, 'width');
  copyNumber(input, output, 'height');
  copyNumber(input, output, 'fps');
  copyNumber(input, output, 'sampleRate');
  copyString(input, output, 'videoCodec');
  copyString(input, output, 'audioCodec');
  copyString(input, output, 'format');
  copyOptionalString(input, output, 'videoBitrate');
  copyOptionalString(input, output, 'audioBitrate');
  if (input.outputMode === 'video' || input.outputMode === 'audio' || input.outputMode === 'audio-visualization') {
    output.outputMode = input.outputMode;
  }
  if (input.scaleMode === 'none' || input.scaleMode === 'fit') {
    output.scaleMode = input.scaleMode;
  }
  if (input.targetAspectRatio === 'source' || input.targetAspectRatio === '16:9' || input.targetAspectRatio === '9:16' || input.targetAspectRatio === '1:1' || input.targetAspectRatio === '4:5' || input.targetAspectRatio === '21:9') {
    output.targetAspectRatio = input.targetAspectRatio;
  }
  copyReframeOffset(input, output, 'reframeOffsetX');
  copyReframeOffset(input, output, 'reframeOffsetY');
  if (input.subtitleMode === 'burn-in' || input.subtitleMode === 'soft-sub') {
    output.subtitleMode = input.subtitleMode;
  }
  if (input.subtitleFormat === 'srt' || input.subtitleFormat === 'vtt' || input.subtitleFormat === 'ass' || input.subtitleFormat === 'ssa') {
    output.subtitleFormat = input.subtitleFormat;
  }
  if (input.exportSidecarSubtitle === true) {
    output.exportSidecarSubtitle = true;
  }
  const subtitleLanguages = normalizeSubtitleLanguageList(input.subtitleLanguages);
  if (subtitleLanguages) {
    output.subtitleLanguages = subtitleLanguages;
  }
  if (typeof input.subtitleBurnInLanguage === 'string') {
    output.subtitleBurnInLanguage = normalizeSubtitleLanguage(input.subtitleBurnInLanguage);
  }
  if (input.hardwareEncoding === true) {
    output.hardwareEncoding = true;
  }
  if (input.loudnessNormalization === 'off' || input.loudnessNormalization === 'youtube' || input.loudnessNormalization === 'ebu-r128') {
    output.loudnessNormalization = input.loudnessNormalization;
  }
  if (
    input.platformPreset === 'youtube-1080p' ||
    input.platformPreset === 'youtube-shorts' ||
    input.platformPreset === 'tiktok' ||
    input.platformPreset === 'instagram-reels' ||
    input.platformPreset === 'twitter-x' ||
    input.platformPreset === 'bilibili'
  ) {
    output.platformPreset = input.platformPreset;
  }
  if (input.videoProfile === 'baseline' || input.videoProfile === 'main' || input.videoProfile === 'high') {
    output.videoProfile = input.videoProfile;
  }
  const watermark = sanitizeWatermark(input.watermark);
  if (watermark) {
    output.watermark = watermark;
  }
  const timecodeBurnIn = sanitizeTimecodeBurnIn(input.timecodeBurnIn);
  if (timecodeBurnIn) {
    output.timecodeBurnIn = timecodeBurnIn;
  }
  if (sanitizeSlate(input.slate)) {
    output.slate = { enabled: true };
  }
  const colorManagement = sanitizeColorManagement(input.colorManagement);
  if (colorManagement) {
    output.colorManagement = colorManagement;
  }
  const postExportScript = sanitizePostExportScript(input.postExportScript);
  if (postExportScript) {
    output.postExportScript = postExportScript;
  }
  const audioVisualization = sanitizeAudioVisualization(input.audioVisualization);
  if (audioVisualization) {
    output.audioVisualization = audioVisualization;
  }
  const masterProcessing = sanitizeMasterProcessing(input.masterProcessing);
  if (masterProcessing && hasExportMasterProcessing(masterProcessing)) {
    output.masterProcessing = masterProcessing;
  }
  return output;
}

function sanitizeMasterProcessing(value: unknown): ExportPresetSettings['masterProcessing'] | undefined {
  if (!value || typeof value !== 'object') {
    return undefined;
  }
  return normalizeExportMasterProcessing(value as ExportPresetSettings['masterProcessing']);
}

function sanitizeColorManagement(value: unknown): ExportPresetSettings['colorManagement'] | undefined {
  if (!value || typeof value !== 'object') {
    return undefined;
  }
  const input = value as Record<string, unknown>;
  return {
    inputColorSpace: sanitizeExportColorSpace(input.inputColorSpace, 'srgb'),
    outputColorSpace: sanitizeExportColorSpace(input.outputColorSpace, 'srgb'),
    embedIccProfile: input.embedIccProfile !== false
  };
}

function sanitizePostExportScript(value: unknown): ExportPresetSettings['postExportScript'] | undefined {
  if (!value || typeof value !== 'object') {
    return undefined;
  }
  const command = (value as Record<string, unknown>).command;
  if (typeof command !== 'string') {
    return undefined;
  }
  const trimmed = command.trim();
  return trimmed ? { command: trimmed } : undefined;
}

function sanitizeExportColorSpace(value: unknown, fallback: NonNullable<ExportPresetSettings['colorManagement']>['inputColorSpace']): NonNullable<ExportPresetSettings['colorManagement']>['inputColorSpace'] {
  return value === 'srgb' || value === 'rec709' || value === 'dci-p3' || value === 'display-p3' || value === 'rec2020' ? value : fallback;
}

function sanitizeAudioVisualization(value: unknown): ExportPresetSettings['audioVisualization'] | undefined {
  if (!value || typeof value !== 'object') {
    return undefined;
  }
  const input = value as Record<string, unknown>;
  const style =
    input.style === 'spectrum-bars' || input.style === 'circular-spectrum' || input.style === 'waveform-line'
      ? input.style
      : 'waveform-line';
  const color = sanitizeHexColor(input.color, '#22d3ee');
  const background = sanitizeAudioVisualizationBackground(input.background);
  const output: NonNullable<ExportPresetSettings['audioVisualization']> = { style, color, background };
  if (typeof input.themeId === 'string' && input.themeId.trim()) {
    output.themeId = input.themeId.trim();
  }
  if (input.theme && typeof input.theme === 'object') {
    output.theme = normalizeAudioVisualizationTheme(input.theme);
  }
  return output;
}

function sanitizeAudioVisualizationBackground(value: unknown): NonNullable<ExportPresetSettings['audioVisualization']>['background'] {
  if (!value || typeof value !== 'object') {
    return { type: 'solid', color: '#050816' };
  }
  const input = value as Record<string, unknown>;
  if (input.type === 'image' && typeof input.path === 'string' && input.path.trim()) {
    return { type: 'image', path: input.path.trim() };
  }
  if (input.type === 'gradient') {
    return {
      type: 'gradient',
      color: sanitizeHexColor(input.color, '#050816'),
      color2: sanitizeHexColor(input.color2, '#1d4ed8')
    };
  }
  return { type: 'solid', color: sanitizeHexColor(input.color, '#050816') };
}

function sanitizeWatermark(value: unknown): ExportPresetSettings['watermark'] | undefined {
  if (!value || typeof value !== 'object') {
    return undefined;
  }
  const input = value as Record<string, unknown>;
  const position = sanitizeWatermarkPosition(input.position);
  if (input.enabled !== true) {
    return undefined;
  }
  if (input.type === 'image') {
    const path = typeof input.path === 'string' ? input.path.trim() : '';
    if (!path) {
      return undefined;
    }
    return {
      enabled: true,
      type: 'image',
      path,
      position,
      scalePercent: clampWatermarkNumber(input.scalePercent, 1, 50, 12),
      opacity: clampWatermarkNumber(input.opacity, 0, 1, 0.75)
    };
  }
  if (input.type === 'text') {
    const text = typeof input.text === 'string' ? input.text.trim() : '';
    if (!text) {
      return undefined;
    }
    return {
      enabled: true,
      type: 'text',
      text,
      fontFamily: typeof input.fontFamily === 'string' && input.fontFamily.trim() ? input.fontFamily.trim() : 'Arial',
      color: typeof input.color === 'string' && input.color.trim() ? input.color.trim() : '#ffffff',
      fontSize: Math.round(clampWatermarkNumber(input.fontSize, 8, 240, 36)),
      position
    };
  }
  return undefined;
}

function sanitizeTimecodeBurnIn(value: unknown): ExportPresetSettings['timecodeBurnIn'] | undefined {
  if (!value || typeof value !== 'object') {
    return undefined;
  }
  const input = value as Record<string, unknown>;
  if (input.enabled !== true) {
    return undefined;
  }
  return {
    enabled: true,
    position: sanitizeWatermarkPosition(input.position),
    fontSize: Math.round(clampWatermarkNumber(input.fontSize, 8, 96, 28)),
    color: sanitizeHexColor(input.color, '#ffffff'),
    backgroundColor: sanitizeHexColor(input.backgroundColor, '#000000'),
    includeFrameNumber: input.includeFrameNumber === true
  };
}

function sanitizeSlate(value: unknown): boolean {
  return Boolean(value && typeof value === 'object' && (value as Record<string, unknown>).enabled === true);
}

function sanitizeWatermarkPosition(value: unknown): NonNullable<ExportPresetSettings['watermark']>['position'] {
  return value === 'top-left' ||
    value === 'top-center' ||
    value === 'top-right' ||
    value === 'middle-left' ||
    value === 'center' ||
    value === 'middle-right' ||
    value === 'bottom-left' ||
    value === 'bottom-center' ||
    value === 'bottom-right'
    ? value
    : 'bottom-right';
}

function clampWatermarkNumber(value: unknown, min: number, max: number, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
}

function sanitizeHexColor(value: unknown, fallback: string): string {
  if (typeof value !== 'string') {
    return fallback;
  }
  const normalized = value.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(normalized)) {
    return normalized.toLowerCase();
  }
  if (/^#[0-9a-fA-F]{3}$/.test(normalized)) {
    return `#${normalized[1]}${normalized[1]}${normalized[2]}${normalized[2]}${normalized[3]}${normalized[3]}`.toLowerCase();
  }
  return fallback;
}

function copyNumber(input: Record<string, unknown>, output: ExportPresetSettings, key: 'width' | 'height' | 'fps' | 'sampleRate'): void {
  const value = input[key];
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    output[key] = value;
  }
}

function copyReframeOffset(input: Record<string, unknown>, output: ExportPresetSettings, key: 'reframeOffsetX' | 'reframeOffsetY'): void {
  const value = input[key];
  if (typeof value === 'number' && Number.isFinite(value)) {
    output[key] = Math.min(1, Math.max(-1, value));
  }
}

function copyString(input: Record<string, unknown>, output: ExportPresetSettings, key: 'videoCodec' | 'audioCodec' | 'format'): void {
  const value = input[key];
  if (typeof value === 'string' && value.trim()) {
    output[key] = value.trim();
  }
}

function copyOptionalString(input: Record<string, unknown>, output: ExportPresetSettings, key: 'videoBitrate' | 'audioBitrate'): void {
  const value = input[key];
  if (typeof value === 'string') {
    output[key] = value.trim() || null;
  } else if (value === null) {
    output[key] = null;
  }
}

function sanitizeFfmpegMetadataArgsTemplate(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const args = value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 32);
  return args.length > 0 ? args : undefined;
}

function nextImportedPresetName(name: string, presets: ExportPreset[]): string {
  const used = new Set(presets.map((preset) => preset.name.toLowerCase()));
  let index = 2;
  let candidate = `${name} ${zhCN.exportPresets.importedCopySuffix}`;
  while (used.has(candidate.toLowerCase())) {
    candidate = `${name} ${zhCN.exportPresets.importedCopySuffix} ${index}`;
    index += 1;
  }
  return candidate;
}

function uniqueImportedPresetId(id: string | undefined, name: string, presets: ExportPreset[]): string {
  const used = new Set(presets.map((preset) => preset.id));
  if (id && id.trim() && !used.has(id.trim()) && !isBuiltinExportPreset(id.trim())) {
    return id.trim();
  }
  let candidate = createCustomPresetId(name);
  while (used.has(candidate)) {
    candidate = createCustomPresetId(`${name}-${Math.random().toString(36).slice(2, 6)}`);
  }
  return candidate;
}

function createCustomPresetId(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32);
  return `custom-${Date.now().toString(36)}-${slug || 'preset'}`;
}
