import { describe, it, expect } from 'vitest';
import type { Project, ExportSubtitleFormat } from '@open-factory/editor-core';
import {
  WATERMARK_POSITIONS,
  AUDIO_VISUALIZATION_FORMATS,
  VIDEO_EXPORT_FORMATS,
  AUDIO_VISUALIZATION_STYLES,
  AUDIO_VISUALIZATION_BACKGROUND_TYPES,
  SUBTITLE_FORMATS,
  DEFAULT_AUDIO_VISUALIZATION,
  DEFAULT_TIMECODE_BURN_IN,
  buildExportPreviewOutputPaths,
  normalizeWatermarkPosition,
  isWatermarkPosition,
  supportsLoudnessNormalization,
  safePresetPackageFileName,
  formatSubtitleLanguageLabel,
  timecodeBurnInFrom,
  normalizeDraftSettings,
} from './exportSettingsHelpers';
import type { ExportPresetSettings } from '../export-presets';

describe('constants', () => {
  it('WATERMARK_POSITIONS has 9 positions', () => {
    expect(WATERMARK_POSITIONS).toHaveLength(9);
    expect(WATERMARK_POSITIONS).toContain('top-left');
    expect(WATERMARK_POSITIONS).toContain('center');
    expect(WATERMARK_POSITIONS).toContain('bottom-right');
  });

  it('AUDIO_VISUALIZATION_FORMATS includes mp4, mov, webm', () => {
    expect(AUDIO_VISUALIZATION_FORMATS).toEqual(['mp4', 'mov', 'webm']);
  });

  it('VIDEO_EXPORT_FORMATS includes expected formats', () => {
    expect(VIDEO_EXPORT_FORMATS).toContain('mp4');
    expect(VIDEO_EXPORT_FORMATS).toContain('gif');
    expect(VIDEO_EXPORT_FORMATS).toContain('webm');
    expect(VIDEO_EXPORT_FORMATS).toContain('png-sequence');
  });

  it('SUBTITLE_FORMATS includes srt, vtt, ass, ssa', () => {
    expect(SUBTITLE_FORMATS).toEqual(['srt', 'vtt', 'ass', 'ssa']);
  });

  it('DEFAULT_AUDIO_VISUALIZATION has expected defaults', () => {
    expect(DEFAULT_AUDIO_VISUALIZATION.style).toBe('waveform-line');
    expect(DEFAULT_AUDIO_VISUALIZATION.color).toBe('#22d3ee');
    expect(DEFAULT_AUDIO_VISUALIZATION.background.type).toBe('solid');
  });

  it('DEFAULT_TIMECODE_BURN_IN has expected defaults', () => {
    expect(DEFAULT_TIMECODE_BURN_IN.enabled).toBe(true);
    expect(DEFAULT_TIMECODE_BURN_IN.position).toBe('bottom-left');
    expect(DEFAULT_TIMECODE_BURN_IN.fontSize).toBe(28);
  });
});

describe('buildExportPreviewOutputPaths', () => {
  it('returns 3 paths for start, middle, end', () => {
    const paths = buildExportPreviewOutputPaths('/tmp/app');
    expect(paths).toHaveLength(3);
    expect(paths[0]).toContain('start.png');
    expect(paths[1]).toContain('middle.png');
    expect(paths[2]).toContain('end.png');
  });

  it('strips trailing slashes from appDataDir', () => {
    const paths = buildExportPreviewOutputPaths('/tmp/app/');
    expect(paths[0]).not.toContain('//');
  });
});

describe('normalizeWatermarkPosition', () => {
  it('returns valid position as-is', () => {
    expect(normalizeWatermarkPosition('top-left')).toBe('top-left');
    expect(normalizeWatermarkPosition('center')).toBe('center');
  });

  it('returns bottom-right for undefined', () => {
    expect(normalizeWatermarkPosition(undefined)).toBe('bottom-right');
  });

  it('returns bottom-right for invalid position', () => {
    expect(normalizeWatermarkPosition('invalid' as never)).toBe('bottom-right');
  });
});

