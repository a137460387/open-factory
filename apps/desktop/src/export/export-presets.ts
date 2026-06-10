import type { ExportSettings } from '@open-factory/editor-core';
import { fsExists, getAppDataDir, readFile, writeFile } from '../lib/tauri-bridge';

export type ExportPresetSettings = Partial<Omit<ExportSettings, 'outputPath'>>;

export interface ExportPreset {
  id: string;
  name: string;
  description: string;
  builtin: boolean;
  settings: ExportPresetSettings;
}

export interface StoredExportPresetsFile {
  schemaVersion: 1;
  presets: Array<Omit<ExportPreset, 'builtin'>>;
}

export interface ExportPresetStorage {
  getAppDataDir(): Promise<string> | string;
  fsExists(path: string): Promise<boolean> | boolean;
  readFile(path: string): Promise<string> | string;
  writeFile(path: string, contents: string): Promise<void> | void;
}

const PRESETS_FILE_NAME = 'presets.json';

export const BUILTIN_EXPORT_PRESETS: ExportPreset[] = [
  {
    id: 'web-1080p',
    name: 'Web 1080p',
    description: 'Full HD MP4 for local review and web sharing.',
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
      scaleMode: 'none'
    }
  },
  {
    id: '4k',
    name: '4K',
    description: 'UHD MP4 export for high-resolution delivery.',
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
      scaleMode: 'none'
    }
  },
  {
    id: 'youtube-shorts',
    name: 'YouTube Shorts',
    description: '9:16 vertical MP4 with fit-and-pad scaling.',
    builtin: true,
    settings: {
      width: 1080,
      height: 1920,
      fps: 30,
      videoCodec: 'libx264',
      audioCodec: 'aac',
      videoBitrate: '10M',
      audioBitrate: '192k',
      format: 'mp4',
      outputMode: 'video',
      scaleMode: 'fit'
    }
  },
  {
    id: 'twitter-x',
    name: 'Twitter/X',
    description: 'Compact MP4 tuned for social previews.',
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
      scaleMode: 'fit'
    }
  },
  {
    id: 'audio-m4a',
    name: 'Audio-only m4a',
    description: 'AAC audio export with no video stream.',
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
    throw new Error('Preset name is required.');
  }
  const customs = await loadCustomExportPresets(storage);
  const nextPreset: ExportPreset = {
    id: createCustomPresetId(trimmedName),
    name: trimmedName,
    description: 'Custom export preset.',
    builtin: false,
    settings: sanitizeExportSettings(settings)
  };
  await writeCustomExportPresets([...customs, nextPreset], storage);
  return mergeExportPresets([...customs, nextPreset]);
}

export async function deleteCustomExportPreset(id: string, storage: ExportPresetStorage = bridgePresetStorage): Promise<ExportPreset[]> {
  if (isBuiltinExportPreset(id)) {
    throw new Error('Built-in export presets cannot be deleted.');
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
    .map((preset) => ({ ...preset, builtin: false, settings: sanitizeExportSettings(preset.settings) }));
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
          description: typeof preset.description === 'string' ? preset.description : 'Custom export preset.',
          builtin: false,
          settings: sanitizeExportSettings(preset.settings)
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
        settings: sanitizeExportSettings(preset.settings)
      }))
  };
  return `${JSON.stringify(payload, null, 2)}\n`;
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
  if (input.outputMode === 'video' || input.outputMode === 'audio') {
    output.outputMode = input.outputMode;
  }
  if (input.scaleMode === 'none' || input.scaleMode === 'fit') {
    output.scaleMode = input.scaleMode;
  }
  if (input.subtitleMode === 'burn-in' || input.subtitleMode === 'soft-sub') {
    output.subtitleMode = input.subtitleMode;
  }
  return output;
}

function copyNumber(input: Record<string, unknown>, output: ExportPresetSettings, key: 'width' | 'height' | 'fps' | 'sampleRate'): void {
  const value = input[key];
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    output[key] = value;
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

function createCustomPresetId(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32);
  return `custom-${Date.now().toString(36)}-${slug || 'preset'}`;
}
