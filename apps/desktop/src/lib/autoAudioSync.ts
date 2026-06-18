import {
  analyzeAutoAudioSyncTracks,
  type AutoAudioSyncOptions,
  type AutoAudioSyncResult,
  type Clip,
  type MediaAsset,
  type Track
} from '@open-factory/editor-core';
import { zhCN } from '../i18n/strings';
import { analyzeWaveform } from './tauri-bridge';

const AUTO_AUDIO_SYNC_SAMPLE_RATE = 8_000;
const AUTO_AUDIO_SYNC_MAX_SECONDS = 60;

export interface AutoAudioSyncTarget {
  clip: Extract<Clip, { type: 'audio' | 'video' }>;
  asset: MediaAsset;
  track: Track;
}

export interface AutoAudioSyncAnalysis {
  primaryClipId: string;
  results: AutoAudioSyncResult[];
}

export function canUseClipForAutoAudioSync(clip: Clip | undefined, asset: MediaAsset | undefined): clip is Extract<Clip, { type: 'audio' | 'video' }> {
  return Boolean(clip && asset && (clip.type === 'audio' || clip.type === 'video') && (asset.type === 'audio' || asset.hasAudio) && !asset.missing);
}

export async function analyzeAutoAudioSyncTargets(
  primary: AutoAudioSyncTarget,
  secondaryTargets: AutoAudioSyncTarget[],
  options: AutoAudioSyncOptions = {}
): Promise<AutoAudioSyncAnalysis> {
  if (!canUseClipForAutoAudioSync(primary.clip, primary.asset)) {
    throw new Error(zhCN.autoAudioSync.unavailableMessage);
  }
  const candidates = secondaryTargets.slice(0, 4).filter((target) => canUseClipForAutoAudioSync(target.clip, target.asset));
  if (candidates.length === 0) {
    throw new Error(zhCN.autoAudioSync.notEnoughTracksMessage);
  }
  const primarySamples = await readSyncSamples(primary.asset);
  const secondarySamples = await Promise.all(
    candidates.map(async (target) => ({
      clipId: target.clip.id,
      samples: await readSyncSamples(target.asset),
      sampleRate: AUTO_AUDIO_SYNC_SAMPLE_RATE
    }))
  );
  return {
    primaryClipId: primary.clip.id,
    results: analyzeAutoAudioSyncTracks(
      { clipId: primary.clip.id, samples: primarySamples, sampleRate: AUTO_AUDIO_SYNC_SAMPLE_RATE },
      secondarySamples,
      {
        targetSampleRate: AUTO_AUDIO_SYNC_SAMPLE_RATE,
        maxDurationSeconds: AUTO_AUDIO_SYNC_MAX_SECONDS,
        ...options
      }
    )
  };
}

async function readSyncSamples(asset: MediaAsset): Promise<number[]> {
  const samples = await analyzeWaveform(asset.path, AUTO_AUDIO_SYNC_SAMPLE_RATE);
  return samples.slice(0, AUTO_AUDIO_SYNC_SAMPLE_RATE * AUTO_AUDIO_SYNC_MAX_SECONDS);
}
