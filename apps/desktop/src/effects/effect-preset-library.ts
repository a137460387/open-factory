import {
  filterEffectPresets,
  normalizeEffectPreset,
  parseEffectPresetJson,
  serializeEffectPresetFile,
  type EffectPreset,
  type EffectPresetFilters,
} from '@open-factory/editor-core';
import { fsExists, getAppDataDir, readFile, scanDirectory, writeFile } from '../lib/tauri-bridge';

export interface EffectPresetLibraryStorage {
  getAppDataDir(): Promise<string> | string;
  fsExists(path: string): Promise<boolean> | boolean;
  readFile(path: string): Promise<string> | string;
  writeFile(path: string, contents: string): Promise<void> | void;
  scanDirectory(path: string, depth?: number): Promise<string[]> | string[];
}

export interface EffectPresetCommunityCard {
  id: string;
  name: string;
  author: string;
  description?: string;
  tags: string[];
  thumbnail?: string;
  preset: EffectPreset;
}

interface EffectPresetCommunityFile {
  schemaVersion: 1;
  presets: EffectPresetCommunityCard[];
}

export interface EffectPresetCommunityLoadResult {
  cards: EffectPresetCommunityCard[];
  source: 'remote' | 'cache' | 'empty';
  warning?: string;
}

export interface EffectPresetCommunityLoadOptions {
  storage?: EffectPresetLibraryStorage;
  fetcher?: typeof fetch;
  url?: string;
}

const EFFECT_PRESET_DIR = 'effect-presets';
const COMMUNITY_CACHE_FILE = 'community.json';

const EFFECT_PRESET_COMMUNITY_URL =
  'https://gist.githubusercontent.com/open-factory/effect-preset-library/raw/effect-presets.json';

const bridgeEffectPresetStorage: EffectPresetLibraryStorage = {
  getAppDataDir,
  fsExists,
  readFile,
  writeFile,
  scanDirectory,
};

function getEffectPresetLibraryDir(appDataDir: string): string {
  return `${trimPathEnd(appDataDir)}/${EFFECT_PRESET_DIR}`;
}

export function getEffectPresetFilePath(appDataDir: string, presetId: string): string {
  return `${getEffectPresetLibraryDir(appDataDir)}/${sanitizeFileSegment(presetId)}.ofeffect.json`;
}

export function getEffectPresetCommunityCachePath(appDataDir: string): string {
  return `${getEffectPresetLibraryDir(appDataDir)}/${COMMUNITY_CACHE_FILE}`;
}

export async function loadLocalEffectPresets(
  storage: EffectPresetLibraryStorage = bridgeEffectPresetStorage,
): Promise<EffectPreset[]> {
  const appDataDir = await storage.getAppDataDir();
  const dir = getEffectPresetLibraryDir(appDataDir);
  const paths = await Promise.resolve(storage.scanDirectory(dir, 1)).catch(() => []);
  const presets: EffectPreset[] = [];
  for (const path of paths.filter((item) => item.endsWith('.ofeffect.json'))) {
    try {
      presets.push(parseEffectPresetJson(await storage.readFile(path)));
    } catch {
      continue;
    }
  }
  return presets.sort((left, right) => left.name.localeCompare(right.name) || left.id.localeCompare(right.id));
}

export async function saveLocalEffectPreset(
  preset: EffectPreset,
  storage: EffectPresetLibraryStorage = bridgeEffectPresetStorage,
): Promise<string> {
  const appDataDir = await storage.getAppDataDir();
  const normalized = normalizeEffectPreset(preset);
  const path = getEffectPresetFilePath(appDataDir, normalized.id);
  await storage.writeFile(path, serializeEffectPresetFile(normalized));
  return path;
}

export function parseEffectPresetCommunityJson(contents: string): EffectPresetCommunityCard[] {
  const parsed = JSON.parse(contents) as Partial<EffectPresetCommunityFile>;
  if (parsed.schemaVersion !== 1 || !Array.isArray(parsed.presets)) {
    throw new Error('Invalid effect preset community JSON.');
  }
  return parsed.presets.flatMap((card) => normalizeCommunityCard(card));
}

export function filterEffectPresetCommunityCards(
  cards: EffectPresetCommunityCard[],
  filters: EffectPresetFilters = {},
): EffectPresetCommunityCard[] {
  return filterEffectPresets(cards, filters);
}

export async function loadEffectPresetCommunityLibrary(
  options: EffectPresetCommunityLoadOptions = {},
): Promise<EffectPresetCommunityLoadResult> {
  const storage = options.storage ?? bridgeEffectPresetStorage;
  const cachePath = getEffectPresetCommunityCachePath(await storage.getAppDataDir());
  try {
    const response = await (options.fetcher ?? fetch)(options.url ?? EFFECT_PRESET_COMMUNITY_URL, {
      cache: 'no-store',
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const contents = await response.text();
    const cards = parseEffectPresetCommunityJson(contents);
    await storage.writeFile(cachePath, `${JSON.stringify({ schemaVersion: 1, presets: cards }, null, 2)}\n`);
    return { cards, source: 'remote' };
  } catch (error) {
    if (await storage.fsExists(cachePath)) {
      return {
        cards: parseEffectPresetCommunityJson(await storage.readFile(cachePath)),
        source: 'cache',
        warning: error instanceof Error ? error.message : 'Unable to load the effect preset library.',
      };
    }
    return {
      cards: [],
      source: 'empty',
      warning: error instanceof Error ? error.message : 'Unable to load the effect preset library.',
    };
  }
}

export async function installEffectPresetCommunityCard(
  card: EffectPresetCommunityCard,
  storage: EffectPresetLibraryStorage = bridgeEffectPresetStorage,
): Promise<string> {
  return saveLocalEffectPreset(card.preset, storage);
}

function normalizeCommunityCard(input: unknown): EffectPresetCommunityCard[] {
  if (!input || typeof input !== 'object') {
    return [];
  }
  const raw = input as Record<string, unknown>;
  try {
    const preset = normalizeEffectPreset(raw.preset);
    const id = normalizeText(raw.id, 96) || preset.id;
    const name = normalizeText(raw.name, 120) || preset.name;
    return [
      {
        id,
        name,
        author: normalizeText(raw.author, 120) || preset.author,
        description: normalizeText(raw.description, 400) || preset.description,
        tags: normalizeTags(raw.tags).length > 0 ? normalizeTags(raw.tags) : preset.tags,
        thumbnail: normalizeText(raw.thumbnail, 4000) || preset.thumbnail,
        preset,
      },
    ];
  } catch {
    return [];
  }
}

function normalizeTags(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return Array.from(new Set(value.map((tag) => normalizeText(tag, 40).toLowerCase()).filter(Boolean)));
}

function normalizeText(value: unknown, maxLength: number): string {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function trimPathEnd(path: string): string {
  return path.replace(/[\\/]+$/, '');
}

function sanitizeFileSegment(value: string): string {
  return (
    value
      .trim()
      .replace(/[^a-zA-Z0-9_-]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'effect-preset'
  );
}
