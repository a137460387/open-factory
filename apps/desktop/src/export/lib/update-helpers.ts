import type { Dispatch, SetStateAction } from 'react';
import {
  clampReframeOffset,
  DEFAULT_EXPORT_MASTER_PROCESSING,
  expandAudioVisualizationTheme,
  normalizeExportColorManagement,
  normalizeExportMasterProcessing,
  normalizeExportPostScript,
  normalizeSubtitleLanguage,
  normalizeSubtitleLanguageList,
  normalizeTargetAspectRatio,
  resolveReframeDimensions,
  type AudioVisualizationThemeDefinition,
  type CustomAudioVisualizationTheme,
  type ExportAudioVisualizationBackground,
  type ExportAudioVisualizationStyle,
  type ExportMasterProcessingSettings,
} from '@open-factory/editor-core';
import type { ExportPresetSettings } from '../export-presets';
import {
  AUDIO_VISUALIZATION_BACKGROUND_TYPES,
  AUDIO_VISUALIZATION_STYLES,
  DEFAULT_AUDIO_VISUALIZATION,
  DEFAULT_TIMECODE_BURN_IN,
  MANUAL_AUDIO_VISUALIZATION_THEME_ID,
  type SubtitleLanguageOption,
} from './constants';
import {
  clampUiNumber,
  isAudioVisualizationFormat,
  isWatermarkPosition,
  normalizeAudioCodecForFormat,
  normalizeAudioVisualizationDraft,
  normalizeHexColor,
  normalizeLoudnessNormalization,
  normalizeSubtitleFormat,
  normalizeVideoCodecForFormat,
  timecodeBurnInFrom,
} from './draft-normalizers';
import {
  enableWatermark,
  imageWatermarkFrom,
  textWatermarkFrom,
} from './watermark-helpers';

// ---------------------------------------------------------------------------
// Settings update helpers
// ---------------------------------------------------------------------------

export function updateNumberSetting(
  setDraftSettings: Dispatch<SetStateAction<ExportPresetSettings>>,
  key: 'width' | 'height' | 'fps',
  value: string,
): void {
  setDraftSettings((current) => {
    const next = { ...current };
    const parsed = Number(value);
    if (value.trim() && Number.isFinite(parsed) && parsed > 0) {
      next[key] = parsed;
    } else {
      delete next[key];
    }
    return next;
  });
}

export function updateStringSetting(
  setDraftSettings: Dispatch<SetStateAction<ExportPresetSettings>>,
  key: 'videoBitrate' | 'audioBitrate',
  value: string,
): void {
  setDraftSettings((current) => ({ ...current, [key]: value.trim() || null }));
}

export function updateOutputMode(
  setDraftSettings: Dispatch<SetStateAction<ExportPresetSettings>>,
  value: string,
): void {
  setDraftSettings((current) => {
    if (value === 'audio') {
      return {
        ...current,
        outputMode: 'audio',
        format: 'm4a',
        audioCodec: 'aac',
        videoBitrate: null,
        watermark: null,
        timecodeBurnIn: null,
        slate: null,
        targetAspectRatio: 'source',
        hardwareEncoding: false,
      };
    }
    if (value === 'audio-visualization') {
      const format = isAudioVisualizationFormat(current.format) ? current.format : 'mp4';
      return {
        ...current,
        outputMode: 'audio-visualization',
        format,
        videoCodec: normalizeVideoCodecForFormat(format, current.videoCodec),
        audioCodec: normalizeAudioCodecForFormat(format, current.audioCodec),
        audioVisualization: normalizeAudioVisualizationDraft(current.audioVisualization),
        scaleMode: 'none',
        targetAspectRatio: 'source',
        watermark: null,
        timecodeBurnIn: null,
        slate: null,
      };
    }
    const format = current.format === 'm4a' ? 'mp4' : (current.format ?? 'mp4');
    return {
      ...current,
      outputMode: 'video',
      format,
      videoCodec: normalizeVideoCodecForFormat(format, current.videoCodec),
      audioCodec: normalizeAudioCodecForFormat(format, current.audioCodec),
      hardwareEncoding: format === 'mp4' || format === 'mov' ? current.hardwareEncoding : false,
    };
  });
}

