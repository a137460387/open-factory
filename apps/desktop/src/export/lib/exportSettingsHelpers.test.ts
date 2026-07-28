import { describe, it, expect } from 'vitest';
import type { Dispatch, SetStateAction } from 'react';
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
  updateNumberSetting,
  updateStringSetting,
  updateOutputMode,
  updateFormat,
  updateAudioVisualizationStyle,
  updateAudioVisualizationColor,
  updateAudioVisualizationBackgroundType,
  updateAudioVisualizationBackgroundColor,
  updateAudioVisualizationBackgroundImagePath,
  updateSubtitleMode,
  updateSubtitleFormat,
  updateExportSidecarSubtitle,
  updateSubtitleLanguageSelection,
  updateSubtitleBurnInLanguage,
  updateScaleMode,
  updateTargetAspectRatio,
  updateReframeOffset,
  updateHardwareEncoding,
  updateHardwareEncoderId,
  updateHardwareEncoderPreset,
  updateHardwareRateControlMode,
  updateHardwareCq,
  updateHardwareVideoBitrate,
  updateHardwareMaxBitrate,
  updateHardwareGopSize,
  updateHardwareBFrames,
  updateLoudnessNormalization,
  updateMasterProcessing,
  updateMasterEqEnabled,
  updateMasterEqBand,
  updateMasterStereoEnabled,
  updateMasterStereoAmount,
  updateMasterLimiterEnabled,
  updateMasterLimiterLevel,
  updateColorManagement,
  updatePostExportScriptCommand,
  updateTimecodeBurnInEnabled,
  updateTimecodeBurnInPosition,
  updateTimecodeBurnInFontSize,
  updateTimecodeBurnInColor,
  updateTimecodeBurnInFrameNumber,
  updateSlateEnabled,
  updateWatermarkEnabled,
  updateWatermarkType,
  updateWatermarkPosition,
  updateImageWatermarkPath,
  updateImageWatermarkScale,
  updateImageWatermarkOpacity,
  updateTextWatermarkText,
} from './exportSettingsHelpers';
import type { ExportPresetSettings } from '../export-presets';
import type { ExportMasterProcessingSettings } from '@open-factory/editor-core';

// Helper: capture the updater function passed to setDraftSettings
function applyUpdate<T>(
  fn: (setter: Dispatch<SetStateAction<T>>, ...args: unknown[]) => void,
  current: T,
  ...args: unknown[]
): T {
  let captured: ((c: T) => T) | undefined;
  const setter = (updater: SetStateAction<T>) => {
    captured = updater as (c: T) => T;
  };
  fn(setter, ...args);
  return captured!(current);
}

const MINIMAL: ExportPresetSettings = {
  width: 1920,
  height: 1080,
  fps: 30,
} as ExportPresetSettings;

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
    expect(normalizeWatermarkPosition('invalid' as unknown)).toBe('bottom-right');
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
    const result = timecodeBurnInFrom({ enabled: false } as unknown);
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
      audioVisualization: { style: 'invalid' as unknown, color: '#fff', background: { type: 'solid', color: '#000' } },
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

describe('updateNumberSetting', () => {
  it('sets valid number', () => {
    const result = applyUpdate(updateNumberSetting as unknown, MINIMAL, 'width', '1280');
    expect(result.width).toBe(1280);
  });

  it('deletes key for empty string', () => {
    const result = applyUpdate(updateNumberSetting as unknown, MINIMAL, 'width', '  ');
    expect(result).not.toHaveProperty('width');
  });

  it('deletes key for non-finite number', () => {
    const result = applyUpdate(updateNumberSetting as unknown, MINIMAL, 'width', 'abc');
    expect(result).not.toHaveProperty('width');
  });

  it('deletes key for zero', () => {
    const result = applyUpdate(updateNumberSetting as unknown, MINIMAL, 'width', '0');
    expect(result).not.toHaveProperty('width');
  });
});

