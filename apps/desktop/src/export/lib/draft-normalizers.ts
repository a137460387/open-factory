import type {
  ExportAudioVisualizationBackground,
  ExportLoudnessNormalization,
  ExportPreviewSampleKind,
  ExportSubtitleFormat,
  ExportWatermarkPosition,
} from '@open-factory/editor-core';
import {
  clampReframeOffset,
  normalizeAudioVisualizationTheme,
  normalizeExportColorManagement,
  normalizeExportMasterProcessing,
  normalizeExportPostScript,
  hasExportMasterProcessing,
  normalizeSubtitleLanguage,
  normalizeSubtitleLanguageList,
  normalizeTargetAspectRatio,
  resolveReframeDimensions,
} from '@open-factory/editor-core';
import type { ExportPresetSettings } from '../export-presets';
import {
  AUDIO_VISUALIZATION_FORMATS,
  DEFAULT_AUDIO_VISUALIZATION,
  DEFAULT_TIMECODE_BURN_IN,
  WATERMARK_POSITIONS,
} from './constants';

// ---------------------------------------------------------------------------
// Preview path builder
// ---------------------------------------------------------------------------

export function buildExportPreviewOutputPaths(appDataDir: string): string[] {
  const root = `${appDataDir.replace(/[\\/]+$/, '')}/export-previews/${Date.now()}`;
  return (['start', 'middle', 'end'] satisfies ExportPreviewSampleKind[]).map((kind) => `${root}/${kind}.png`);
}

// ---------------------------------------------------------------------------
// Low-level normalizers
// ---------------------------------------------------------------------------

export function clampUiNumber(value: string, min: number, max: number, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
}

export function normalizeLoudnessNormalization(value: unknown): ExportLoudnessNormalization {
  return value === 'youtube' || value === 'ebu-r128' ? value : 'off';
}

export function normalizeSubtitleFormat(value: unknown): ExportSubtitleFormat {
  return value === 'vtt' || value === 'ass' || value === 'ssa' ? value : 'srt';
}

export function normalizeHexColor(value: string | undefined, fallback: string): string {
  if (typeof value !== 'string') {
    return fallback;
  }
  const normalized = value.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(normalized)) {
    return normalized.toLowerCase();
  }
  if (/^#[0-9a-fA-F]{3}$/.test(normalized)) {
    return `#${normalized[1]}${normalized[1]}${normalized[2]}${normalized[2]}${normalized[3]}${normalized[3]}`.toLowerCase();
  }
  return fallback;
}

export function isAudioVisualizationFormat(format: string | undefined): format is string {
  return typeof format === 'string' && AUDIO_VISUALIZATION_FORMATS.includes(format);
}

export function normalizeVideoCodecForFormat(format: string, current?: string): string {
  if (format === 'webm') {
    return 'libvpx-vp9';
  }
  if (format === 'gif') {
    return 'gif';
  }
  if (format === 'webp') {
    return 'libwebp_anim';
  }
  if (format === 'apng') {
    return 'apng';
  }
  if (format === 'png-sequence') {
    return 'png';
  }
  return current &&
    current !== 'gif' &&
    current !== 'libwebp_anim' &&
    current !== 'apng' &&
    current !== 'png' &&
    current !== 'libvpx-vp9'
    ? current
    : 'libx264';
}

export function normalizeAudioCodecForFormat(format: string, current?: string): string {
  if (format === 'webm') {
    return 'libopus';
  }
  return current && current !== 'libopus' ? current : 'aac';
}

export function normalizeAudioVisualizationDraft(
  value: ExportPresetSettings['audioVisualization'],
): NonNullable<ExportPresetSettings['audioVisualization']> {
  const style =
    value?.style === 'spectrum-bars' || value?.style === 'circular-spectrum' || value?.style === 'waveform-line'
      ? value.style
      : DEFAULT_AUDIO_VISUALIZATION.style;
  const normalized: NonNullable<ExportPresetSettings['audioVisualization']> = {
    style,
    color: normalizeHexColor(value?.color, DEFAULT_AUDIO_VISUALIZATION.color),
    background: normalizeAudioVisualizationBackgroundDraft(value?.background),
  };
  if (typeof value?.themeId === 'string' && value.themeId.trim()) {
    normalized.themeId = value.themeId.trim();
  }
  if (value?.theme && typeof value.theme === 'object') {
    normalized.theme = normalizeAudioVisualizationTheme(value.theme);
  }
  return normalized;
}

export function normalizeAudioVisualizationBackgroundDraft(
  value: NonNullable<ExportPresetSettings['audioVisualization']>['background'] | undefined,
): ExportAudioVisualizationBackground {
  if (value?.type === 'image' && value.path.trim()) {
    return { type: 'image', path: value.path.trim() };
  }
  if (value?.type === 'gradient') {
    return {
      type: 'gradient',
      color: normalizeHexColor(value.color, '#050816'),
      color2: normalizeHexColor(value.color2, '#1d4ed8'),
    };
  }
  if (value?.type === 'solid') {
    return { type: 'solid', color: normalizeHexColor(value.color, '#050816') };
  }
  return DEFAULT_AUDIO_VISUALIZATION.background;
}