export function updateFormat(setDraftSettings: Dispatch<SetStateAction<ExportPresetSettings>>, value: string): void {
  setDraftSettings((current) => {
    const next: ExportPresetSettings = { ...current, format: value };
    if (value === 'm4a') {
      next.outputMode = 'audio';
      next.audioCodec = 'aac';
      delete next.videoCodec;
      delete next.videoBitrate;
      delete next.hardwareEncoding;
      return next;
    }
    if (value === 'png-sequence') {
      next.outputMode = current.outputMode === 'audio-visualization' ? 'audio-visualization' : 'video';
      if (next.outputMode === 'audio-visualization') {
        next.format = 'mp4';
        next.videoCodec = 'libx264';
        next.audioCodec = 'aac';
        next.audioVisualization = normalizeAudioVisualizationDraft(current.audioVisualization);
        return next;
      }
      next.videoCodec = 'png';
      next.audioCodec = 'aac';
      delete next.videoBitrate;
      delete next.audioBitrate;
      delete next.hardwareEncoding;
      return next;
    }
    if (value === 'gif') {
      next.outputMode = current.outputMode === 'audio-visualization' ? 'audio-visualization' : 'video';
      if (next.outputMode === 'audio-visualization') {
        next.format = 'mp4';
        next.videoCodec = 'libx264';
        next.audioCodec = 'aac';
        next.audioVisualization = normalizeAudioVisualizationDraft(current.audioVisualization);
        return next;
      }
      next.videoCodec = 'gif';
      next.audioCodec = 'aac';
      next.fps = Math.min(30, next.fps ?? 30);
      delete next.audioBitrate;
      delete next.hardwareEncoding;
      return next;
    }
    if (value === 'webp') {
      next.outputMode = current.outputMode === 'audio-visualization' ? 'audio-visualization' : 'video';
      if (next.outputMode === 'audio-visualization') {
        next.format = 'mp4';
        next.videoCodec = 'libx264';
        next.audioCodec = 'aac';
        next.audioVisualization = normalizeAudioVisualizationDraft(current.audioVisualization);
        return next;
      }
      next.videoCodec = 'libwebp_anim';
      next.audioCodec = 'aac';
      delete next.hardwareEncoding;
      return next;
    }
    if (value === 'apng') {
      next.outputMode = current.outputMode === 'audio-visualization' ? 'audio-visualization' : 'video';
      if (next.outputMode === 'audio-visualization') {
        next.format = 'mp4';
        next.videoCodec = 'libx264';
        next.audioCodec = 'aac';
        next.audioVisualization = normalizeAudioVisualizationDraft(current.audioVisualization);
        return next;
      }
      next.videoCodec = 'apng';
      next.audioCodec = 'aac';
      delete next.hardwareEncoding;
      return next;
    }
    next.outputMode =
      current.outputMode === 'audio-visualization' && isAudioVisualizationFormat(value)
        ? 'audio-visualization'
        : 'video';
    if (value === 'webm') {
      next.videoCodec = 'libvpx-vp9';
      next.audioCodec = 'libopus';
      delete next.hardwareEncoding;
    } else {
      next.videoCodec = 'libx264';
      next.audioCodec = 'aac';
      if (value !== 'mp4' && value !== 'mov') {
        delete next.hardwareEncoding;
      }
    }
    if (next.outputMode === 'audio-visualization') {
      next.audioVisualization = normalizeAudioVisualizationDraft(current.audioVisualization);
      next.scaleMode = 'none';
      next.targetAspectRatio = 'source';
      next.watermark = null;
    }
    return next;
  });
}

export function updateAudioVisualizationStyle(
  setDraftSettings: Dispatch<SetStateAction<ExportPresetSettings>>,
  value: string,
): void {
  setDraftSettings((current) => ({
    ...current,
    audioVisualization: {
      ...normalizeAudioVisualizationDraft(current.audioVisualization),
      style: AUDIO_VISUALIZATION_STYLES.includes(value as ExportAudioVisualizationStyle)
        ? (value as ExportAudioVisualizationStyle)
        : 'waveform-line',
    },
  }));
}