describe('updateStringSetting', () => {
  it('sets trimmed value', () => {
    const result = applyUpdate(updateStringSetting as unknown, MINIMAL, 'videoBitrate', ' 5000k ');
    expect(result.videoBitrate).toBe('5000k');
  });

  it('sets null for empty string', () => {
    const result = applyUpdate(updateStringSetting as unknown, MINIMAL, 'videoBitrate', '  ');
    expect(result.videoBitrate).toBeNull();
  });
});

describe('updateOutputMode', () => {
  it('switches to audio mode', () => {
    const result = applyUpdate(updateOutputMode as unknown, MINIMAL, 'audio');
    expect(result.outputMode).toBe('audio');
    expect(result.format).toBe('m4a');
    expect(result.watermark).toBeNull();
  });

  it('switches to audio-visualization mode', () => {
    const result = applyUpdate(updateOutputMode as unknown, MINIMAL, 'audio-visualization');
    expect(result.outputMode).toBe('audio-visualization');
    expect(result.scaleMode).toBe('none');
  });

  it('switches to video mode from audio', () => {
    const current = { ...MINIMAL, outputMode: 'audio' as const, format: 'm4a' as const };
    const result = applyUpdate(updateOutputMode as unknown, current, 'video');
    expect(result.outputMode).toBe('video');
    expect(result.format).toBe('mp4');
  });
});

describe('updateFormat', () => {
  it('sets m4a format with audio mode', () => {
    const result = applyUpdate(updateFormat as unknown, MINIMAL, 'm4a');
    expect(result.format).toBe('m4a');
    expect(result.outputMode).toBe('audio');
    expect(result.audioCodec).toBe('aac');
  });

  it('sets gif format', () => {
    const result = applyUpdate(updateFormat as unknown, MINIMAL, 'gif');
    expect(result.format).toBe('gif');
    expect(result.videoCodec).toBe('gif');
    expect(result.fps).toBeLessThanOrEqual(30);
  });

  it('sets webm format with vp9 codec', () => {
    const result = applyUpdate(updateFormat as unknown, MINIMAL, 'webm');
    expect(result.format).toBe('webm');
    expect(result.videoCodec).toBe('libvpx-vp9');
    expect(result.audioCodec).toBe('libopus');
  });

  it('sets webp format', () => {
    const result = applyUpdate(updateFormat as unknown, MINIMAL, 'webp');
    expect(result.videoCodec).toBe('libwebp_anim');
  });

  it('sets apng format', () => {
    const result = applyUpdate(updateFormat as unknown, MINIMAL, 'apng');
    expect(result.videoCodec).toBe('apng');
  });

  it('sets png-sequence format', () => {
    const result = applyUpdate(updateFormat as unknown, MINIMAL, 'png-sequence');
    expect(result.videoCodec).toBe('png');
  });
});

describe('updateAudioVisualizationStyle', () => {
  it('sets valid style', () => {
    const result = applyUpdate(updateAudioVisualizationStyle as unknown, MINIMAL, 'spectrum-bars');
    expect(result.audioVisualization?.style).toBe('spectrum-bars');
  });

  it('falls back for invalid style', () => {
    const result = applyUpdate(updateAudioVisualizationStyle as unknown, MINIMAL, 'invalid' as unknown);
    expect(result.audioVisualization?.style).toBe('waveform-line');
  });
});

describe('updateAudioVisualizationColor', () => {
  it('sets color', () => {
    const result = applyUpdate(updateAudioVisualizationColor as unknown, MINIMAL, '#ff0000');
    expect(result.audioVisualization?.color).toBe('#ff0000');
  });
});

describe('updateAudioVisualizationBackgroundType', () => {
  it('sets solid background', () => {
    const result = applyUpdate(updateAudioVisualizationBackgroundType as unknown, MINIMAL, 'solid');
    expect(result.audioVisualization?.background.type).toBe('solid');
  });

  it('sets gradient background', () => {
    const result = applyUpdate(updateAudioVisualizationBackgroundType as unknown, MINIMAL, 'gradient');
    expect(result.audioVisualization?.background.type).toBe('gradient');
  });

  it('sets image background', () => {
    const result = applyUpdate(updateAudioVisualizationBackgroundType as unknown, MINIMAL, 'image');
    expect(result.audioVisualization?.background.type).toBe('image');
  });
});

