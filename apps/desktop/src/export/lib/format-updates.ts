import type { Dispatch, SetStateAction } from 'react';
import type { ExportPresetSettings } from '../export-presets';
import {
  isAudioVisualizationFormat,
  normalizeAudioCodecForFormat,
  normalizeAudioVisualizationDraft,
  normalizeVideoCodecForFormat,
} from './draft-normalizers';

// ---------------------------------------------------------------------------
// Format & output-mode updates
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
