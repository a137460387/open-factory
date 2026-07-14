import { logError } from "../lib/error-handlers";
import {
  applySilenceMargins,
  findSilentRanges,
  getClipSpeed,
  round,
  type Clip,
  type MediaAsset,
  type SilenceDetectionOptions,
  type SilentRange
} from '@open-factory/editor-core';
import { zhCN } from '../i18n/strings';
import { getAudioPreviewMediaPath } from '../media/proxy';
import { sourceUrl } from './media';
import { detectSilence, getFileStat } from './tauri-bridge';

export interface ClipSilenceDetectionOptions {
  thresholdDb: number;
  minSilenceDuration: number;
  marginDuration: number;
}

export const NATIVE_AUDIO_ANALYSIS_THRESHOLD_BYTES = 50 * 1024 * 1024;

export async function detectClipSilence(clip: Clip, asset: MediaAsset, options: ClipSilenceDetectionOptions): Promise<SilentRange[]> {
  if (clip.type !== 'audio' && clip.type !== 'video') {
    throw new Error(zhCN.errors.silenceNeedsAudio);
  }
  if (clip.type === 'video' && !asset.hasAudio) {
    throw new Error(zhCN.errors.videoHasNoAudio);
  }

  const mediaPath = getAudioPreviewMediaPath(asset);
  const stat = await getFileStat(mediaPath).catch(logError("silenceDetection"));
  const size = asset.size ?? stat?.size;
  if (typeof size === 'number' && size > NATIVE_AUDIO_ANALYSIS_THRESHOLD_BYTES) {
    return detectNativeClipSilence(clip, mediaPath, options);
  }

  const response = await fetch(sourceUrl(mediaPath));
  const arrayBuffer = await response.arrayBuffer();
  const decoded = await decodeAudio(arrayBuffer);
  const speed = getClipSpeed(clip);
  const visibleSourceDuration = Math.max(0, clip.duration * speed);
  const startSample = Math.max(0, Math.floor(clip.trimStart * decoded.sampleRate));
  const endSample = Math.min(decoded.length, startSample + Math.floor(visibleSourceDuration * decoded.sampleRate));
  const channels = Array.from({ length: decoded.numberOfChannels }, (_, index) => decoded.getChannelData(index).slice(startSample, endSample));
  const sourceRanges = findSilentRanges(
    {
      channels,
      sampleRate: decoded.sampleRate,
      duration: Math.max(0, endSample - startSample) / decoded.sampleRate
    },
    options satisfies SilenceDetectionOptions
  );

  return sourceRanges
    .map((range) => {
      const start = round(range.start / speed);
      const end = round(range.end / speed);
      return { start, end, duration: round(end - start) };
    })
    .filter((range) => range.duration > 0);
}

async function detectNativeClipSilence(clip: Clip, mediaPath: string, options: ClipSilenceDetectionOptions): Promise<SilentRange[]> {
  const speed = getClipSpeed(clip);
  const visibleSourceDuration = Math.max(0, clip.duration * speed);
  const sourceStart = Math.max(0, clip.trimStart);
  const sourceEnd = sourceStart + visibleSourceDuration;
  if (visibleSourceDuration <= 0 || speed <= 0) {
    return [];
  }

  const nativeRanges = await detectSilence(mediaPath, options.thresholdDb, Math.max(0, options.minSilenceDuration) * 1_000);
  const sourceRanges: SilentRange[] = nativeRanges.flatMap(([start, end]) => {
    const clippedStart = Math.max(sourceStart, start);
    const clippedEnd = Math.min(sourceEnd, end);
    if (clippedEnd <= clippedStart) {
      return [];
    }
    const relativeStart = round(clippedStart - sourceStart);
    const relativeEnd = round(clippedEnd - sourceStart);
    return [{ start: relativeStart, end: relativeEnd, duration: round(relativeEnd - relativeStart) }];
  });

  return applySilenceMargins(sourceRanges, visibleSourceDuration, options.marginDuration)
    .map((range) => {
      const start = round(range.start / speed);
      const end = round(range.end / speed);
      return { start, end, duration: round(end - start) };
    })
    .filter((range) => range.duration > 0);
}

async function decodeAudio(arrayBuffer: ArrayBuffer): Promise<AudioBuffer> {
  if (window.OfflineAudioContext) {
    const offlineContext = new OfflineAudioContext(1, 1, 44_100);
    return offlineContext.decodeAudioData(arrayBuffer.slice(0));
  }
  const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextCtor) {
    throw new Error(zhCN.errors.webAudioUnavailable);
  }
  const context = new AudioContextCtor();
  try {
    return await context.decodeAudioData(arrayBuffer.slice(0));
  } finally {
    await context.close().catch(logError("silenceDetection"));
  }
}
