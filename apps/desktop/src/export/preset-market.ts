import { zhCN } from '../i18n/strings';
import { fsExists, getAppDataDir, readFile, writeFile } from '../lib/tauri-bridge';
import {
  importExportPresetPackage,
  type ExportPreset,
  type ExportPresetImportConflictMode,
  type ExportPresetImportResult,
  type ExportPresetPackageFile,
  type ExportPresetPackagePreset,
  type ExportPresetStorage,
} from './export-presets';

type PresetMarketFilterValue = 'all' | string;

export interface PresetMarketFilters {
  platform?: PresetMarketFilterValue;
  quality?: PresetMarketFilterValue;
  format?: PresetMarketFilterValue;
}

export interface PresetMarketCard {
  id: string;
  name: string;
  author: string;
  description: string;
  tags: string[];
  downloads: number;
  rating: number;
  preset: ExportPresetPackagePreset;
}

interface PresetMarketFile {
  schemaVersion: 1;
  presets: PresetMarketCard[];
}

interface PresetMarketRatingsFile {
  schemaVersion: 1;
  ratings: Record<string, number>;
}

export interface PresetMarketLoadResult {
  cards: PresetMarketCard[];
  source: 'remote' | 'cache' | 'empty';
  warning?: string;
}

export interface PresetMarketStorage extends ExportPresetStorage {}

export interface PresetMarketLoadOptions {
  storage?: PresetMarketStorage;
  fetcher?: typeof fetch;
  url?: string;
}

const MARKET_CACHE_DIR = 'market-cache';
const MARKET_PRESETS_FILE = 'presets.json';
const MARKET_RATINGS_FILE = 'ratings.json';
const MARKET_INSTALLED_DIR = 'installed';

const EXPORT_PRESET_MARKET_URL =
  'https://gist.githubusercontent.com/open-factory/export-preset-market/raw/presets.json';

const bridgePresetMarketStorage: PresetMarketStorage = {
  getAppDataDir,
  fsExists,
  readFile,
  writeFile,
};

export function getPresetMarketCachePath(appDataDir: string): string {
  return `${appDataDir.replace(/[\\/]+$/, '')}/${MARKET_CACHE_DIR}/${MARKET_PRESETS_FILE}`;
}

function getPresetMarketRatingsPath(appDataDir: string): string {
  return `${appDataDir.replace(/[\\/]+$/, '')}/${MARKET_CACHE_DIR}/${MARKET_RATINGS_FILE}`;
}

function getPresetMarketInstalledPackagePath(appDataDir: string, cardId: string): string {
  return `${appDataDir.replace(/[\\/]+$/, '')}/${MARKET_CACHE_DIR}/${MARKET_INSTALLED_DIR}/${sanitizeFileSegment(cardId)}.ofpreset.json`;
}

export function parsePresetMarketJson(contents: string): PresetMarketCard[] {
  const parsed = JSON.parse(contents) as Partial<PresetMarketFile>;
  if (parsed.schemaVersion !== 1 || !Array.isArray(parsed.presets)) {
    throw new Error(zhCN.presetMarket.invalidJson);
  }
  return parsed.presets.flatMap((card) => normalizePresetMarketCard(card));
}

export function filterPresetMarketCards(
  cards: PresetMarketCard[],
  filters: PresetMarketFilters = {},
): PresetMarketCard[] {
  return cards.filter((card) => {
    const tags = card.tags.map((tag) => tag.toLowerCase());
    return (
      matchesFilter(tags, filters.platform) &&
      matchesFilter(tags, filters.quality) &&
      matchesFilter(tags, filters.format)
    );
  });
}