export function updateAudioVisualizationTheme(
  setDraftSettings: Dispatch<SetStateAction<ExportPresetSettings>>,
  theme: AudioVisualizationThemeDefinition | undefined,
  customThemes: readonly CustomAudioVisualizationTheme[],
): void {
  setDraftSettings((current) => {
    const visualization = normalizeAudioVisualizationDraft(current.audioVisualization);
    if (!theme) {
      const nextVisualization = {
        ...visualization,
        themeId: MANUAL_AUDIO_VISUALIZATION_THEME_ID,
      };
      delete nextVisualization.theme;
      return { ...current, audioVisualization: nextVisualization };
    }
    const isCustom = customThemes.some((item) => item.id === theme.id);
    const expanded = expandAudioVisualizationTheme({ themeId: theme.id, theme: isCustom ? theme : undefined });
    const nextVisualization: NonNullable<ExportPresetSettings['audioVisualization']> = {
      ...visualization,
      themeId: theme.id,
      color: expanded.colorStart,
      background: audioVisualizationBackgroundFromTheme(expanded.background),
    };
    if (isCustom) {
      nextVisualization.theme = theme;
    } else {
      delete nextVisualization.theme;
    }
    return {
      ...current,
      audioVisualization: nextVisualization,
    };
  });
}

export function updateAudioVisualizationColor(
  setDraftSettings: Dispatch<SetStateAction<ExportPresetSettings>>,
  value: string,
): void {
  setDraftSettings((current) => {
    const nextVisualization = {
      ...normalizeAudioVisualizationDraft(current.audioVisualization),
      color: normalizeHexColor(value, DEFAULT_AUDIO_VISUALIZATION.color),
      themeId: MANUAL_AUDIO_VISUALIZATION_THEME_ID,
    };
    delete nextVisualization.theme;
    return { ...current, audioVisualization: nextVisualization };
  });
}

export function updateAudioVisualizationBackgroundType(
  setDraftSettings: Dispatch<SetStateAction<ExportPresetSettings>>,
  value: string,
): void {
  setDraftSettings((current) => {
    const visualization = normalizeAudioVisualizationDraft(current.audioVisualization);
    const type = AUDIO_VISUALIZATION_BACKGROUND_TYPES.includes(value as ExportAudioVisualizationBackground['type'])
      ? (value as ExportAudioVisualizationBackground['type'])
      : 'solid';
    const nextVisualization = {
      ...visualization,
      themeId: MANUAL_AUDIO_VISUALIZATION_THEME_ID,
      background:
        type === 'image'
          ? {
              type: 'image' as const,
              path: visualization.background.type === 'image' ? visualization.background.path : '',
            }
          : type === 'gradient'
            ? { type: 'gradient' as const, color: backgroundPrimaryColor(visualization.background), color2: '#1d4ed8' }
            : { type: 'solid' as const, color: backgroundPrimaryColor(visualization.background) },
    };
    delete nextVisualization.theme;
    return {
      ...current,
      audioVisualization: nextVisualization,
    };
  });
}

export function updateAudioVisualizationBackgroundColor(
  setDraftSettings: Dispatch<SetStateAction<ExportPresetSettings>>,
  key: 'color' | 'color2',
  value: string,
): void {
  setDraftSettings((current) => {
    const visualization = normalizeAudioVisualizationDraft(current.audioVisualization);
    const background = visualization.background;
    if (background.type === 'gradient') {
      const nextVisualization: NonNullable<ExportPresetSettings['audioVisualization']> = {
        ...visualization,
        themeId: MANUAL_AUDIO_VISUALIZATION_THEME_ID,
        background: { ...background, [key]: normalizeHexColor(value, key === 'color' ? '#050816' : '#1d4ed8') },
      };
      delete nextVisualization.theme;
      return {
        ...current,
        audioVisualization: nextVisualization,
      };
    }
    const nextVisualization: NonNullable<ExportPresetSettings['audioVisualization']> = {
      ...visualization,
      themeId: MANUAL_AUDIO_VISUALIZATION_THEME_ID,
      background: { type: 'solid' as const, color: normalizeHexColor(value, '#050816') },
    };
    delete nextVisualization.theme;
    return {
      ...current,
      audioVisualization: nextVisualization,
    };
  });
}