describe('updateAudioVisualizationBackgroundColor', () => {
  it('sets color on solid background', () => {
    const result = applyUpdate(updateAudioVisualizationBackgroundColor as unknown, MINIMAL, 'color', '#123456');
    expect(result.audioVisualization?.background.type).toBe('solid');
  });

  it('sets color on gradient background', () => {
    const current = {
      ...MINIMAL,
      audioVisualization: { style: 'waveform-line' as const, color: '#fff', background: { type: 'gradient' as const, color: '#111', color2: '#222' } },
    };
    const result = applyUpdate(updateAudioVisualizationBackgroundColor as unknown, current, 'color2', '#333');
    expect(result.audioVisualization?.background.type).toBe('gradient');
  });
});

describe('updateAudioVisualizationBackgroundImagePath', () => {
  it('sets image path', () => {
    const result = applyUpdate(updateAudioVisualizationBackgroundImagePath as unknown, MINIMAL, '/bg.png');
    expect(result.audioVisualization?.background.type).toBe('image');
  });
});

describe('updateSubtitleMode', () => {
  it('sets burn-in mode', () => {
    const result = applyUpdate(updateSubtitleMode as unknown, MINIMAL, 'burn-in');
    expect(result.subtitleMode).toBe('burn-in');
  });

  it('sets soft-sub mode', () => {
    const result = applyUpdate(updateSubtitleMode as unknown, MINIMAL, 'soft-sub');
    expect(result.subtitleMode).toBe('soft-sub');
  });

  it('deletes mode for invalid value', () => {
    const result = applyUpdate(updateSubtitleMode as unknown, MINIMAL, 'off');
    expect(result).not.toHaveProperty('subtitleMode');
  });
});

describe('updateSubtitleFormat', () => {
  it('sets valid format', () => {
    const result = applyUpdate(updateSubtitleFormat as unknown, MINIMAL, 'vtt');
    expect(result.subtitleFormat).toBe('vtt');
  });

  it('defaults to srt for invalid', () => {
    const result = applyUpdate(updateSubtitleFormat as unknown, MINIMAL, 'invalid' as unknown);
    expect(result.subtitleFormat).toBe('srt');
  });
});

describe('updateExportSidecarSubtitle', () => {
  it('sets checked state', () => {
    const result = applyUpdate(updateExportSidecarSubtitle as unknown, MINIMAL, true);
    expect(result.exportSidecarSubtitle).toBe(true);
  });
});

describe('updateSubtitleLanguageSelection', () => {
  it('adds language when checked', () => {
    const result = applyUpdate(
      updateSubtitleLanguageSelection as unknown,
      MINIMAL,
      'en',
      true,
      [{ language: 'en', label: 'English' }, { language: 'zh', label: 'Chinese' }],
    );
    expect(result.subtitleLanguages).toContain('en');
  });

  it('removes language when unchecked', () => {
    const current = { ...MINIMAL, subtitleLanguages: ['en', 'zh'] };
    const result = applyUpdate(
      updateSubtitleLanguageSelection as unknown,
      current,
      'en',
      false,
      [{ language: 'en', label: 'English' }, { language: 'zh', label: 'Chinese' }],
    );
    expect(result.subtitleLanguages).not.toContain('en');
    expect(result.subtitleLanguages).toContain('zh');
  });
});

describe('updateSubtitleBurnInLanguage', () => {
  it('sets burn-in language', () => {
    const result = applyUpdate(updateSubtitleBurnInLanguage as unknown, MINIMAL, 'en');
    expect(result.subtitleBurnInLanguage).toBe('en');
  });
});

describe('updateScaleMode', () => {
  it('sets fit mode', () => {
    const result = applyUpdate(updateScaleMode as unknown, MINIMAL, 'fit');
    expect(result.scaleMode).toBe('fit');
  });

  it('sets none mode for invalid', () => {
    const result = applyUpdate(updateScaleMode as unknown, MINIMAL, 'stretch');
    expect(result.scaleMode).toBe('none');
  });
});

