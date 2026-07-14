import { describe, expect, it } from 'vitest';
import { DEFAULT_COLOR_CORRECTION, createEffectPresetFromClip } from '@open-factory/editor-core';
import {
  filterEffectPresetCommunityCards,
  getEffectPresetCommunityCachePath,
  getEffectPresetFilePath,
  installEffectPresetCommunityCard,
  loadEffectPresetCommunityLibrary,
  loadLocalEffectPresets,
  parseEffectPresetCommunityJson,
  saveLocalEffectPreset,
  type EffectPresetLibraryStorage,
} from './effect-preset-library';

describe('effect preset library', () => {
  it('loads community cards from cache when the static directory request fails', async () => {
    const storage = createMemoryStorage();
    const cachePath = getEffectPresetCommunityCachePath(storage.appDataDir);
    storage.files.set(cachePath, makeCommunityJson('cache-film', ['cinematic', 'portrait']));
    const fetcher = async () => {
      throw new Error('offline');
    };

    const result = await loadEffectPresetCommunityLibrary({ storage, fetcher: fetcher as unknown as typeof fetch });

    expect(result.source).toBe('cache');
    expect(result.warning).toContain('offline');
    expect(result.cards.map((card) => card.id)).toEqual(['cache-film']);
  });

  it('installs community presets into the local effect preset directory', async () => {
    const storage = createMemoryStorage();
    const [card] = parseEffectPresetCommunityJson(makeCommunityJson('fresh-food', ['fresh', 'food']));

    const path = await installEffectPresetCommunityCard(card, storage);
    const local = await loadLocalEffectPresets(storage);

    expect(path).toBe(getEffectPresetFilePath(storage.appDataDir, 'preset-fresh-food'));
    expect(storage.files.get(path)).toContain('Fresh Food');
    expect(local.map((preset) => preset.id)).toEqual(['preset-fresh-food']);
  });

  it('filters community cards by style and use tags', () => {
    const cards = [
      ...parseEffectPresetCommunityJson(makeCommunityJson('film-face', ['cinematic', 'portrait'])),
      ...parseEffectPresetCommunityJson(makeCommunityJson('cyber-food', ['cyber', 'food'])),
    ];

    expect(filterEffectPresetCommunityCards(cards, { style: 'cinematic' }).map((card) => card.id)).toEqual([
      'film-face',
    ]);
    expect(filterEffectPresetCommunityCards(cards, { use: 'food' }).map((card) => card.id)).toEqual(['cyber-food']);
  });

  it('saves and reloads local preset files sorted by name', async () => {
    const storage = createMemoryStorage();
    const alpha = createEffectPresetFromClip(makeClip(), { id: 'alpha', name: 'Alpha' });
    const zeta = createEffectPresetFromClip(makeClip(), { id: 'zeta', name: 'Zeta' });

    await saveLocalEffectPreset(zeta, storage);
    await saveLocalEffectPreset(alpha, storage);

    expect((await loadLocalEffectPresets(storage)).map((preset) => preset.name)).toEqual(['Alpha', 'Zeta']);
  });
});

function makeCommunityJson(id: string, tags: string[]): string {
  const title = id
    .split('-')
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(' ');
  return JSON.stringify({
    schemaVersion: 1,
    presets: [
      {
        id,
        name: title,
        author: 'Ada',
        description: 'Community preset',
        tags,
        thumbnail: 'data:image/png;base64,AAAA',
        preset: createEffectPresetFromClip(makeClip(), {
          id: `preset-${id}`,
          name: title,
          author: 'Ada',
          tags,
          thumbnail: 'data:image/png;base64,AAAA',
          now: '2026-06-18T00:00:00.000Z',
        }),
      },
    ],
  });
}

function makeClip() {
  return {
    id: 'clip',
    type: 'video' as const,
    name: 'Clip',
    mediaId: 'asset',
    trackId: 'track',
    start: 0,
    duration: 1,
    trimStart: 0,
    trimEnd: 0,
    speed: 1,
    colorCorrection: { ...DEFAULT_COLOR_CORRECTION },
    transform: { x: 0, y: 0, scale: 1, scaleX: 1, scaleY: 1, rotation: 0, opacity: 1 },
    blendMode: 'normal' as const,
    volume: 1,
  };
}

function createMemoryStorage(): EffectPresetLibraryStorage & { appDataDir: string; files: Map<string, string> } {
  const appDataDir = 'C:/Users/E2E/AppData/Roaming/open-factory';
  const files = new Map<string, string>();
  return {
    appDataDir,
    files,
    getAppDataDir: () => appDataDir,
    fsExists: (path) => files.has(path),
    readFile: (path) => files.get(path) ?? '',
    writeFile: (path, contents) => {
      files.set(path, contents);
    },
    scanDirectory: (path) => {
      const root = path.replace(/[\\/]+$/, '');
      return Array.from(files.keys()).filter((candidate) => candidate.startsWith(`${root}/`));
    },
  };
}
