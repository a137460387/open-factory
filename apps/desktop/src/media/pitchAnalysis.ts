import { serializePitchDataCsv, type Clip, type ClipPitchDataPoint, type MediaAsset } from '@open-factory/editor-core';
import { zhCN } from '../i18n/strings';
import { sourceUrl } from '../lib/media';
import { saveFileDialog, writeFile } from '../lib/tauri-bridge';
import { runBackgroundMediaTask } from './background-media-task-queue';
import type { PitchAnalysisWorkerInput, PitchAnalysisWorkerOutput } from '../workers/pitch-analysis.worker';

export async function analyzeClipPitch(asset: MediaAsset): Promise<ClipPitchDataPoint[]> {
  return runBackgroundMediaTask(async () => {
    const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextCtor) {
      return [];
    }
    try {
      const response = await fetch(sourceUrl(asset.path));
      const arrayBuffer = await response.arrayBuffer();
      const context = new AudioContextCtor();
      try {
        const decoded = await context.decodeAudioData(arrayBuffer);
        const samples = downmixToMono(decoded);
        return await analyzePitchWithWorker(samples, decoded.sampleRate);
      } finally {
        await context.close().catch(() => undefined);
      }
    } catch {
      return [];
    }
  });
}

export async function exportClipPitchCsv(clip: Pick<Clip, 'name' | 'pitchData'>): Promise<boolean> {
  const path = await saveFileDialog(`${safeFileName(clip.name)}-pitch.csv`, [{ name: 'CSV', extensions: ['csv'] }]);
  if (!path) {
    return false;
  }
  await writeFile(path, serializePitchDataCsv(clip.pitchData));
  return true;
}

function analyzePitchWithWorker(samples: Float32Array, sampleRate: number): Promise<ClipPitchDataPoint[]> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('../workers/pitch-analysis.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (event: MessageEvent<PitchAnalysisWorkerOutput>) => {
      worker.terminate();
      if (!event.data.success) {
        reject(new Error(event.data.error ?? zhCN.inspector.pitchAnalysis.failedMessage));
        return;
      }
      resolve(event.data.points);
    };
    worker.onerror = (event) => {
      worker.terminate();
      reject(new Error(event.message));
    };
    const payload: PitchAnalysisWorkerInput = { samples, sampleRate };
    worker.postMessage(payload, [samples.buffer]);
  });
}

function downmixToMono(decoded: AudioBuffer): Float32Array {
  const channels = Math.max(1, decoded.numberOfChannels);
  const samples = new Float32Array(decoded.length);
  for (let channel = 0; channel < channels; channel += 1) {
    const data = decoded.getChannelData(channel);
    for (let index = 0; index < samples.length; index += 1) {
      samples[index] += data[index] / channels;
    }
  }
  return samples;
}

function safeFileName(name: string): string {
  const cleaned = name.trim().replace(/[<>:"/\\|?*\x00-\x1f]/g, '-').replace(/\s+/g, '-');
  return cleaned || 'clip';
}
