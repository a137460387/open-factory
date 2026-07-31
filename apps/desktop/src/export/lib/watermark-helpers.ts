import type { ExportWatermarkPosition } from '@open-factory/editor-core';
import { zhCN } from '../../i18n/strings';
import type { ExportPresetSettings } from '../export-presets';
import { normalizeWatermarkPosition } from './draft-normalizers';

// ---------------------------------------------------------------------------
// Watermark helpers
// ---------------------------------------------------------------------------

export function enableWatermark(
  watermark: ExportPresetSettings['watermark'],
): NonNullable<ExportPresetSettings['watermark']> {
  if (watermark?.type === 'image') {
    return imageWatermarkFrom(watermark);
  }
  return textWatermarkFrom(watermark);
}

export function imageWatermarkFrom(
  watermark: ExportPresetSettings['watermark'],
): NonNullable<ExportPresetSettings['watermark']> & { type: 'image' } {
  if (watermark?.type === 'image') {
    return { ...watermark, enabled: true, position: normalizeWatermarkPosition(watermark.position) };
  }
  return {
    enabled: true,
    type: 'image',
    path: '',
    position: normalizeWatermarkPosition(watermark?.position),
    scalePercent: 12,
    opacity: 0.75,
  };
}

export function textWatermarkFrom(
  watermark: ExportPresetSettings['watermark'],
): NonNullable<ExportPresetSettings['watermark']> & { type: 'text' } {
  if (watermark?.type === 'text') {
    return { ...watermark, enabled: true, position: normalizeWatermarkPosition(watermark.position) };
  }
  return {
    enabled: true,
    type: 'text',
    text: zhCN.exportDialog.watermark.defaultText,
    fontFamily: 'Arial',
    color: '#ffffff',
    fontSize: 36,
    position: normalizeWatermarkPosition(watermark?.position),
  };
}
