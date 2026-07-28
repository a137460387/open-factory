import type { Dispatch, SetStateAction } from 'react';
import {
  clampReframeOffset,
  DEFAULT_EXPORT_MASTER_PROCESSING,
  normalizeExportColorManagement,
  normalizeExportMasterProcessing,
  normalizeExportPostScript,
  normalizeSubtitleLanguage,
  normalizeTargetAspectRatio,
  resolveReframeDimensions,
  type ExportMasterProcessingSettings,
} from '@open-factory/editor-core';
import type { ExportPresetSettings } from '../export-presets';
import { DEFAULT_TIMECODE_BURN_IN } from './constants';
import {
  clampUiNumber,
  isWatermarkPosition,
  normalizeHexColor,
  normalizeLoudnessNormalization,
  timecodeBurnInFrom,
} from './draft-normalizers';
import {
  enableWatermark,
  imageWatermarkFrom,
  textWatermarkFrom,
} from './watermark-helpers';

// ---------------------------------------------------------------------------
// Dimension & reframe updates
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Hardware encoding updates
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Audio processing updates
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Color management & post-export script
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Timecode burn-in updates
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Watermark updates
// ---------------------------------------------------------------------------

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
