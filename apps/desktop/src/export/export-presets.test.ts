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
import { zhCN } from '../i18n/strings';

describe('export presets', () => {
  it('loads built-in presets when presets.json is missing', async () => {
    const { storage } = makeStorage();

    const presets = await loadExportPresets(storage);

    expect(presets.map((preset) => preset.name)).toEqual([
      zhCN.exportPresets.builtins.web1080p.name,
      zhCN.exportPresets.builtins.fourK.name,
      zhCN.exportPresets.builtins.youtubeShorts.name,
      zhCN.exportPresets.builtins.twitterX.name,
      zhCN.exportPresets.builtins.audioM4a.name
    ]);
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

    await expect(deleteCustomExportPreset(BUILTIN_EXPORT_PRESETS[0].id, storage)).rejects.toThrow(zhCN.exportPresets.cannotDeleteBuiltin);
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
              hardwareEncoding: true,
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
          subtitleMode: 'soft-sub',
          hardwareEncoding: true
        }
      })
    ]);
    expect(parseStoredExportPresets('{broken')).toEqual([]);
    expect(serializeCustomExportPresets([...BUILTIN_EXPORT_PRESETS, ...parsed])).toContain('"schemaVersion": 1');
  });

  it('persists PNG sequence custom preset settings', async () => {
    const { storage } = makeStorage();

    const presets = await saveCustomExportPreset('PNG Frames', { format: 'png-sequence', outputMode: 'video', fps: 12, videoCodec: 'png' }, storage);

    expect(presets.find((preset) => preset.name === 'PNG Frames')?.settings).toMatchObject({
      format: 'png-sequence',
      outputMode: 'video',
      fps: 12,
      videoCodec: 'png'
    });
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