export function updateAudioVisualizationBackgroundImagePath(
  setDraftSettings: Dispatch<SetStateAction<ExportPresetSettings>>,
  path: string,
): void {
  setDraftSettings((current) => {
    const visualization = normalizeAudioVisualizationDraft(current.audioVisualization);
    const nextVisualization = {
      ...visualization,
      themeId: MANUAL_AUDIO_VISUALIZATION_THEME_ID,
      background: { type: 'image' as const, path },
    };
    delete nextVisualization.theme;
    return {
      ...current,
      audioVisualization: nextVisualization,
    };
  });
}

function audioVisualizationBackgroundFromTheme(
  background: ReturnType<typeof expandAudioVisualizationTheme>['background'],
): ExportAudioVisualizationBackground {
  return background.type === 'gradient'
    ? { type: 'gradient', color: background.color, color2: background.color2 }
    : { type: 'solid', color: background.color };
}

function backgroundPrimaryColor(background: ExportAudioVisualizationBackground): string {
  return background.type === 'image' ? '#050816' : background.color;
}

export function updateSubtitleMode(
  setDraftSettings: Dispatch<SetStateAction<ExportPresetSettings>>,
  value: string,
): void {
  setDraftSettings((current) => {
    const next = { ...current };
    if (value === 'burn-in' || value === 'soft-sub') {
      next.subtitleMode = value;
    } else {
      delete next.subtitleMode;
    }
    return next;
  });
}

export function updateSubtitleFormat(
  setDraftSettings: Dispatch<SetStateAction<ExportPresetSettings>>,
  value: string,
): void {
  setDraftSettings((current) => ({ ...current, subtitleFormat: normalizeSubtitleFormat(value) }));
}

export function updateExportSidecarSubtitle(
  setDraftSettings: Dispatch<SetStateAction<ExportPresetSettings>>,
  checked: boolean,
): void {
  setDraftSettings((current) => ({ ...current, exportSidecarSubtitle: checked }));
}

export function updateSubtitleLanguageSelection(
  setDraftSettings: Dispatch<SetStateAction<ExportPresetSettings>>,
  language: string,
  checked: boolean,
  options: { language: string; label: string; trackCount: number }[],
): void {
  const normalized = normalizeSubtitleLanguage(language);
  setDraftSettings((current) => {
    const selected =
      normalizeSubtitleLanguageList(current.subtitleLanguages) ?? options.map((option) => option.language);
    const next = checked
      ? Array.from(new Set([...selected, normalized]))
      : selected.filter((item) => item !== normalized);
    const available = new Set(options.map((option) => option.language));
    return {
      ...current,
      subtitleLanguages: next.filter((item) => available.has(item)),
    };
  });
}

export function updateSubtitleBurnInLanguage(
  setDraftSettings: Dispatch<SetStateAction<ExportPresetSettings>>,
  language: string,
): void {
  setDraftSettings((current) => ({ ...current, subtitleBurnInLanguage: normalizeSubtitleLanguage(language) }));
}

export function updateScaleMode(setDraftSettings: Dispatch<SetStateAction<ExportPresetSettings>>, value: string): void {
  setDraftSettings((current) => ({ ...current, scaleMode: value === 'fit' ? 'fit' : 'none' }));
}

export function updateTargetAspectRatio(
  setDraftSettings: Dispatch<SetStateAction<ExportPresetSettings>>,
  value: string,
): void {
  setDraftSettings((current) => {
    const targetAspectRatio = normalizeTargetAspectRatio(value);
    if (targetAspectRatio === 'source') {
      return { ...current, targetAspectRatio };
    }
    const dimensions = resolveReframeDimensions(current.width ?? 1280, current.height ?? 720, targetAspectRatio);
    return {
      ...current,
      ...dimensions,
      targetAspectRatio,
      scaleMode: 'none',
      reframeOffsetX: clampReframeOffset(current.reframeOffsetX),
      reframeOffsetY: clampReframeOffset(current.reframeOffsetY),
    };
  });
}

