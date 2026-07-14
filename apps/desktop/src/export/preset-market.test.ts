import { describe, expect, it } from 'vitest';
import {
  filterPresetMarketCards,
  getPresetMarketCachePath,
  installPresetMarketCard,
  parsePresetMarketJson,
  presetMarketCardHasCustomConflict,
  loadPresetMarket,
  readPresetMarketRatings,
  writePresetMarketRating,
  type PresetMarketStorage,
} from './preset-market';
import type { ExportPreset } from './export-presets';

describe('preset market', () => {
  it('parses preset card JSON into normalized market cards', () => {
    const [card] = parsePresetMarketJson(
      JSON.stringify({
        schemaVersion: 1,
        presets: [
          {
            id: 'yt-4k',
            name: 'YouTube 4K Upload',
            author: 'Ada',
            description: 'High bitrate upload preset',
            tags: ['YouTube', '4K', 'MP4'],
            downloads: 1200,
            rating: 5,
            preset: {
              id: 'custom-yt-4k',
              name: 'YouTube 4K Upload',
              settings: { width: 3840, height: 2160, format: 'mp4', videoBitrate: '35M' },
            },
          },
        ],
      }),
    );

    expect(card).toMatchObject({
      id: 'yt-4k',
      name: 'YouTube 4K Upload',
      author: 'Ada',
      tags: ['YouTube', '4K', 'MP4'],
      downloads: 1200,
      rating: 5,
      preset: { name: 'YouTube 4K Upload' },
    });
  });

  it('filters cards by platform, quality, and format tags', () => {
    const cards = parsePresetMarketJson(
      JSON.stringify({
        schemaVersion: 1,
        presets: [
          makeMarketCard('yt', ['YouTube', '4K', 'MP4']),
          makeMarketCard('bili', ['B站', '1080p', 'WebM']),
          makeMarketCard('fast', ['YouTube', '快速', 'MP4']),
        ],
      }),
    );

    expect(
      filterPresetMarketCards(cards, { platform: 'youtube', quality: '4k', format: 'mp4' }).map((card) => card.id),
    ).toEqual(['yt']);
    expect(filterPresetMarketCards(cards, { format: 'webm' }).map((card) => card.id)).toEqual(['bili']);
  });

  it('stores local ratings in the market cache', async () => {
    const storage = createMemoryStorage();

    await expect(readPresetMarketRatings(storage)).resolves.toEqual({});
    await expect(writePresetMarketRating('yt', 4, storage)).resolves.toEqual({ yt: 4 });
    await expect(readPresetMarketRatings(storage)).resolves.toEqual({ yt: 4 });
  });

  it('falls back to local cache when network loading fails', async () => {
    const storage = createMemoryStorage();
    const cached = JSON.stringify({
      schemaVersion: 1,
      presets: [makeMarketCard('cached', ['YouTube', '1080p', 'MP4'])],
    });
    storage.files.set(getPresetMarketCachePath('C:/Users/E2E/AppData/Roaming/open-factory'), cached);
    const failingFetch = async () => {
      throw new Error('offline');
    };

    const result = await loadPresetMarket({ storage, fetcher: failingFetch as unknown as typeof fetch });

    expect(result.source).toBe('cache');
    expect(result.warning).toContain('offline');
    expect(result.cards.map((card) => card.id)).toEqual(['cached']);
  });

  it('detects duplicate custom presets before overwrite confirmation', () => {
    const [card] = parsePresetMarketJson(
      JSON.stringify({ schemaVersion: 1, presets: [makeMarketCard('yt', ['YouTube', '1080p', 'MP4'])] }),
    );
    const existing: ExportPreset[] = [
      { id: 'custom-yt', name: 'Market yt', description: 'Local', builtin: false, settings: { width: 1920 } },
      { id: 'web-1080p', name: 'Web 1080p', description: 'Built-in', builtin: true, settings: { width: 1920 } },
    ];

    expect(presetMarketCardHasCustomConflict(card, existing)).toBe(true);
  });

  it('installs duplicate market presets with overwrite mode after confirmation', async () => {
    const storage = createMemoryStorage();
    const [card] = parsePresetMarketJson(
      JSON.stringify({ schemaVersion: 1, presets: [makeMarketCard('yt', ['YouTube', '1080p', 'MP4'])] }),
    );
    storage.files.set(
      'C:/Users/E2E/AppData/Roaming/open-factory/presets.json',
      JSON.stringify({
        schemaVersion: 1,
        presets: [
          {
            id: 'custom-existing-yt',
            name: 'Market yt',
            description: 'Old preset',
            settings: { width: 1280, height: 720, format: 'mp4' },
          },
        ],
      }),
    );

    const result = await installPresetMarketCard(card, 'overwrite', storage);

    expect(result.overwritten).toBe(1);
    expect(result.presets.find((preset) => preset.id === 'custom-existing-yt')?.settings.width).toBe(1920);
    expect(
      storage.files.get('C:/Users/E2E/AppData/Roaming/open-factory/market-cache/installed/yt.ofpreset.json'),
    ).toContain('Market yt');
  });
});

function makeMarketCard(id: string, tags: string[]) {
  return {
    id,
    name: `Market ${id}`,
    author: 'Ada',
    description: `${id} preset`,
    tags,
    downloads: 10,
    rating: 4,
    preset: {
      id: `custom-${id}`,
      name: `Market ${id}`,
      settings: { width: 1920, height: 1080, format: 'mp4' },
    },
  };
}

function createMemoryStorage(): PresetMarketStorage & { files: Map<string, string> } {
  const files = new Map<string, string>();
  return {
    files,
    getAppDataDir: () => 'C:/Users/E2E/AppData/Roaming/open-factory',
    fsExists: (path) => files.has(path),
    readFile: (path) => files.get(path) ?? '',
    writeFile: (path, contents) => {
      files.set(path, contents);
    },
  };
}