describe('updateTargetAspectRatio', () => {
  it('sets source aspect ratio', () => {
    const result = applyUpdate(updateTargetAspectRatio as unknown, MINIMAL, 'source');
    expect(result.targetAspectRatio).toBe('source');
  });

  it('sets 16:9 aspect ratio with dimensions', () => {
    const result = applyUpdate(updateTargetAspectRatio as unknown, MINIMAL, '16:9');
    expect(result.targetAspectRatio).toBe('16:9');
    expect(result.scaleMode).toBe('none');
  });
});

describe('updateReframeOffset', () => {
  it('sets x offset', () => {
    const result = applyUpdate(updateReframeOffset as unknown, MINIMAL, 'x', '0.5');
    expect(result.reframeOffsetX).toBe(0.5);
  });

  it('sets y offset', () => {
    const result = applyUpdate(updateReframeOffset as unknown, MINIMAL, 'y', '-0.3');
    expect(result.reframeOffsetY).toBe(-0.3);
  });
});

describe('updateHardwareEncoding', () => {
  it('enables hardware encoding', () => {
    const result = applyUpdate(updateHardwareEncoding as unknown, MINIMAL, true);
    expect(result.hardwareEncoding).toBe(true);
  });

  it('disables hardware encoding', () => {
    const result = applyUpdate(updateHardwareEncoding as unknown, MINIMAL, false);
    expect(result.hardwareEncoding).toBe(false);
  });
});

describe('updateHardwareEncoderId', () => {
  it('sets encoder id and enables hardware encoding', () => {
    const result = applyUpdate(updateHardwareEncoderId as unknown, MINIMAL, 'nvenc');
    expect(result.hardwareEncoding).toBe(true);
    expect(result.hardwareEncoderSettings?.encoderId).toBe('nvenc');
  });
});

describe('updateHardwareEncoderPreset', () => {
  it('sets preset', () => {
    const result = applyUpdate(updateHardwareEncoderPreset as unknown, MINIMAL, 'fast');
    expect(result.hardwareEncoderSettings?.preset).toBe('fast');
  });
});

describe('updateHardwareRateControlMode', () => {
  it('sets rate control mode', () => {
    const result = applyUpdate(updateHardwareRateControlMode as unknown, MINIMAL, 'cbr');
    expect(result.hardwareEncoderSettings?.rateControlMode).toBe('cbr');
  });
});

describe('updateHardwareCq', () => {
  it('sets CQ value', () => {
    const result = applyUpdate(updateHardwareCq as unknown, MINIMAL, '23');
    expect(result.hardwareEncoderSettings?.cq).toBe(23);
  });
});

describe('updateHardwareVideoBitrate', () => {
  it('sets video bitrate', () => {
    const result = applyUpdate(updateHardwareVideoBitrate as unknown, MINIMAL, '5000k');
    expect(result.hardwareEncoderSettings?.videoBitrate).toBe('5000k');
  });
});

describe('updateHardwareMaxBitrate', () => {
  it('sets max bitrate', () => {
    const result = applyUpdate(updateHardwareMaxBitrate as unknown, MINIMAL, '8000k');
    expect(result.hardwareEncoderSettings?.maxBitrate).toBe('8000k');
  });
});

describe('updateHardwareGopSize', () => {
  it('sets GOP size', () => {
    const result = applyUpdate(updateHardwareGopSize as unknown, MINIMAL, '60');
    expect(result.hardwareEncoderSettings?.gopSize).toBe(60);
  });
});

describe('updateHardwareBFrames', () => {
  it('sets B-frames', () => {
    const result = applyUpdate(updateHardwareBFrames as unknown, MINIMAL, '3');
    expect(result.hardwareEncoderSettings?.bFrames).toBe(3);
  });
});

describe('updateLoudnessNormalization', () => {
  it('sets youtube mode', () => {
    const result = applyUpdate(updateLoudnessNormalization as unknown, MINIMAL, 'youtube');
    expect(result.loudnessNormalization).toBe('youtube');
  });

  it('sets off for invalid', () => {
    const result = applyUpdate(updateLoudnessNormalization as unknown, MINIMAL, 'invalid');
    expect(result.loudnessNormalization).toBe('off');
  });
});