export function updateReframeOffset(
  setDraftSettings: Dispatch<SetStateAction<ExportPresetSettings>>,
  axis: 'x' | 'y',
  value: string,
): void {
  const key = axis === 'x' ? 'reframeOffsetX' : 'reframeOffsetY';
  setDraftSettings((current) => ({ ...current, [key]: clampReframeOffset(Number(value)) }));
}

export function updateHardwareEncoding(
  setDraftSettings: Dispatch<SetStateAction<ExportPresetSettings>>,
  checked: boolean,
): void {
  setDraftSettings((current) => ({ ...current, hardwareEncoding: checked }));
}
export function updateHardwareEncoderId(s: Dispatch<SetStateAction<ExportPresetSettings>>, v: string): void {
  s((c) => ({
    ...c,
    hardwareEncoding: true,
    hardwareEncoderSettings: {
      ...(c.hardwareEncoderSettings ?? {}),
      encoderId: v as import('@open-factory/editor-core').HardwareEncoderId,
    },
  }));
}
export function updateHardwareEncoderPreset(s: Dispatch<SetStateAction<ExportPresetSettings>>, v: string): void {
  s((c) => ({
    ...c,
    hardwareEncoderSettings: {
      ...(c.hardwareEncoderSettings ?? {}),
      preset: v,
    } as import('@open-factory/editor-core').HardwareEncoderSettings,
  }));
}
export function updateHardwareRateControlMode(s: Dispatch<SetStateAction<ExportPresetSettings>>, v: string): void {
  s((c) => ({
    ...c,
    hardwareEncoderSettings: {
      ...(c.hardwareEncoderSettings ?? {}),
      rateControlMode: v as import('@open-factory/editor-core').HardwareRateControlMode,
    } as import('@open-factory/editor-core').HardwareEncoderSettings,
  }));
}
export function updateHardwareCq(s: Dispatch<SetStateAction<ExportPresetSettings>>, v: string): void {
  s((c) => ({ ...c, hardwareEncoderSettings: { ...(c.hardwareEncoderSettings ?? {}), cq: Number(v) } }));
}
export function updateHardwareVideoBitrate(s: Dispatch<SetStateAction<ExportPresetSettings>>, v: string): void {
  s((c) => ({ ...c, hardwareEncoderSettings: { ...(c.hardwareEncoderSettings ?? {}), videoBitrate: v } }));
}
export function updateHardwareMaxBitrate(s: Dispatch<SetStateAction<ExportPresetSettings>>, v: string): void {
  s((c) => ({ ...c, hardwareEncoderSettings: { ...(c.hardwareEncoderSettings ?? {}), maxBitrate: v } }));
}
export function updateHardwareGopSize(s: Dispatch<SetStateAction<ExportPresetSettings>>, v: string): void {
  s((c) => ({ ...c, hardwareEncoderSettings: { ...(c.hardwareEncoderSettings ?? {}), gopSize: Number(v) } }));
}
export function updateHardwareBFrames(s: Dispatch<SetStateAction<ExportPresetSettings>>, v: string): void {
  s((c) => ({ ...c, hardwareEncoderSettings: { ...(c.hardwareEncoderSettings ?? {}), bFrames: Number(v) } }));
}

export function updateLoudnessNormalization(
  setDraftSettings: Dispatch<SetStateAction<ExportPresetSettings>>,
  value: string,
): void {
  setDraftSettings((current) => ({ ...current, loudnessNormalization: normalizeLoudnessNormalization(value) }));
}

export function updateMasterProcessing(
  setDraftSettings: Dispatch<SetStateAction<ExportPresetSettings>>,
  updater: (current: ExportMasterProcessingSettings) => ExportMasterProcessingSettings,
): void {
  setDraftSettings((current) => ({
    ...current,
    masterProcessing: updater(normalizeExportMasterProcessing(current.masterProcessing)),
  }));
}

export function updateMasterEqEnabled(
  setDraftSettings: Dispatch<SetStateAction<ExportPresetSettings>>,
  enabled: boolean,
): void {
  updateMasterProcessing(setDraftSettings, (current) => ({ ...current, eq: { ...current.eq, enabled } }));
}

