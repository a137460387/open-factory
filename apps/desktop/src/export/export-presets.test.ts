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
      zhCN.exportPresets.builtins.youtube1080p.name,
      zhCN.exportPresets.builtins.youtubeShorts.name,
      zhCN.exportPresets.builtins.tiktok.name,
      zhCN.exportPresets.builtins.instagramReels.name,
      zhCN.exportPresets.builtins.twitterX.name,
      zhCN.exportPresets.builtins.bilibili.name,
      zhCN.exportPresets.builtins.gif.name,
      zhCN.exportPresets.builtins.webp.name,
      zhCN.exportPresets.builtins.apng.name,
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
        targetAspectRatio: '9:16',
        reframeOffsetX: 0.25,
        reframeOffsetY: -0.5,
        subtitleMode: 'burn-in',
        loudnessNormalization: 'youtube'
      },
      storage
    );

    const custom = withCustom.find((preset) => preset.name === 'Mobile Review');
    expect(custom).toEqual(
      expect.objectContaining({
        id: 'custom-mywpiww0-mobile-review',
        builtin: false,
        settings: expect.objectContaining({ width: 1080, height: 1920, scaleMode: 'fit', targetAspectRatio: '9:16', reframeOffsetX: 0.25, reframeOffsetY: -0.5 })
      })
    );
    expect(JSON.parse(files.get(presetPath) ?? '{}')).toEqual({
      schemaVersion: 1,
      presets: [
        expect.objectContaining({
          id: 'custom-mywpiww0-mobile-review',
          name: 'Mobile Review',
          settings: expect.objectContaining({ videoBitrate: '9M', subtitleMode: 'burn-in', targetAspectRatio: '9:16', loudnessNormalization: 'youtube' })
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

  it('defines platform presets with delivery settings and protected built-in ids', () => {
    expect(BUILTIN_EXPORT_PRESETS.find((preset) => preset.id === 'youtube-1080p')?.settings).toMatchObject({
      width: 1920,
      height: 1080,
      fps: 30,
      videoBitrate: '8M',
      platformPreset: 'youtube-1080p'
    });
    expect(BUILTIN_EXPORT_PRESETS.find((preset) => preset.id === 'youtube-shorts')?.settings).toMatchObject({
      width: 1080,
      height: 1920,
      fps: 60,
      videoBitrate: '8M',
      scaleMode: 'fit',
      targetAspectRatio: 'source',
      platformPreset: 'youtube-shorts'
    });
    expect(BUILTIN_EXPORT_PRESETS.find((preset) => preset.id === 'tiktok')?.settings).toMatchObject({
      width: 1080,
      height: 1920,
      fps: 60,
      videoBitrate: '6M',
      loudnessNormalization: 'youtube',
      platformPreset: 'tiktok'
    });
    expect(BUILTIN_EXPORT_PRESETS.find((preset) => preset.id === 'bilibili')?.settings).toMatchObject({
      width: 1920,
      height: 1080,
      fps: 60,
      videoBitrate: '10M',
      videoProfile: 'high',
      platformPreset: 'bilibili'
    });
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
              targetAspectRatio: '21:9',
              reframeOffsetX: 3,
              reframeOffsetY: -3,
              hardwareEncoding: true,
              loudnessNormalization: 'ebu-r128',
              platformPreset: 'bilibili',
              videoProfile: 'high',
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
          targetAspectRatio: '21:9',
          reframeOffsetX: 1,
          reframeOffsetY: -1,
          hardwareEncoding: true,
          loudnessNormalization: 'ebu-r128',
          platformPreset: 'bilibili',
          videoProfile: 'high'
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

  it('keeps animated image custom preset formats', async () => {
    const { storage } = makeStorage();

    const presets = await saveCustomExportPreset('Small GIF', { format: 'gif', outputMode: 'video', fps: 15, width: 640, height: 360, videoCodec: 'gif' }, storage);

    expect(presets.find((preset) => preset.name === 'Small GIF')?.settings).toMatchObject({
      format: 'gif',
      outputMode: 'video',
      fps: 15,
      videoCodec: 'gif'
    });
  });

  it('persists and sanitizes audio visualization preset settings', async () => {
    const { storage, files, presetPath } = makeStorage();

    const presets = await saveCustomExportPreset(
      'Audio Viz',
      {
        format: 'mp4',
        outputMode: 'audio-visualization',
        audioVisualization: {
          style: 'circular-spectrum',
          color: '#ABC',
          background: {
            type: 'gradient',
            color: '#050816',
            color2: '#bad'
          }
        }
      },
      storage
    );

    expect(presets.find((preset) => preset.name === 'Audio Viz')?.settings).toMatchObject({
      format: 'mp4',
      outputMode: 'audio-visualization',
      audioVisualization: {
        style: 'circular-spectrum',
        color: '#aabbcc',
        background: {
          type: 'gradient',
          color: '#050816',
          color2: '#bbaadd'
        }
      }
    });
    expect(JSON.parse(files.get(presetPath) ?? '{}').presets[0].settings.audioVisualization).toEqual(
      expect.objectContaining({ style: 'circular-spectrum', color: '#aabbcc' })
    );

    const parsed = parseStoredExportPresets(
      JSON.stringify({
        schemaVersion: 1,
        presets: [
          {
            id: 'custom-audio-viz',
            name: 'Audio Viz',
            settings: {
              outputMode: 'audio-visualization',
              audioVisualization: {
                style: 'unknown',
                color: 'bad',
                background: { type: 'image', path: ' C:\\Media\\cover.png ' }
              }
            }
          }
        ]
      })
    );

    expect(parsed[0].settings.audioVisualization).toEqual({
      style: 'waveform-line',
      color: '#22d3ee',
      background: { type: 'image', path: 'C:\\Media\\cover.png' }
    });
  });

  it('persists and sanitizes watermark preset settings', async () => {
    const { storage, files, presetPath } = makeStorage();

    const presets = await saveCustomExportPreset(
      'Watermarked',
      {
        format: 'mp4',
        outputMode: 'video',
        watermark: {
          enabled: true,
          type: 'text',
          text: 'Draft',
          fontFamily: 'Arial',
          color: '#ffcc00',
          fontSize: 48,
          position: 'bottom-center'
        }
      },
      storage
    );

    expect(presets.find((preset) => preset.name === 'Watermarked')?.settings.watermark).toEqual({
      enabled: true,
      type: 'text',
      text: 'Draft',
      fontFamily: 'Arial',
      color: '#ffcc00',
      fontSize: 48,
      position: 'bottom-center'
    });
    expect(JSON.parse(files.get(presetPath) ?? '{}').presets[0].settings.watermark).toEqual(expect.objectContaining({ type: 'text', text: 'Draft' }));

    const parsed = parseStoredExportPresets(
      JSON.stringify({
        schemaVersion: 1,
        presets: [
          {
            id: 'custom-watermark',
            name: 'Watermark',
            settings: {
              watermark: {
                enabled: true,
                type: 'image',
                path: 'C:\\Brand\\logo.png',
                position: 'invalid',
                scalePercent: 99,
                opacity: -1
              }
            }
          }
        ]
      })
    );

    expect(parsed[0].settings.watermark).toEqual({
      enabled: true,
      type: 'image',
      path: 'C:\\Brand\\logo.png',
      position: 'bottom-right',
      scalePercent: 50,
      opacity: 0
    });
  });

  it('persists and sanitizes monitoring helper preset settings', async () => {
    const { storage, files, presetPath } = makeStorage();

    const presets = await saveCustomExportPreset(
      'Review Burn-in',
      {
        format: 'mp4',
        outputMode: 'video',
        timecodeBurnIn: {
          enabled: true,
          position: 'top-left',
          fontSize: 120,
          color: '#fc0',
          backgroundColor: 'bad',
          includeFrameNumber: true
        },
        slate: { enabled: true }
      },
      storage
    );

    expect(presets.find((preset) => preset.name === 'Review Burn-in')?.settings).toMatchObject({
      timecodeBurnIn: {
        enabled: true,
        position: 'top-left',
        fontSize: 96,
        color: '#ffcc00',
        backgroundColor: '#000000',
        includeFrameNumber: true
      },
      slate: { enabled: true }
    });
    expect(JSON.parse(files.get(presetPath) ?? '{}').presets[0].settings.slate).toEqual({ enabled: true });

    const parsed = parseStoredExportPresets(
      JSON.stringify({
        schemaVersion: 1,
        presets: [
          {
            id: 'custom-monitoring',
            name: 'Monitoring',
            settings: {
              timecodeBurnIn: {
                enabled: true,
                position: 'invalid',
                fontSize: 2,
                color: '#fff',
                backgroundColor: '#123456',
                includeFrameNumber: false
              },
              slate: { enabled: true }
            }
          }
        ]
      })
    );

    expect(parsed[0].settings.timecodeBurnIn).toEqual({
      enabled: true,
      position: 'bottom-right',
      fontSize: 8,
      color: '#ffffff',
      backgroundColor: '#123456',
      includeFrameNumber: false
    });
    expect(parsed[0].settings.slate).toEqual({ enabled: true });
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