describe('updateMasterProcessing', () => {
  it('applies updater to normalized processing', () => {
    const result = applyUpdate(updateMasterProcessing as unknown, MINIMAL, (current: ExportMasterProcessingSettings) => ({
      ...current,
      eq: { ...current.eq, enabled: true },
    }));
    expect(result.masterProcessing?.eq.enabled).toBe(true);
  });
});

describe('updateMasterEqEnabled', () => {
  it('enables EQ', () => {
    const result = applyUpdate(updateMasterEqEnabled as unknown, MINIMAL, true);
    expect(result.masterProcessing?.eq.enabled).toBe(true);
  });
});

describe('updateMasterEqBand', () => {
  it('patches band at index', () => {
    const result = applyUpdate(updateMasterEqBand as unknown, MINIMAL, 0, { gain: 5 });
    expect(result.masterProcessing?.eq.bands[0].gain).toBe(5);
  });
});

describe('updateMasterStereoEnabled', () => {
  it('enables stereo enhancer', () => {
    const result = applyUpdate(updateMasterStereoEnabled as unknown, MINIMAL, true);
    expect(result.masterProcessing?.stereoEnhancer.enabled).toBe(true);
  });
});

describe('updateMasterStereoAmount', () => {
  it('sets amount', () => {
    const result = applyUpdate(updateMasterStereoAmount as unknown, MINIMAL, '1.5');
    expect(result.masterProcessing?.stereoEnhancer.amount).toBe(1.5);
  });

  it('clamps to valid range', () => {
    const result = applyUpdate(updateMasterStereoAmount as unknown, MINIMAL, '5');
    expect(result.masterProcessing?.stereoEnhancer.amount).toBeLessThanOrEqual(2);
  });
});

describe('updateMasterLimiterEnabled', () => {
  it('enables limiter', () => {
    const result = applyUpdate(updateMasterLimiterEnabled as unknown, MINIMAL, true);
    expect(result.masterProcessing?.limiter.enabled).toBe(true);
  });
});

describe('updateMasterLimiterLevel', () => {
  it('sets level', () => {
    const result = applyUpdate(updateMasterLimiterLevel as unknown, MINIMAL, '-6');
    expect(result.masterProcessing?.limiter.levelOutDb).toBe(-6);
  });
});

describe('updateColorManagement', () => {
  it('patches color management', () => {
    const result = applyUpdate(updateColorManagement as unknown, MINIMAL, { inputColorSpace: 'rec2020' });
    expect(result.colorManagement?.inputColorSpace).toBe('rec2020');
  });
});

describe('updatePostExportScriptCommand', () => {
  it('sets command', () => {
    const result = applyUpdate(updatePostExportScriptCommand as unknown, MINIMAL, 'echo done');
    expect(result.postExportScript?.command).toBe('echo done');
  });
});

describe('updateTimecodeBurnInEnabled', () => {
  it('enables timecode burn-in', () => {
    const result = applyUpdate(updateTimecodeBurnInEnabled as unknown, MINIMAL, true);
    expect(result.timecodeBurnIn).not.toBeNull();
    expect(result.timecodeBurnIn?.enabled).toBe(true);
  });

  it('disables timecode burn-in', () => {
    const result = applyUpdate(updateTimecodeBurnInEnabled as unknown, MINIMAL, false);
    expect(result.timecodeBurnIn).toBeNull();
  });
});

describe('updateTimecodeBurnInPosition', () => {
  it('sets valid position', () => {
    const result = applyUpdate(updateTimecodeBurnInPosition as unknown, MINIMAL, 'top-left');
    expect(result.timecodeBurnIn?.position).toBe('top-left');
  });

  it('falls back for invalid position', () => {
    const result = applyUpdate(updateTimecodeBurnInPosition as unknown, MINIMAL, 'invalid');
    expect(result.timecodeBurnIn?.position).toBe(DEFAULT_TIMECODE_BURN_IN.position);
  });
});