export function updateMasterEqBand(
  setDraftSettings: Dispatch<SetStateAction<ExportPresetSettings>>,
  index: number,
  patch: Partial<ExportMasterProcessingSettings['eq']['bands'][number]>,
): void {
  updateMasterProcessing(setDraftSettings, (current) => ({
    ...current,
    eq: {
      ...current.eq,
      bands: current.eq.bands.map((band, bandIndex) => (bandIndex === index ? { ...band, ...patch } : band)),
    },
  }));
}

export function updateMasterStereoEnabled(
  setDraftSettings: Dispatch<SetStateAction<ExportPresetSettings>>,
  enabled: boolean,
): void {
  updateMasterProcessing(setDraftSettings, (current) => ({
    ...current,
    stereoEnhancer: { ...current.stereoEnhancer, enabled },
  }));
}

export function updateMasterStereoAmount(
  setDraftSettings: Dispatch<SetStateAction<ExportPresetSettings>>,
  value: string,
): void {
  updateMasterProcessing(setDraftSettings, (current) => ({
    ...current,
    stereoEnhancer: {
      ...current.stereoEnhancer,
      amount: clampUiNumber(value, 0, 2, DEFAULT_EXPORT_MASTER_PROCESSING.stereoEnhancer.amount),
    },
  }));
}

export function updateMasterLimiterEnabled(
  setDraftSettings: Dispatch<SetStateAction<ExportPresetSettings>>,
  enabled: boolean,
): void {
  updateMasterProcessing(setDraftSettings, (current) => ({ ...current, limiter: { ...current.limiter, enabled } }));
}

export function updateMasterLimiterLevel(
  setDraftSettings: Dispatch<SetStateAction<ExportPresetSettings>>,
  value: string,
): void {
  updateMasterProcessing(setDraftSettings, (current) => ({
    ...current,
    limiter: {
      ...current.limiter,
      levelOutDb: clampUiNumber(value, -24, 0, DEFAULT_EXPORT_MASTER_PROCESSING.limiter.levelOutDb),
    },
  }));
}

export function updateColorManagement(
  setDraftSettings: Dispatch<SetStateAction<ExportPresetSettings>>,
  patch: Partial<NonNullable<ExportPresetSettings['colorManagement']>>,
): void {
  setDraftSettings((current) => ({
    ...current,
    colorManagement: { ...normalizeExportColorManagement(current.colorManagement), ...patch },
  }));
}

export function updatePostExportScriptCommand(
  setDraftSettings: Dispatch<SetStateAction<ExportPresetSettings>>,
  command: string,
): void {
  setDraftSettings((current) => ({ ...current, postExportScript: normalizeExportPostScript({ command }) }));
}

export function updateTimecodeBurnInEnabled(
  setDraftSettings: Dispatch<SetStateAction<ExportPresetSettings>>,
  checked: boolean,
): void {
  setDraftSettings((current) => ({
    ...current,
    timecodeBurnIn: checked ? timecodeBurnInFrom(current.timecodeBurnIn) : null,
  }));
}

export function updateTimecodeBurnInPosition(
  setDraftSettings: Dispatch<SetStateAction<ExportPresetSettings>>,
  value: string,
): void {
  const position = isWatermarkPosition(value) ? value : DEFAULT_TIMECODE_BURN_IN.position;
  setDraftSettings((current) => ({
    ...current,
    timecodeBurnIn: { ...timecodeBurnInFrom(current.timecodeBurnIn), position },
  }));
}

export function updateTimecodeBurnInFontSize(
  setDraftSettings: Dispatch<SetStateAction<ExportPresetSettings>>,
  value: string,
): void {
  setDraftSettings((current) => ({
    ...current,
    timecodeBurnIn: {
      ...timecodeBurnInFrom(current.timecodeBurnIn),
      fontSize: Math.round(clampUiNumber(value, 8, 96, DEFAULT_TIMECODE_BURN_IN.fontSize)),
    },
  }));
}

