import type {
  ExportAudioVisualizationBackground,
  ExportAudioVisualizationStyle,
  ExportSubtitleFormat,
  ExportWatermarkPosition,
} from '@open-factory/editor-core';
import type { ExportPresetSettings } from '../export-presets';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const WATERMARK_POSITIONS: ExportWatermarkPosition[] = [
  'top-left',
  'top-center',
  'top-right',
  'middle-left',
  'center',
  'middle-right',
  'bottom-left',
  'bottom-center',
  'bottom-right',
];

export const AUDIO_VISUALIZATION_FORMATS = ['mp4', 'mov', 'webm'];
export const VIDEO_EXPORT_FORMATS = ['mp4', 'mov', 'mkv', 'webm', 'm4a', 'gif', 'webp', 'apng', 'png-sequence'];
export const AUDIO_VISUALIZATION_STYLES: ExportAudioVisualizationStyle[] = [
  'waveform-line',
  'spectrum-bars',
  'circular-spectrum',
];
export const AUDIO_VISUALIZATION_BACKGROUND_TYPES: ExportAudioVisualizationBackground['type'][] = [
  'solid',
  'gradient',
  'image',
];
export const SUBTITLE_FORMATS: ExportSubtitleFormat[] = ['srt', 'vtt', 'ass', 'ssa'];

export const DEFAULT_AUDIO_VISUALIZATION: NonNullable<ExportPresetSettings['audioVisualization']> = {
  style: 'waveform-line',
  color: '#22d3ee',
  background: { type: 'solid', color: '#050816' },
};

export const DEFAULT_TIMECODE_BURN_IN: NonNullable<ExportPresetSettings['timecodeBurnIn']> = {
  enabled: true,
  position: 'bottom-left',
  fontSize: 28,
  color: '#ffffff',
  backgroundColor: '#000000',
  includeFrameNumber: false,
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SubtitleLanguageOption {
  language: string;
  label: string;
  trackCount: number;
}