describe('isWatermarkPosition', () => {
  it('returns true for valid positions', () => {
    for (const pos of WATERMARK_POSITIONS) {
      expect(isWatermarkPosition(pos)).toBe(true);
    }
  });

  it('returns false for invalid values', () => {
    expect(isWatermarkPosition('invalid')).toBe(false);
    expect(isWatermarkPosition('')).toBe(false);
  });
});

describe('supportsLoudnessNormalization', () => {
  it('returns true for audio output mode', () => {
    expect(supportsLoudnessNormalization('mp4', 'audio')).toBe(true);
  });

  it('returns true for m4a format', () => {
    expect(supportsLoudnessNormalization('m4a', 'video')).toBe(true);
  });

  it('returns false for gif', () => {
    expect(supportsLoudnessNormalization('gif', 'video')).toBe(false);
  });

  it('returns false for webp', () => {
    expect(supportsLoudnessNormalization('webp', 'video')).toBe(false);
  });

  it('returns false for apng', () => {
    expect(supportsLoudnessNormalization('apng', 'video')).toBe(false);
  });

  it('returns false for png-sequence', () => {
    expect(supportsLoudnessNormalization('png-sequence', 'video')).toBe(false);
  });

  it('returns true for mp4 video', () => {
    expect(supportsLoudnessNormalization('mp4', 'video')).toBe(true);
  });

  it('returns true for webm video', () => {
    expect(supportsLoudnessNormalization('webm', 'video')).toBe(true);
  });
});

describe('safePresetPackageFileName', () => {
  it('normalizes and lowercases', () => {
    expect(safePresetPackageFileName('My Preset Pack')).toBe('my-preset-pack');
  });

  it('replaces special characters', () => {
    expect(safePresetPackageFileName('test@#$%name')).toBe('test-name');
  });

  it('trims and strips leading/trailing dashes', () => {
    expect(safePresetPackageFileName('  --test--  ')).toBe('test');
  });

  it('truncates to 48 characters', () => {
    const long = 'a'.repeat(100);
    expect(safePresetPackageFileName(long).length).toBeLessThanOrEqual(48);
  });

  it('returns fallback for empty result', () => {
    expect(safePresetPackageFileName('###')).toBe('open-factory-presets');
  });

  it('preserves Chinese characters', () => {
    expect(safePresetPackageFileName('我的预设')).toBe('我的预设');
  });
});

describe('formatSubtitleLanguageLabel', () => {
  it('returns label for known language', () => {
    const label = formatSubtitleLanguageLabel('en');
    expect(typeof label).toBe('string');
    expect(label.length).toBeGreaterThan(0);
  });

  it('returns uppercase for unknown language', () => {
    const label = formatSubtitleLanguageLabel('zz');
    expect(label).toBe('ZZ');
  });
});

describe('timecodeBurnInFrom', () => {
  it('returns defaults when value is disabled', () => {
    const result = timecodeBurnInFrom({ enabled: false } as never);
    expect(result.enabled).toBe(true);
    expect(result.position).toBe('bottom-left');
  });

  it('returns defaults when value is undefined', () => {
    const result = timecodeBurnInFrom(undefined);
    expect(result.enabled).toBe(true);
    expect(result.fontSize).toBe(28);
  });

  it('preserves enabled settings', () => {
    const result = timecodeBurnInFrom({
      enabled: true,
      position: 'top-right',
      fontSize: 32,
      color: '#ff0000',
      backgroundColor: '#000000',
      includeFrameNumber: true,
    });
    expect(result.enabled).toBe(true);
    expect(result.position).toBe('top-right');
    expect(result.fontSize).toBe(32);
  });
});