export function normalizeTimecodeBurnInDraft(
  value: ExportPresetSettings['timecodeBurnIn'],
): ExportPresetSettings['timecodeBurnIn'] {
  if (!value?.enabled) {
    return null;
  }
  return {
    enabled: true,
    position: normalizeWatermarkPosition(value.position),
    fontSize: Math.round(
      clampUiNumber(
        String(value.fontSize ?? DEFAULT_TIMECODE_BURN_IN.fontSize),
        8,
        96,
        DEFAULT_TIMECODE_BURN_IN.fontSize,
      ),
    ),
    color: normalizeHexColor(value.color, DEFAULT_TIMECODE_BURN_IN.color),
    backgroundColor: normalizeHexColor(value.backgroundColor, DEFAULT_TIMECODE_BURN_IN.backgroundColor),
    includeFrameNumber: value.includeFrameNumber === true,
  };
}

export function normalizeWatermarkPosition(position: ExportWatermarkPosition | undefined): ExportWatermarkPosition {
  return typeof position === 'string' && isWatermarkPosition(position) ? position : 'bottom-right';
}

export function isWatermarkPosition(value: string): value is ExportWatermarkPosition {
  return WATERMARK_POSITIONS.includes(value as ExportWatermarkPosition);
}

// ---------------------------------------------------------------------------
// Full draft normalizer
// ---------------------------------------------------------------------------

export function normalizeDraftSettings(settings: ExportPresetSettings): ExportPresetSettings {
  let format = settings.format ?? 'mp4';
  const animatedImage = format === 'gif' || format === 'webp' || format === 'apng';
  let outputMode = settings.outputMode ?? (format === 'm4a' ? 'audio' : 'video');
  if (outputMode !== 'audio' && outputMode !== 'audio-visualization') {
    outputMode = 'video';
  }
  if (outputMode === 'audio') {
    format = 'm4a';
  } else if (outputMode === 'audio-visualization') {
    format = isAudioVisualizationFormat(format) ? format : 'mp4';
  } else if (format === 'm4a') {
    outputMode = 'audio';
  } else if (animatedImage) {
    outputMode = 'video';
  }
  const normalizedAnimatedImage = format === 'gif' || format === 'webp' || format === 'apng';
  const hardwareEncoding =
    outputMode !== 'audio' && (format === 'mp4' || format === 'mov') && settings.hardwareEncoding === true;
  const targetAspectRatio = outputMode === 'video' ? normalizeTargetAspectRatio(settings.targetAspectRatio) : 'source';
  const dimensions = resolveReframeDimensions(settings.width ?? 1280, settings.height ?? 720, targetAspectRatio);
  const loudnessNormalization = supportsLoudnessNormalization(format, outputMode)
    ? normalizeLoudnessNormalization(settings.loudnessNormalization)
    : 'off';
  const visualExportSettingsEnabled = outputMode === 'video' && !normalizedAnimatedImage;
  const watermark = visualExportSettingsEnabled ? (settings.watermark ?? null) : null;
  const timecodeBurnIn = visualExportSettingsEnabled ? normalizeTimecodeBurnInDraft(settings.timecodeBurnIn) : null;
  const slate = visualExportSettingsEnabled && settings.slate?.enabled === true ? { enabled: true } : null;
  const colorManagement = normalizeExportColorManagement(settings.colorManagement);
  const postExportScript = normalizeExportPostScript(settings.postExportScript);
  const masterProcessing = normalizeExportMasterProcessing(settings.masterProcessing);
  return {
    ...settings,
    width: targetAspectRatio === 'source' ? settings.width : dimensions.width,
    height: targetAspectRatio === 'source' ? settings.height : dimensions.height,
    format,
    outputMode,
    videoCodec:
      outputMode !== 'audio' ? normalizeVideoCodecForFormat(format, settings.videoCodec) : settings.videoCodec,
    audioCodec: normalizeAudioCodecForFormat(format, settings.audioCodec),
    hardwareEncoding,
    loudnessNormalization,
    subtitleFormat: normalizeSubtitleFormat(settings.subtitleFormat),
    exportSidecarSubtitle: settings.exportSidecarSubtitle === true,
    subtitleLanguages: normalizeSubtitleLanguageList(settings.subtitleLanguages),
    subtitleBurnInLanguage: settings.subtitleBurnInLanguage
      ? normalizeSubtitleLanguage(settings.subtitleBurnInLanguage)
      : undefined,
    targetAspectRatio,
    reframeOffsetX: clampReframeOffset(settings.reframeOffsetX),
    reframeOffsetY: clampReframeOffset(settings.reframeOffsetY),
    watermark,
    timecodeBurnIn,
    slate,
    colorManagement,
    postExportScript,
    masterProcessing: hasExportMasterProcessing(masterProcessing) ? masterProcessing : null,
    audioVisualization: normalizeAudioVisualizationDraft(settings.audioVisualization),
  };
}

export function supportsLoudnessNormalization(format: string, outputMode: ExportPresetSettings['outputMode']): boolean {
  if (outputMode === 'audio' || format === 'm4a') {
    return true;
  }
  return format !== 'gif' && format !== 'webp' && format !== 'apng' && format !== 'png-sequence';
}

export function timecodeBurnInFrom(
  value: ExportPresetSettings['timecodeBurnIn'],
): NonNullable<ExportPresetSettings['timecodeBurnIn']> {
  if (value?.enabled) {
    const normalized = normalizeTimecodeBurnInDraft(value) ?? DEFAULT_TIMECODE_BURN_IN;
    return {
      ...DEFAULT_TIMECODE_BURN_IN,
      ...normalized,
      enabled: true,
    };
  }
  return { ...DEFAULT_TIMECODE_BURN_IN };
}
