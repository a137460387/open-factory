import { describe, test, expect } from 'vitest';
import { HeadlessEditorCore, DEFAULT_HEADLESS_CONFIG } from '../../src/headless/headless-editor-core';

describe('HeadlessEditorCore', () => {
  test('creates instance with default config', () => {
    const core = new HeadlessEditorCore();
    const config = core.getConfig();
    expect(config.ffmpegPath).toBe('ffmpeg');
    expect(config.concurrency).toBe(4);
    expect(config.logLevel).toBe('info');
    expect(config.aiProvider).toBe('auto');
  });

  test('creates instance with custom config', () => {
    const core = new HeadlessEditorCore({
      ffmpegPath: '/usr/bin/ffmpeg',
      concurrency: 8,
      logLevel: 'debug',
    });
    const config = core.getConfig();
    expect(config.ffmpegPath).toBe('/usr/bin/ffmpeg');
    expect(config.concurrency).toBe(8);
    expect(config.logLevel).toBe('debug');
    // Unchanged defaults
    expect(config.tempDir).toBe(DEFAULT_HEADLESS_CONFIG.tempDir);
  });

  test('validates V2 project file structure', () => {
    const core = new HeadlessEditorCore();

    const validV2 = {
      schemaVersion: 2,
      project: {
        id: 'test',
        name: 'Test',
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01',
        settings: {},
        media: [],
        timeline: { tracks: [] },
      },
    };
    expect(core.isValidProjectFile(validV2)).toBe(true);

    const validV1 = {
      version: '0.1',
      project: {
        id: 'test',
        name: 'Test',
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01',
        settings: {},
        timeline: { tracks: [] },
      },
      assets: [],
    };
    expect(core.isValidProjectFile(validV1)).toBe(true);

    expect(core.isValidProjectFile(null)).toBe(false);
    expect(core.isValidProjectFile({})).toBe(false);
    expect(core.isValidProjectFile({ schemaVersion: 1 })).toBe(false);
  });

  test('extracts timeline from V2 project file', () => {
    const core = new HeadlessEditorCore();
    const timeline = { tracks: [{ id: 't1', type: 'video', clips: [] }] };
    const projectFile = {
      schemaVersion: 2 as const,
      project: {
        id: 'test',
        name: 'Test',
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01',
        settings: {},
        media: [],
        timeline,
      },
    };

    const extracted = core.extractTimeline(projectFile);
    expect(extracted).toBe(timeline);
  });

  test('extracts assets from V2 project file', () => {
    const core = new HeadlessEditorCore();
    const media = [
      { id: 'm1', name: 'video.mp4', path: '/path/to/video.mp4', type: 'video' as const, duration: 10, width: 1920, height: 1080 },
    ];
    const projectFile = {
      schemaVersion: 2 as const,
      project: {
        id: 'test',
        name: 'Test',
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01',
        settings: {},
        media,
        timeline: { tracks: [] },
      },
    };

    const extracted = core.extractAssets(projectFile);
    expect(extracted).toBe(media);
  });
});