export async function loadPresetMarket(options: PresetMarketLoadOptions = {}): Promise<PresetMarketLoadResult> {
  const storage = options.storage ?? bridgePresetMarketStorage;
  const cachePath = getPresetMarketCachePath(await storage.getAppDataDir());
  try {
    const response = await (options.fetcher ?? fetch)(options.url ?? EXPORT_PRESET_MARKET_URL, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const contents = await response.text();
    const cards = parsePresetMarketJson(contents);
    await storage.writeFile(cachePath, `${JSON.stringify({ schemaVersion: 1, presets: cards }, null, 2)}\n`);
    return { cards, source: 'remote' };
  } catch (error) {
    if (await storage.fsExists(cachePath)) {
      return {
        cards: parsePresetMarketJson(await storage.readFile(cachePath)),
        source: 'cache',
        warning: error instanceof Error ? error.message : zhCN.presetMarket.loadFailedMessage,
      };
    }
    return {
      cards: [],
      source: 'empty',
      warning: error instanceof Error ? error.message : zhCN.presetMarket.loadFailedMessage,
    };
  }
}

export async function readPresetMarketRatings(
  storage: PresetMarketStorage = bridgePresetMarketStorage,
): Promise<Record<string, number>> {
  const path = getPresetMarketRatingsPath(await storage.getAppDataDir());
  if (!(await storage.fsExists(path))) {
    return {};
  }
  try {
    const parsed = JSON.parse(await storage.readFile(path)) as Partial<PresetMarketRatingsFile>;
    if (parsed.schemaVersion !== 1 || !parsed.ratings || typeof parsed.ratings !== 'object') {
      return {};
    }
    return Object.fromEntries(
      Object.entries(parsed.ratings).flatMap(([id, rating]) =>
        typeof rating === 'number' && Number.isFinite(rating) ? [[id, clampRating(rating)]] : [],
      ),
    );
  } catch {
    return {};
  }
}

export async function writePresetMarketRating(
  cardId: string,
  rating: number,
  storage: PresetMarketStorage = bridgePresetMarketStorage,
): Promise<Record<string, number>> {
  const appDataDir = await storage.getAppDataDir();
  const path = getPresetMarketRatingsPath(appDataDir);
  const ratings = await readPresetMarketRatings(storage);
  const nextRatings = { ...ratings, [cardId]: clampRating(rating) };
  const payload: PresetMarketRatingsFile = { schemaVersion: 1, ratings: nextRatings };
  await storage.writeFile(path, `${JSON.stringify(payload, null, 2)}\n`);
  return nextRatings;
}

export function presetMarketCardHasCustomConflict(card: PresetMarketCard, existingPresets: ExportPreset[]): boolean {
  const name = getPresetMarketInstallName(card).toLowerCase();
  return existingPresets.some((preset) => !preset.builtin && preset.name.trim().toLowerCase() === name);
}

function buildPresetMarketPackage(
  card: PresetMarketCard,
  exportedAt: string = new Date(Date.now()).toISOString(),
): ExportPresetPackageFile {
  return {
    version: 1,
    creator: card.author,
    exportedAt,
    presets: [
      {
        ...card.preset,
        id: card.preset.id?.trim() || `market-${card.id}`,
        name: getPresetMarketInstallName(card),
        description: card.preset.description?.trim() || card.description,
      },
    ],
  };
}

function serializePresetMarketPackage(card: PresetMarketCard): string {
  return `${JSON.stringify(buildPresetMarketPackage(card), null, 2)}\n`;
}

export async function installPresetMarketCard(
  card: PresetMarketCard,
  conflictMode: ExportPresetImportConflictMode,
  storage: PresetMarketStorage = bridgePresetMarketStorage,
): Promise<ExportPresetImportResult> {
  const appDataDir = await storage.getAppDataDir();
  const contents = serializePresetMarketPackage(card);
  await storage.writeFile(getPresetMarketInstalledPackagePath(appDataDir, card.id), contents);
  return importExportPresetPackage(contents, conflictMode, storage);
}

function normalizePresetMarketCard(input: unknown): PresetMarketCard[] {
  if (!input || typeof input !== 'object') {
    return [];
  }
  const raw = input as Record<string, unknown>;
  const id = normalizeString(raw.id);
  const name = normalizeString(raw.name);
  if (!id || !name) {
    return [];
  }
  const preset = normalizeMarketPreset(
    raw.preset,
    name,
    normalizeString(raw.description) || zhCN.exportPresets.customDescription,
  );
  if (!preset) {
    return [];
  }
  return [
    {
      id,
      name,
      author: normalizeString(raw.author) || zhCN.presetMarket.unknownAuthor,
      description: normalizeString(raw.description) || preset.description || zhCN.exportPresets.customDescription,
      tags: normalizeTags(raw.tags),
      downloads: Math.max(0, Math.round(finiteOrDefault(raw.downloads, 0))),
      rating: clampRating(finiteOrDefault(raw.rating, 0)),
      preset,
    },
  ];
}

function normalizeMarketPreset(
  input: unknown,
  fallbackName: string,
  fallbackDescription: string,
): ExportPresetPackagePreset | undefined {
  if (!input || typeof input !== 'object') {
    return undefined;
  }
  const raw = input as Record<string, unknown>;
  const settings =
    raw.settings && typeof raw.settings === 'object'
      ? (raw.settings as ExportPresetPackagePreset['settings'])
      : undefined;
  return {
    id: normalizeString(raw.id) || undefined,
    name: normalizeString(raw.name) || fallbackName,
    description: normalizeString(raw.description) || fallbackDescription,
    settings,
    updatedAt: normalizeString(raw.updatedAt) || undefined,
  };
}

function getPresetMarketInstallName(card: PresetMarketCard): string {
  return card.preset.name.trim() || card.name;
}

function normalizeString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeTags(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return Array.from(new Set(value.map((tag) => normalizeString(tag)).filter(Boolean)));
}

function matchesFilter(tags: string[], filter: PresetMarketFilterValue | undefined): boolean {
  if (!filter || filter === 'all') {
    return true;
  }
  return tags.includes(filter.toLowerCase());
}

function clampRating(value: number): number {
  return Math.min(5, Math.max(1, Math.round(finiteOrDefault(value, 1))));
}

function finiteOrDefault(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function sanitizeFileSegment(value: string): string {
  return (
    value
      .trim()
      .replace(/[^a-zA-Z0-9_-]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'preset'
  );
}
