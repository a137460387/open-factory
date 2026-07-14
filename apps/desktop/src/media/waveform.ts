import { logError } from "../lib/error-handlers";
import { extractDecodedWaveform, type MediaAsset, type WaveformCacheEntry } from '@open-factory/editor-core';
import { readWaveformFromCache, writeWaveformToCache } from '../cache/cache-service';
import { zhCN } from '../i18n/strings';
import { sourceUrl } from '../lib/media';
import { analyzeWaveform, getFileStat, type FileStat } from '../lib/tauri-bridge';
import { runBackgroundMediaTask } from './background-media-task-queue';
import type { WaveformWorkerInput, WaveformWorkerOutput } from '../workers/waveform.worker';

export interface WaveformResult {
  peaks: number[];
  duration: number;
  channels: number;
  isSampled: boolean;
}

const DEFAULT_POINTS_PER_SECOND = 100;
export const NATIVE_AUDIO_ANALYSIS_THRESHOLD_BYTES = 50 * 1024 * 1024;
const WORKER_THRESHOLD_BYTES = 50 * 1024 * 1024;
const SAMPLED_THRESHOLD_BYTES = 500 * 1024 * 1024;

export async function getWaveform(asset: MediaAsset, pointsPerSecond = DEFAULT_POINTS_PER_SECOND): Promise<WaveformResult> {
  const cached = await readWaveformFromCache(asset);
  if (cached && cached.pointsPerSecond >= pointsPerSecond) {
    return toResult(cached);
  }
  return runBackgroundMediaTask(() => getWaveformUnthrottled(asset, pointsPerSecond));
}

async function getWaveformUnthrottled(asset: MediaAsset, pointsPerSecond = DEFAULT_POINTS_PER_SECOND): Promise<WaveformResult> {
  const cached = await readWaveformFromCache(asset);
  if (cached && cached.pointsPerSecond >= pointsPerSecond) {
    return toResult(cached);
  }
  const stat = await getNativeFileStat(asset);
  const sizeBeforeFetch = asset.size ?? stat?.size;
  if (typeof sizeBeforeFetch === 'number' && sizeBeforeFetch > NATIVE_AUDIO_ANALYSIS_THRESHOLD_BYTES) {
    const result = await getNativeWaveform(asset, pointsPerSecond);
    await writeWaveformToCache(stat ? { ...asset, size: stat.size, mtimeMs: stat.mtimeMs } : asset, {
      peaks: result.peaks,
      duration: result.duration,
      channels: result.channels,
      pointsPerSecond,
      isSampled: true
    });
    return result;
  }

  const response = await fetch(sourceUrl(asset.path));
  const arrayBuffer = await response.arrayBuffer();
  const size = asset.size ?? arrayBuffer.byteLength;
  const isSampled = size >= SAMPLED_THRESHOLD_BYTES;
  const result = isSampled
    ? await extractWithWorker(arrayBuffer, pointsPerSecond, asset.duration)
    : await decodeWaveform(arrayBuffer.slice(0), pointsPerSecond).catch(() =>
        size >= WORKER_THRESHOLD_BYTES ? extractWithWorker(arrayBuffer, pointsPerSecond, asset.duration) : extractPeaks(new Uint8Array(arrayBuffer), pointsPerSecond, asset.duration, false)
      );

  await writeWaveformToCache(asset, {
    peaks: result.peaks,
    duration: result.duration,
    channels: result.channels,
    pointsPerSecond,
    isSampled
  });
  return { ...result, isSampled: isSampled || result.isSampled };
}

async function getNativeWaveform(asset: MediaAsset, pointsPerSecond: number): Promise<WaveformResult> {
  const peaks = await analyzeWaveform(asset.path, pointsPerSecond);
  return {
    peaks,
    duration: asset.duration || Math.max(0.001, peaks.length / Math.max(1, pointsPerSecond)),
    channels: asset.audioChannels ?? 1,
    isSampled: true
  };
}

async function getNativeFileStat(asset: MediaAsset): Promise<FileStat | undefined> {
  try {
    return await getFileStat(asset.path);
  } catch {
    return undefined;
  }
}

async function decodeWaveform(arrayBuffer: ArrayBuffer, pointsPerSecond: number): Promise<WaveformResult> {
  const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextCtor) {
    throw new Error(zhCN.errors.waveformDecodeUnavailable);
  }
  const context = new AudioContextCtor();
  try {
    const decoded = await context.decodeAudioData(arrayBuffer);
    const channels = Array.from({ length: decoded.numberOfChannels }, (_, index) => decoded.getChannelData(index).slice());
    const waveform = extractDecodedWaveform({ channels, sampleRate: decoded.sampleRate, pointsPerSecond });
    return {
      peaks: waveform.peaks,
      duration: waveform.duration,
      channels: waveform.channels,
      isSampled: false
    };
  } finally {
    await context.close().catch(logError("waveform"));
  }
}

function extractPeaks(bytes: Uint8Array, pointsPerSecond: number, durationHint: number, isSampled = false): WaveformResult {
  const duration = Math.max(durationHint || bytes.length / 44_100, 0.001);
  const totalPoints = Math.max(32, Math.ceil(duration * pointsPerSecond));
  const stride = isSampled ? Math.max(1, Math.floor(bytes.length / (totalPoints * 8))) : 1;
  const bucketSize = Math.max(1, Math.floor(bytes.length / totalPoints));
  const peaks: number[] = [];
  for (let point = 0; point < totalPoints; point += 1) {
    const start = point * bucketSize;
    const end = Math.min(bytes.length, start + bucketSize);
    let peak = 0;
    for (let index = start; index < end; index += stride) {
      peak = Math.max(peak, Math.abs(bytes[index] - 128) / 128);
    }
    peaks.push(Number(peak.toFixed(3)));
  }
  return { peaks, duration, channels: 1, isSampled };
}

function extractWithWorker(arrayBuffer: ArrayBuffer, pointsPerSecond: number, durationHint: number): Promise<WaveformResult> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('../workers/waveform.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (event: MessageEvent<WaveformWorkerOutput>) => {
      worker.terminate();
      if (!event.data.success) {
        reject(new Error(event.data.error ?? zhCN.errors.waveformWorkerFailed));
        return;
      }
      resolve({ peaks: event.data.peaks, duration: event.data.duration, channels: event.data.channels, isSampled: true });
    };
    worker.onerror = (event) => {
      worker.terminate();
      reject(new Error(event.message));
    };
    const payload: WaveformWorkerInput = { arrayBuffer, pointsPerSecond, durationHint };
    worker.postMessage(payload, [arrayBuffer]);
  });
}

function toResult(entry: WaveformCacheEntry): WaveformResult {
  return {
    peaks: entry.peaks,
    duration: entry.duration,
    channels: entry.channels,
    isSampled: entry.isSampled
  };
}