export function updateTimecodeBurnInColor(
  setDraftSettings: Dispatch<SetStateAction<ExportPresetSettings>>,
  key: 'color' | 'backgroundColor',
  value: string,
): void {
  const fallback = key === 'color' ? DEFAULT_TIMECODE_BURN_IN.color : DEFAULT_TIMECODE_BURN_IN.backgroundColor;
  setDraftSettings((current) => ({
    ...current,
    timecodeBurnIn: { ...timecodeBurnInFrom(current.timecodeBurnIn), [key]: normalizeHexColor(value, fallback) },
  }));
}

export function updateTimecodeBurnInFrameNumber(
  setDraftSettings: Dispatch<SetStateAction<ExportPresetSettings>>,
  checked: boolean,
): void {
  setDraftSettings((current) => ({
    ...current,
    timecodeBurnIn: { ...timecodeBurnInFrom(current.timecodeBurnIn), includeFrameNumber: checked },
  }));
}

export function updateSlateEnabled(
  setDraftSettings: Dispatch<SetStateAction<ExportPresetSettings>>,
  checked: boolean,
): void {
  setDraftSettings((current) => ({ ...current, slate: checked ? { enabled: true } : null }));
}

export function updateWatermarkEnabled(
  setDraftSettings: Dispatch<SetStateAction<ExportPresetSettings>>,
  checked: boolean,
): void {
  setDraftSettings((current) => ({ ...current, watermark: checked ? enableWatermark(current.watermark) : null }));
}

export function updateWatermarkType(
  setDraftSettings: Dispatch<SetStateAction<ExportPresetSettings>>,
  value: string,
): void {
  setDraftSettings((current) => ({
    ...current,
    watermark: value === 'image' ? imageWatermarkFrom(current.watermark) : textWatermarkFrom(current.watermark),
  }));
}

export function updateWatermarkPosition(
  setDraftSettings: Dispatch<SetStateAction<ExportPresetSettings>>,
  value: string,
): void {
  const position = isWatermarkPosition(value) ? value : 'bottom-right';
  setDraftSettings((current) => {
    const watermark = enableWatermark(current.watermark);
    return { ...current, watermark: { ...watermark, position } };
  });
}

export function updateImageWatermarkPath(
  setDraftSettings: Dispatch<SetStateAction<ExportPresetSettings>>,
  path: string,
): void {
  setDraftSettings((current) => ({ ...current, watermark: { ...imageWatermarkFrom(current.watermark), path } }));
}

export function updateImageWatermarkScale(
  setDraftSettings: Dispatch<SetStateAction<ExportPresetSettings>>,
  value: string,
): void {
  setDraftSettings((current) => ({
    ...current,
    watermark: { ...imageWatermarkFrom(current.watermark), scalePercent: clampUiNumber(value, 1, 50, 12) },
  }));
}

export function updateImageWatermarkOpacity(
  setDraftSettings: Dispatch<SetStateAction<ExportPresetSettings>>,
  value: string,
): void {
  setDraftSettings((current) => ({
    ...current,
    watermark: { ...imageWatermarkFrom(current.watermark), opacity: clampUiNumber(value, 0, 1, 0.75) },
  }));
}

export function updateTextWatermarkText(
  setDraftSettings: Dispatch<SetStateAction<ExportPresetSettings>>,
  value: string,
): void {
  setDraftSettings((current) => ({ ...current, watermark: { ...textWatermarkFrom(current.watermark), text: value } }));
}

export function updateTextWatermarkFont(
  setDraftSettings: Dispatch<SetStateAction<ExportPresetSettings>>,
  value: string,
): void {
  setDraftSettings((current) => ({
    ...current,
    watermark: { ...textWatermarkFrom(current.watermark), fontFamily: value },
  }));
}

export function updateTextWatermarkColor(
  setDraftSettings: Dispatch<SetStateAction<ExportPresetSettings>>,
  value: string,
): void {
  setDraftSettings((current) => ({ ...current, watermark: { ...textWatermarkFrom(current.watermark), color: value } }));
}

export function updateTextWatermarkSize(
  setDraftSettings: Dispatch<SetStateAction<ExportPresetSettings>>,
  value: string,
): void {
  setDraftSettings((current) => ({
    ...current,
    watermark: { ...textWatermarkFrom(current.watermark), fontSize: Math.round(clampUiNumber(value, 8, 240, 36)) },
  }));
}
