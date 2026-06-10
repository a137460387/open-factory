import { describe, expect, it, vi } from 'vitest';
import {
  BUILTIN_EXPORT_PRESETS,
  deleteCustomExportPreset,
  getExportPresetsPath,
  loadExportPresets,
  parseStoredExportPresets,
  saveCustomExportPreset,
  serializeCustomExportPresets,
  type ExportPresetStorage
} from './export-presets';

describe('export presets', () => {
  it('loads built-in presets when presets.json is missing', async () => {
    const { storage } = makeStorage();

    const presets = await loadExportPresets(storage);

    expect(presets.map((preset) => preset.name)).toEqual(['Web 1080p', '4K', 'YouTube Shorts', 'Twitter/X', 'Audio-only m4a']);
    expect(presets.every((preset) => preset.builtin)).toBe(true);
  });

  it('writes, reads, and deletes custom presets from presets.json', async () => {
    const dateSpy = vi.spyOn(Date, 'now').mockReturnValue(1_800_000_000_000);
    const { storage, files, presetPath } = makeStorage();

    const withCustom = await saveCustomExportPreset(
      'Mobile Review',
      {
        width: 1080,
        height: 1920,
        fps: 30,
        videoBitrate: '9M',
        audioBitrate: '192k',
        format: 'mp4',
        scaleMode: 'fit',
        subtitleMode: 'burn-in'
      },
      storage
    );

    const custom = withCustom.find((preset) => preset.name === 'Mobile Review');
    expect(custom).toEqual(
      expect.objectContaining({
        id: 'custom-mywpiww0-mobile-review',
        builtin: false,
        settings: expect.objectContaining({ width: 1080, height: 1920, scaleMode: 'fit' })
      })
    );
    expect(JSON.parse(files.get(presetPath) ?? '{}')).toEqual({
      schemaVersion: 1,
      presets: [
        expect.objectContaining({
          id: 'custom-mywpiww0-mobile-review',
          name: 'Mobile Review',
          settings: expect.objectContaining({ videoBitrate: '9M', subtitleMode: 'burn-in' })
        })
      ]
    });

    const reloaded = await loadExportPresets(storage);
    expect(reloaded.find((preset) => preset.id === custom?.id)?.settings.height).toBe(1920);

    const afterDelete = await deleteCustomExportPreset(custom!.id, storage);
    expect(afterDelete.some((preset) => preset.id === custom?.id)).toBe(false);
    expect(JSON.parse(files.get(presetPath) ?? '{}')).toEqual({ schemaVersion: 1, presets: [] });

    dateSpy.mockRestore();
  });

  it('rejects deleting built-in presets', async () => {
    const { storage } = makeStorage();

    await expect(deleteCustomExportPreset(BUILTIN_EXPORT_PRESETS[0].id, storage)).rejects.toThrow('Built-in export presets cannot be deleted');
  });

  it('parses only valid custom preset fields', () => {
    const parsed = parseStoredExportPresets(
      JSON.stringify({
        schemaVersion: 1,
        presets: [
          {
            id: 'custom-clean',
            name: 'Clean',
            description: 'Stored',
            settings: {
              width: 1280,
              height: -5,
              fps: 60,
              format: ' webm ',
              videoCodec: ' libvpx-vp9 ',
              audioCodec: ' libopus ',
              audioBitrate: null,
              subtitleMode: 'soft-sub',
              extra: 'ignored'
            }
          },
          { id: 42, name: 'Invalid', settings: {} }
        ]
      })
    );

    expect(parsed).toEqual([
      expect.objectContaining({
        id: 'custom-clean',
        builtin: false,
        settings: {
          width: 1280,
          fps: 60,
          format: 'webm',
          videoCodec: 'libvpx-vp9',
          audioCodec: 'libopus',
          audioBitrate: null,
          subtitleMode: 'soft-sub'
        }
      })
    ]);
    expect(parseStoredExportPresets('{broken')).toEqual([]);
    expect(serializeCustomExportPresets([...BUILTIN_EXPORT_PRESETS, ...parsed])).toContain('"schemaVersion": 1');
  });
});

function makeStorage() {
  const files = new Map<string, string>();
  const root = 'C:/Users/E2E/AppData/Roaming/open-factory';
  const presetPath = getExportPresetsPath(root);
  const storage: ExportPresetStorage = {
    getAppDataDir: () => root,
    fsExists: (path) => files.has(path),
    readFile: (path) => {
      const value = files.get(path);
      if (value === undefined) {
        throw new Error(`Missing mock file: ${path}`);
      }
      return value;
    },
    writeFile: (path, contents) => {
      files.set(path, contents);
    }
  };
  return { storage, files, presetPath };
}