describe('updateTimecodeBurnInFontSize', () => {
  it('sets font size', () => {
    const result = applyUpdate(updateTimecodeBurnInFontSize as unknown, MINIMAL, '36');
    expect(result.timecodeBurnIn?.fontSize).toBe(36);
  });

  it('clamps to valid range', () => {
    const result = applyUpdate(updateTimecodeBurnInFontSize as unknown, MINIMAL, '200');
    expect(result.timecodeBurnIn?.fontSize).toBeLessThanOrEqual(96);
  });
});

describe('updateTimecodeBurnInColor', () => {
  it('sets color', () => {
    const result = applyUpdate(updateTimecodeBurnInColor as unknown, MINIMAL, 'color', '#ff0000');
    expect(result.timecodeBurnIn?.color).toBe('#ff0000');
  });

  it('sets background color', () => {
    const result = applyUpdate(updateTimecodeBurnInColor as unknown, MINIMAL, 'backgroundColor', '#000000');
    expect(result.timecodeBurnIn?.backgroundColor).toBe('#000000');
  });
});

describe('updateTimecodeBurnInFrameNumber', () => {
  it('enables frame number', () => {
    const result = applyUpdate(updateTimecodeBurnInFrameNumber as unknown, MINIMAL, true);
    expect(result.timecodeBurnIn?.includeFrameNumber).toBe(true);
  });
});

describe('updateSlateEnabled', () => {
  it('enables slate', () => {
    const result = applyUpdate(updateSlateEnabled as unknown, MINIMAL, true);
    expect(result.slate).toEqual({ enabled: true });
  });

  it('disables slate', () => {
    const result = applyUpdate(updateSlateEnabled as unknown, MINIMAL, false);
    expect(result.slate).toBeNull();
  });
});

describe('updateWatermarkEnabled', () => {
  it('enables watermark', () => {
    const result = applyUpdate(updateWatermarkEnabled as unknown, MINIMAL, true);
    expect(result.watermark).not.toBeNull();
  });

  it('disables watermark', () => {
    const result = applyUpdate(updateWatermarkEnabled as unknown, MINIMAL, false);
    expect(result.watermark).toBeNull();
  });
});

describe('updateWatermarkType', () => {
  it('sets image type', () => {
    const result = applyUpdate(updateWatermarkType as unknown, MINIMAL, 'image');
    expect(result.watermark?.type).toBe('image');
  });

  it('sets text type', () => {
    const result = applyUpdate(updateWatermarkType as unknown, MINIMAL, 'text');
    expect(result.watermark?.type).toBe('text');
  });
});

describe('updateWatermarkPosition', () => {
  it('sets valid position', () => {
    const result = applyUpdate(updateWatermarkPosition as unknown, MINIMAL, 'top-left');
    expect(result.watermark?.position).toBe('top-left');
  });

  it('falls back for invalid', () => {
    const result = applyUpdate(updateWatermarkPosition as unknown, MINIMAL, 'invalid');
    expect(result.watermark?.position).toBe('bottom-right');
  });
});

describe('updateImageWatermarkPath', () => {
  it('sets path', () => {
    const result = applyUpdate(updateImageWatermarkPath as unknown, MINIMAL, '/logo.png');
    expect(result.watermark?.type).toBe('image');
  });
});

describe('updateImageWatermarkScale', () => {
  it('sets scale', () => {
    const result = applyUpdate(updateImageWatermarkScale as unknown, MINIMAL, '20');
    expect(result.watermark?.type === 'image' ? result.watermark.scalePercent : null).toBe(20);
  });
});

describe('updateImageWatermarkOpacity', () => {
  it('sets opacity', () => {
    const result = applyUpdate(updateImageWatermarkOpacity as unknown, MINIMAL, '0.5');
    expect(result.watermark?.type === 'image' ? result.watermark.opacity : null).toBe(0.5);
  });
});

describe('updateTextWatermarkText', () => {
  it('sets text', () => {
    const result = applyUpdate(updateTextWatermarkText as unknown, MINIMAL, 'Sample');
    expect(result.watermark?.type === 'text' ? result.watermark.text : null).toBe('Sample');
  });
});
