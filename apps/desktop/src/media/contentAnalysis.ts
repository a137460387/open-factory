import {
  buildClipContentAnalysis,
  serializeClipContentAnalysisJson,
  type Clip,
  type ClipContentAnalysis,
  type ContentAnalysisAudioSample,
  type ContentAnalysisVisualSample,
  type MediaAsset
} from '@open-factory/editor-core';
import { analyzeMedia, analyzeWaveform, saveFileDialog, writeFile, type MediaAnalysis } from '../lib/tauri-bridge';
import { zhCN } from '../i18n/strings';

export async function analyzeClipContentLocally(clip: Clip, asset: MediaAsset, analyzedAt = new Date().toISOString()): Promise<ClipContentAnalysis> {
  const mediaAnalysis = await analyzeMedia(asset.path);
  const duration = Math.max(clip.duration || 0, mediaAnalysis.format.duration ?? asset.duration ?? 0, 0.25);
  const waveform = mediaAnalysis.audioStreams.length > 0 ? await analyzeWaveform(asset.path, 2).catch(() => []) : [];
  return buildClipContentAnalysis({
    duration,
    analyzedAt,
    segmentDuration: Math.max(1, Math.min(3, duration / 4 || 1)),
    visualSamples: buildVisualSamples(mediaAnalysis, duration, waveform),
    audioSamples: buildAudioSamples(waveform, 2)
  });
}

export async function exportClipContentAnalysisJson(clip: Pick<Clip, 'id' | 'name' | 'contentAnalysis'>): Promise<string | undefined> {
  const outputPath = await saveFileDialog(`${sanitizeFileName(clip.name || clip.id)}-content-analysis.json`, [{ name: zhCN.fileDialogs.json, extensions: ['json'] }]);
  if (!outputPath) {
    return undefined;
  }
  await writeFile(outputPath, serializeClipContentAnalysisJson(clip));
  return outputPath;
}

function buildVisualSamples(analysis: MediaAnalysis, duration: number, waveform: number[]): ContentAnalysisVisualSample[] {
  const video = analysis.videoStreams[0];
  const sampleCount = Math.max(4, Math.min(16, Math.ceil(duration)));
  const bitrates = analysis.bitratePoints.length > 0 ? analysis.bitratePoints : [{ time: 0, bitRate: video?.bitRate ?? analysis.format.bitRate ?? 1_000_000 }];
  const maxBitrate = Math.max(...bitrates.map((point) => point.bitRate), 1);
  const minBitrate = Math.min(...bitrates.map((point) => point.bitRate), maxBitrate);
  const range = Math.max(1, maxBitrate - minBitrate);
  const samples: ContentAnalysisVisualSample[] = [];
  for (let index = 0; index < sampleCount; index += 1) {
    const time = duration * (index / sampleCount);
    const bitratePoint = findNearestBitratePoint(bitrates, time);
    const normalizedBitrate = (bitratePoint.bitRate - minBitrate) / range;
    const nearbyAudio = waveform[Math.min(waveform.length - 1, Math.max(0, Math.round(time * 2)))] ?? 0;
    samples.push({
      time,
      brightness: clamp01(estimateBaseBrightness(video, analysis) + normalizedBitrate * 0.18),
      saturation: clamp01(video?.colorPrimaries?.includes('bt2020') ? 0.62 : 0.38 + normalizedBitrate * 0.16),
      motion: clamp01(estimateMotion(video, normalizedBitrate, nearbyAudio)),
      faceRatio: analysis.audioStreams.length > 0 ? 0.34 : 0.08,
      colorTemperature: video?.colorPrimaries?.includes('bt2020') ? 6200 : 4800
    });
  }
  return samples;
}

function buildAudioSamples(waveform: number[], samplesPerSecond: number): ContentAnalysisAudioSample[] {
  return waveform.map((loudness, index) => ({
    time: index / samplesPerSecond,
    loudness: clamp01(loudness)
  }));
}

function estimateBaseBrightness(video: MediaAnalysis['videoStreams'][number] | undefined, analysis: MediaAnalysis): number {
  if (video?.colorTransfer === 'smpte2084' || video?.colorPrimaries?.includes('bt2020')) {
    return 0.66;
  }
  if (!video) {
    return 0.42;
  }
  const bitrate = video.bitRate ?? analysis.format.bitRate ?? 0;
  return bitrate > 20_000_000 ? 0.62 : 0.46;
}

function estimateMotion(video: MediaAnalysis['videoStreams'][number] | undefined, normalizedBitrate: number, nearbyAudio: number): number {
  const frameRateMotion = video?.frameRate ? Math.min(0.24, Math.max(0, (video.frameRate - 24) / 120)) : 0.04;
  return normalizedBitrate * 0.5 + frameRateMotion + nearbyAudio * 0.16;
}

function findNearestBitratePoint(points: MediaAnalysis['bitratePoints'], time: number): MediaAnalysis['bitratePoints'][number] {
  return points.reduce((best, point) => (Math.abs(point.time - time) < Math.abs(best.time - time) ? point : best), points[0]);
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(1, Math.max(0, value));
}

function sanitizeFileName(name: string): string {
  return name.replace(/[<>:"/\\|?*\x00-\x1f]/g, '-').replace(/\s+/g, ' ').trim() || 'clip';
}
