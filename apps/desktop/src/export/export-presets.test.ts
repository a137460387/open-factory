import { describe, expect, it, vi } from 'vitest';
import {
  BUILTIN_EXPORT_PRESETS,
  applyExportPresetPackage,
  deleteCustomExportPreset,
  detectExportPresetSyncConflicts,
  fetchOfficialExportPresetPackage,
  getExportPresetsPath,
  importExportPresetPackage,
  loadExportPresets,
  mergeExportPresetPackages,
  parseExportPresetPackage,
  parseStoredExportPresets,
  saveCustomExportPreset,
  serializeCustomExportPresets,
  serializeExportPresetPackage,
  syncExportPresetsWithWebdav,
  type ExportPresetPackageFile,
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
        loudnessNormalization: 'youtube',
        masterProcessing: {
          eq: {
            enabled: false,
            bands: []
          },
          stereoEnhancer: { enabled: false, amount: 1 },
          limiter: { enabled: true, levelOutDb: -0.1 }
        },
        postExportScript: { command: ' echo "{output}" ' }
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
          settings: expect.objectContaining({
            videoBitrate: '9M',
            subtitleMode: 'burn-in',
            targetAspectRatio: '9:16',
            loudnessNormalization: 'youtube',
            masterProcessing: expect.objectContaining({ limiter: { enabled: true, levelOutDb: -0.1 } }),
            postExportScript: { command: 'echo "{output}"' }
          })
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

  it('serializes and parses export preset packages with optional metadata templates', () => {
    const contents = serializeExportPresetPackage(
      [
        {
          id: 'custom-team-review',
          name: 'Team Review',
          description: 'Shared',
          builtin: false,
          settings: { width: 1280, height: 720, format: 'mp4', subtitleLanguages: ['ZH', 'en', 'en'], subtitleBurnInLanguage: 'EN' }
        }
      ],
      { exportedAt: '2026-06-15T00:00:00.000Z', creator: 'Editor Team', ffmpegMetadataArgsTemplate: [' -metadata ', 'title={project}', ''] }
    );

    const parsed = parseExportPresetPackage(contents);

    expect(parsed).toEqual({
      version: 1,
      exportedAt: '2026-06-15T00:00:00.000Z',
      creator: 'Editor Team',
      ffmpegMetadataArgsTemplate: ['-metadata', 'title={project}'],
      presets: [
        {
          id: 'custom-team-review',
          name: 'Team Review',
          description: 'Shared',
          settings: { width: 1280, height: 720, format: 'mp4', subtitleLanguages: ['zh', 'en'], subtitleBurnInLanguage: 'en' }
        }
      ]
    });
  });

  it('handles preset package name conflicts with overwrite, rename, and skip modes', () => {
    const existing = [
      ...BUILTIN_EXPORT_PRESETS,
      { id: 'custom-existing', name: 'Team Review', description: 'Old', builtin: false, settings: { width: 640 } }
    ];
    const packageFile: ExportPresetPackageFile = {
      version: 1,
      exportedAt: '2026-06-15T00:00:00.000Z',
      presets: [{ id: 'custom-imported', name: 'Team Review', description: 'New', settings: { width: 1920 } }]
    };

    const overwritten = applyExportPresetPackage(existing, packageFile, 'overwrite');
    const renamed = applyExportPresetPackage(existing, packageFile, 'rename');
    const skipped = applyExportPresetPackage(existing, packageFile, 'skip');

    expect(overwritten.overwritten).toBe(1);
    expect(overwritten.presets.find((preset) => preset.id === 'custom-existing')?.settings.width).toBe(1920);
    expect(renamed.renamed).toBe(1);
    expect(renamed.presets.some((preset) => preset.name === `Team Review ${zhCN.exportPresets.importedCopySuffix}`)).toBe(true);
    expect(skipped.imported).toBe(0);
    expect(skipped.skipped).toBe(1);
  });

  it('rejects unsupported preset package versions', () => {
    expect(() => parseExportPresetPackage(JSON.stringify({ version: 99, presets: [] }))).toThrow(zhCN.exportPresets.packageUnsupportedVersion);
    expect(() => parseExportPresetPackage(JSON.stringify({ version: 1, presets: [] }))).toThrow(zhCN.exportPresets.packageInvalid);
  });

  it('imports preset packages into custom storage', async () => {
    const { storage, files, presetPath } = makeStorage();
    const contents = serializeExportPresetPackage([
      { id: 'custom-shared-review', name: 'Shared Review', description: 'Shared', builtin: false, settings: { width: 1280, height: 720, format: 'mp4' } }
    ]);

    const result = await importExportPresetPackage(contents, 'rename', storage);

    expect(result.imported).toBe(1);
    expect(result.presets.some((preset) => preset.name === 'Shared Review')).toBe(true);
    expect(JSON.parse(files.get(presetPath) ?? '{}').presets[0]).toEqual(expect.objectContaining({ name: 'Shared Review' }));
  });

  it('skips the official preset package when the network request fails', async () => {
    const fetcher = vi.fn<typeof fetch>().mockRejectedValue(new Error('offline'));

    await expect(fetchOfficialExportPresetPackage(fetcher)).resolves.toBeUndefined();
    expect(fetcher).toHaveBeenCalledTimes(1);
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

  it('persists and sanitizes color management preset settings', async () => {
    const { storage, files, presetPath } = makeStorage();

    const presets = await saveCustomExportPreset(
      'P3 Delivery',
      {
        format: 'mp4',
        colorManagement: {
          inputColorSpace: 'srgb',
          outputColorSpace: 'dci-p3',
          embedIccProfile: true
        }
      },
      storage
    );

    expect(presets.find((preset) => preset.name === 'P3 Delivery')?.settings.colorManagement).toEqual({
      inputColorSpace: 'srgb',
      outputColorSpace: 'dci-p3',
      embedIccProfile: true
    });
    expect(JSON.parse(files.get(presetPath) ?? '{}').presets[0].settings.colorManagement).toEqual({
      inputColorSpace: 'srgb',
      outputColorSpace: 'dci-p3',
      embedIccProfile: true
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

  it('detects export preset sync conflicts by updated timestamp', () => {
    const localPackage: ExportPresetPackageFile = {
      version: 1,
      exportedAt: '2026-06-15T01:00:00.000Z',
      presets: [{ id: 'custom-review', name: 'Review', settings: { width: 1280 }, updatedAt: '2026-06-15T01:00:00.000Z' }]
    };
    const remotePackage: ExportPresetPackageFile = {
      version: 1,
      exportedAt: '2026-06-15T02:00:00.000Z',
      presets: [{ id: 'custom-review-remote', name: 'Review', settings: { width: 1920 }, updatedAt: '2026-06-15T02:00:00.000Z' }]
    };

    expect(detectExportPresetSyncConflicts(localPackage, remotePackage)).toEqual([
      {
        name: 'Review',
        localUpdatedAt: '2026-06-15T01:00:00.000Z',
        remoteUpdatedAt: '2026-06-15T02:00:00.000Z',
        newer: 'remote'
      }
    ]);
  });

  it('uses package exportedAt timestamps when sync conflict presets omit updatedAt', () => {
    const localPackage: ExportPresetPackageFile = {
      version: 1,
      exportedAt: '2026-06-15T01:00:00.000Z',
      presets: [{ id: 'custom-review', name: 'Review', settings: { width: 1280 } }]
    };
    const remotePackage: ExportPresetPackageFile = {
      version: 1,
      exportedAt: '2026-06-15T03:00:00.000Z',
      presets: [{ id: 'custom-review-remote', name: 'Review', settings: { width: 1920 } }]
    };

    expect(detectExportPresetSyncConflicts(localPackage, remotePackage)).toEqual([
      {
        name: 'Review',
        localUpdatedAt: '2026-06-15T01:00:00.000Z',
        remoteUpdatedAt: '2026-06-15T03:00:00.000Z',
        newer: 'remote'
      }
    ]);
  });

  it('merges export preset packages with de-duplication and newer conflict winners', () => {
    const localPackage: ExportPresetPackageFile = {
      version: 1,
      exportedAt: '2026-06-15T01:00:00.000Z',
      presets: [
        { id: 'custom-review', name: 'Review', settings: { width: 1280 }, updatedAt: '2026-06-15T01:00:00.000Z' },
        { id: 'custom-local-only', name: 'Local Only', settings: { width: 640 }, updatedAt: '2026-06-15T01:30:00.000Z' }
      ]
    };
    const remotePackage: ExportPresetPackageFile = {
      version: 1,
      exportedAt: '2026-06-15T02:00:00.000Z',
      presets: [
        { id: 'custom-review-remote', name: 'Review', settings: { width: 1920 }, updatedAt: '2026-06-15T02:00:00.000Z' },
        { id: 'custom-remote-only', name: 'Remote Only', settings: { height: 720 }, updatedAt: '2026-06-15T02:00:00.000Z' }
      ]
    };

    const merged = mergeExportPresetPackages(localPackage, remotePackage, 'merge', '2026-06-15T03:00:00.000Z');

    expect(merged.exportedAt).toBe('2026-06-15T03:00:00.000Z');
    expect(merged.presets.map((preset) => preset.name).sort()).toEqual(['Local Only', 'Remote Only', 'Review']);
    expect(merged.presets.find((preset) => preset.name === 'Review')?.settings?.width).toBe(1920);
  });

  it('keeps local export preset conflicts when requested', () => {
    const merged = mergeExportPresetPackages(
      {
        version: 1,
        exportedAt: '2026-06-15T01:00:00.000Z',
        presets: [{ id: 'custom-review', name: 'Review', settings: { width: 1280 }, updatedAt: '2026-06-15T01:00:00.000Z' }]
      },
      {
        version: 1,
        exportedAt: '2026-06-15T02:00:00.000Z',
        presets: [{ id: 'custom-review-remote', name: 'Review', settings: { width: 1920 }, updatedAt: '2026-06-15T02:00:00.000Z' }]
      },
      'keep-local',
      '2026-06-15T03:00:00.000Z'
    );

    expect(merged.presets).toHaveLength(1);
    expect(merged.presets[0].settings?.width).toBe(1280);
  });

  it('keeps remote export preset conflicts when requested', () => {
    const merged = mergeExportPresetPackages(
      {
        version: 1,
        exportedAt: '2026-06-15T01:00:00.000Z',
        presets: [{ id: 'custom-review', name: 'Review', settings: { width: 1280 }, updatedAt: '2026-06-15T01:00:00.000Z' }]
      },
      {
        version: 1,
        exportedAt: '2026-06-15T02:00:00.000Z',
        presets: [{ id: 'custom-review-remote', name: 'Review', settings: { width: 1920 }, updatedAt: '2026-06-15T02:00:00.000Z' }]
      },
      'keep-remote',
      '2026-06-15T03:00:00.000Z'
    );

    expect(merged.presets).toHaveLength(1);
    expect(merged.presets[0].settings?.width).toBe(1920);
  });

  it('uploads local export presets when the remote WebDAV package is missing', async () => {
    const { storage, files, presetPath } = makeStorage();
    files.set(
      presetPath,
      serializeCustomExportPresets([
        {
          id: 'custom-local-review',
          name: 'Local Review',
          description: 'Local',
          builtin: false,
          settings: { width: 1280 },
          updatedAt: '2026-06-15T01:00:00.000Z'
        }
      ])
    );
    let uploadedContents = '';

    const result = await syncExportPresetsWithWebdav(
      { url: 'https://dav.example.test/presets/export.ofpreset.json', conflictResolution: 'merge' },
      {
        storage,
        now: () => new Date('2026-06-15T03:00:00.000Z'),
        client: {
          getText: async () => {
            throw new Error('404');
          },
          putText: async (request) => {
            uploadedContents = request.contents;
            return { status: 201 };
          }
        }
      }
    );

    expect(result.remoteWasMissing).toBe(true);
    expect(result.uploadedCount).toBe(1);
    expect(result.importedCount).toBe(0);
    expect(uploadedContents).toContain('Local Review');
    expect(files.get(presetPath)).toContain('Local Review');
  });

  it('does not overwrite local presets when WebDAV sync upload fails', async () => {
    const { storage, files, presetPath } = makeStorage();
    const original = serializeCustomExportPresets([
      {
        id: 'custom-local-review',
        name: 'Local Review',
        description: 'Local',
        builtin: false,
        settings: { width: 1280 },
        updatedAt: '2026-06-15T01:00:00.000Z'
      }
    ]);
    files.set(presetPath, original);
    const remotePackage = serializeExportPresetPackage(
      [{ id: 'custom-remote-review', name: 'Remote Review', description: 'Remote', builtin: false, settings: { width: 1920 } }],
      { exportedAt: '2026-06-15T02:00:00.000Z' }
    );

    await expect(
      syncExportPresetsWithWebdav(
        { url: 'https://dav.example.test/presets/export.ofpreset.json', conflictResolution: 'merge' },
        {
          storage,
          now: () => new Date('2026-06-15T03:00:00.000Z'),
          client: {
            getText: async () => ({ status: 200, contents: remotePackage }),
            putText: async () => {
              throw new Error('offline');
            }
          }
        }
      )
    ).rejects.toThrow('offline');
    expect(files.get(presetPath)).toBe(original);
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