describe('normalizeDraftSettings', () => {
  const minimalSettings: ExportPresetSettings = {
    width: 1920,
    height: 1080,
  } as ExportPresetSettings;

  it('defaults to mp4 format', () => {
    const result = normalizeDraftSettings(minimalSettings);
    expect(result.format).toBe('mp4');
  });

  it('sets outputMode to audio for m4a', () => {
    const result = normalizeDraftSettings({ ...minimalSettings, format: 'm4a' });
    expect(result.outputMode).toBe('audio');
    expect(result.format).toBe('m4a');
  });

  it('normalizes audio-visualization format', () => {
    const result = normalizeDraftSettings({
      ...minimalSettings,
      outputMode: 'audio-visualization',
      format: 'mp4',
    });
    expect(result.outputMode).toBe('audio-visualization');
    expect(result.format).toBe('mp4');
  });

  it('falls back to mp4 for invalid audio-visualization format', () => {
    const result = normalizeDraftSettings({
      ...minimalSettings,
      outputMode: 'audio-visualization',
      format: 'mkv',
    });
    expect(result.format).toBe('mp4');
  });

  it('sets videoCodec for webm', () => {
    const result = normalizeDraftSettings({ ...minimalSettings, format: 'webm' });
    expect(result.videoCodec).toBe('libvpx-vp9');
  });

  it('sets videoCodec for gif', () => {
    const result = normalizeDraftSettings({ ...minimalSettings, format: 'gif' });
    expect(result.videoCodec).toBe('gif');
  });

  it('sets audioCodec for webm', () => {
    const result = normalizeDraftSettings({ ...minimalSettings, format: 'webm' });
    expect(result.audioCodec).toBe('libopus');
  });

  it('enables hardwareEncoding for mp4 when set', () => {
    const result = normalizeDraftSettings({ ...minimalSettings, hardwareEncoding: true });
    expect(result.hardwareEncoding).toBe(true);
  });

  it('disables hardwareEncoding for audio mode', () => {
    const result = normalizeDraftSettings({ ...minimalSettings, format: 'm4a', hardwareEncoding: true });
    expect(result.hardwareEncoding).toBe(false);
  });

  it('normalizes subtitleFormat', () => {
    const result = normalizeDraftSettings({ ...minimalSettings, subtitleFormat: 'vtt' });
    expect(result.subtitleFormat).toBe('vtt');
  });

  it('defaults subtitleFormat to srt', () => {
    const result = normalizeDraftSettings({ ...minimalSettings, subtitleFormat: 'invalid' as ExportSubtitleFormat });
    expect(result.subtitleFormat).toBe('srt');
  });

  it('normalizes audioVisualization', () => {
    const result = normalizeDraftSettings(minimalSettings);
    expect(result.audioVisualization).toBeDefined();
    expect(result.audioVisualization?.style).toBe('waveform-line');
  });

  it('normalizes audioVisualization with custom style', () => {
    const result = normalizeDraftSettings({
      ...minimalSettings,
      audioVisualization: { style: 'spectrum-bars', color: '#ff0000', background: { type: 'solid', color: '#000' } },
    });
    expect(result.audioVisualization?.style).toBe('spectrum-bars');
    expect(result.audioVisualization?.color).toBe('#ff0000');
  });

  it('normalizes audioVisualization background gradient', () => {
    const result = normalizeDraftSettings({
      ...minimalSettings,
      audioVisualization: {
        style: 'waveform-line',
        color: '#fff',
        background: { type: 'gradient', color: '#111', color2: '#222' },
      },
    });
    expect(result.audioVisualization?.background.type).toBe('gradient');
  });

  it('normalizes audioVisualization background image', () => {
    const result = normalizeDraftSettings({
      ...minimalSettings,
      audioVisualization: {
        style: 'waveform-line',
        color: '#fff',
        background: { type: 'image', path: '/img.png' },
      },
    });
    expect(result.audioVisualization?.background.type).toBe('image');
  });

  it('falls back for invalid audioVisualization style', () => {
    const result = normalizeDraftSettings({
      ...minimalSettings,
      audioVisualization: { style: 'invalid' as never, color: '#fff', background: { type: 'solid', color: '#000' } },
    });
    expect(result.audioVisualization?.style).toBe('waveform-line');
  });

  it('normalizes watermark to null for audio mode', () => {
    const result = normalizeDraftSettings({ ...minimalSettings, format: 'm4a', watermark: { enabled: true, type: 'text' as const, text: 'test', fontFamily: 'sans-serif', position: 'center' as const, color: '#fff', fontSize: 24 } });
    expect(result.watermark).toBeNull();
  });

  it('normalizes loudnessNormalization for gif', () => {
    const result = normalizeDraftSettings({ ...minimalSettings, format: 'gif' });
    expect(result.loudnessNormalization).toBe('off');
  });
});
