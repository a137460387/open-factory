import type { Clip, MediaAsset, Timeline } from '@open-factory/editor-core';
import {
  calculateSpeedCurveSourceDuration,
  createVuMeterState,
  getActiveClipsAtTime,
  getClipSpeed,
  getClipSpeedAtTime,
  getTrackPan,
  getTrackVolume,
  normalizeTrackCompressor,
  normalizeTrackEQ,
  readVuMeter,
  resolveAnimatedVolume,
  type Track,
  type VuMeterState
} from '@open-factory/editor-core';
import { createAudioElement } from './media-elements';
import { recordAudioMix } from './debug';
import type { AudioMeterLevel } from '../../store/audioMeterStore';

interface AudioNodeSet {
  source: MediaElementAudioSourceNode;
  eqNodes?: BiquadFilterNode[];
  compressor?: DynamicsCompressorNode;
  compressorMakeup?: GainNode;
  gain: GainNode;
  panner?: StereoPannerNode;
  analyser?: AnalyserNode;
  meterState: VuMeterState;
}

export class PreviewAudioRenderer {
  private audio = new Map<string, HTMLAudioElement>();
  private audioNodes = new Map<string, AudioNodeSet>();
  private audioContext?: AudioContext;
  private masterGain?: GainNode;
  private masterAnalyser?: AnalyserNode;
  private masterMeterState: VuMeterState = createVuMeterState();
  private activeClipIds = new Set<string>();
  private activeTrackIdsByClipId = new Map<string, string>();
  private lastAudioCalibration = 0;

  syncAudio(timeline: Timeline, media: MediaAsset[], playheadTime: number, isPlaying: boolean, masterVolume = 1): void {
    const mediaById = new Map(media.map((asset) => [asset.id, asset]));
    const trackById = new Map(timeline.tracks.map((track) => [track.id, track]));
    const activeAudioClips = getActiveClipsAtTime(timeline, playheadTime).filter((clip) => {
      if (clip.type === 'audio') {
        return true;
      }
      if (clip.type === 'video') {
        return Boolean(mediaById.get(clip.mediaId)?.hasAudio);
      }
      return false;
    });
    const activeIds = new Set(activeAudioClips.map((clip) => clip.id));
    this.activeClipIds = activeIds;
    this.activeTrackIdsByClipId = new Map(activeAudioClips.map((clip) => [clip.id, clip.trackId]));
    const master = this.getMasterNodes();
    if (master) {
      master.gain.gain.value = Math.min(2, Math.max(0, masterVolume));
    }

    for (const [clipId, audio] of this.audio) {
      if (!activeIds.has(clipId)) {
        audio.pause();
      }
    }

    for (const clip of activeAudioClips) {
      this.syncClipAudio(clip, trackById.get(clip.trackId), mediaById, playheadTime, isPlaying);
    }
  }

  pauseAllAudio(): void {
    for (const audio of this.audio.values()) {
      audio.pause();
    }
  }

  getLevels(nowMs = performance.now()): { trackLevels: Record<string, AudioMeterLevel>; masterLevel: AudioMeterLevel } {
    const trackLevels: Record<string, AudioMeterLevel> = {};
    for (const clipId of this.activeClipIds) {
      const node = this.audioNodes.get(clipId);
      const trackId = this.activeTrackIdsByClipId.get(clipId);
      if (!node?.analyser || !trackId) {
        continue;
      }
      const reading = readVuMeter(node.analyser, node.meterState, nowMs);
      node.meterState = { peakDb: reading.peakDb, peakHeldAtMs: reading.peakHeldAtMs };
      const existing = trackLevels[trackId];
      trackLevels[trackId] = {
        levelDb: Math.max(existing?.levelDb ?? -60, reading.levelDb),
        peakDb: Math.max(existing?.peakDb ?? -60, reading.peakDb)
      };
    }

    const master = this.masterAnalyser ? readVuMeter(this.masterAnalyser, this.masterMeterState, nowMs) : { levelDb: -60, peakDb: -60, peakHeldAtMs: nowMs };
    this.masterMeterState = { peakDb: master.peakDb, peakHeldAtMs: master.peakHeldAtMs };
    return {
      trackLevels,
      masterLevel: { levelDb: master.levelDb, peakDb: master.peakDb }
    };
  }

  private syncClipAudio(clip: Clip, track: Track | undefined, mediaById: Map<string, MediaAsset>, playheadTime: number, isPlaying: boolean): void {
    if (clip.type !== 'audio' && clip.type !== 'video') {
      return;
    }
    const asset = mediaById.get(clip.mediaId);
    if (!asset || asset.missing) {
      return;
    }
    const audio = this.getAudio(clip.id, asset);
    const localTime = Math.max(0, playheadTime - clip.start);
    const speed = getClipSpeedAtTime(clip, localTime);
    const sourceTime = Math.max(0, calculateSpeedCurveSourceDuration(localTime, clip.keyframes, getClipSpeed(clip)) + clip.trimStart);
    const node = this.getAudioNode(clip.id, audio);
    this.applyTrackProcessing(node, track);
    const volume = resolveAnimatedVolume(clip, localTime);
    const muted = 'muted' in clip ? Boolean(clip.muted) : false;
    node.gain.gain.value = muted ? 0 : volume * (track ? getTrackVolume(track) : 1) * getFadeMultiplier(clip, playheadTime);
    if (node.panner) {
      node.panner.pan.value = track ? getTrackPan(track) : 0;
    }
    recordAudioMix(clip.type, node.gain.gain.value);
    audio.volume = 1;
    audio.playbackRate = speed;

    const shouldCalibrate = Date.now() - this.lastAudioCalibration > 1000 || !isPlaying;
    if (Math.abs(audio.currentTime - sourceTime) > 0.15 && shouldCalibrate) {
      audio.currentTime = sourceTime;
      this.lastAudioCalibration = Date.now();
    }
    if (isPlaying && audio.paused) {
      void this.audioContext?.resume().catch(() => undefined);
      void audio.play().catch(() => undefined);
    }
    if (!isPlaying && !audio.paused) {
      audio.pause();
    }
  }

  private getAudio(clipId: string, asset: MediaAsset): HTMLAudioElement {
    const existing = this.audio.get(clipId);
    if (existing) {
      return existing;
    }
    const audio = createAudioElement(asset);
    this.audio.set(clipId, audio);
    return audio;
  }

  private getAudioNode(clipId: string, audio: HTMLAudioElement): AudioNodeSet {
    const existing = this.audioNodes.get(clipId);
    if (existing) {
      return existing;
    }
    const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextCtor) {
      const fallbackGain = { gain: { value: audio.volume } } as GainNode;
      const fallbackSource = {} as MediaElementAudioSourceNode;
      return { source: fallbackSource, gain: fallbackGain, meterState: createVuMeterState() };
    }
    this.audioContext ??= new AudioContextCtor();
    const source = this.audioContext.createMediaElementSource(audio);
    const eqNodes = Array.from({ length: 4 }, () => this.audioContext!.createBiquadFilter());
    const compressor = typeof this.audioContext.createDynamicsCompressor === 'function' ? this.audioContext.createDynamicsCompressor() : undefined;
    const compressorMakeup = compressor ? this.audioContext.createGain() : undefined;
    const gain = this.audioContext.createGain();
    const analyser = this.audioContext.createAnalyser();
    analyser.fftSize = 1024;
    const panner = typeof this.audioContext.createStereoPanner === 'function' ? this.audioContext.createStereoPanner() : undefined;
    let current: AudioNode = source;
    for (const eqNode of eqNodes) {
      current.connect(eqNode);
      current = eqNode;
    }
    if (compressor && compressorMakeup) {
      current.connect(compressor).connect(compressorMakeup);
      current = compressorMakeup;
    }
    current.connect(gain);
    if (panner) {
      gain.connect(panner).connect(analyser);
    } else {
      gain.connect(analyser);
    }
    const master = this.getMasterNodes();
    analyser.connect(master?.gain ?? this.audioContext.destination);
    const nodes = { source, eqNodes, compressor, compressorMakeup, gain, panner, analyser, meterState: createVuMeterState() };
    this.audioNodes.set(clipId, nodes);
    return nodes;
  }

  private getMasterNodes(): { gain: GainNode; analyser: AnalyserNode } | undefined {
    const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextCtor) {
      return undefined;
    }
    this.audioContext ??= new AudioContextCtor();
    if (!this.masterGain || !this.masterAnalyser) {
      this.masterGain = this.audioContext.createGain();
      this.masterAnalyser = this.audioContext.createAnalyser();
      this.masterAnalyser.fftSize = 1024;
      this.masterGain.connect(this.masterAnalyser).connect(this.audioContext.destination);
    }
    return { gain: this.masterGain, analyser: this.masterAnalyser };
  }

  private applyTrackProcessing(node: AudioNodeSet, track: Track | undefined): void {
    const eq = normalizeTrackEQ(track?.eq);
    node.eqNodes?.forEach((eqNode, index) => {
      const band = eq.bands[index];
      eqNode.type = band.type;
      eqNode.frequency.value = band.frequency;
      eqNode.gain.value = eq.enabled ? band.gain : 0;
      eqNode.Q.value = band.q;
    });

    const compressor = normalizeTrackCompressor(track?.compressor);
    if (node.compressor) {
      node.compressor.threshold.value = compressor.enabled ? compressor.threshold : 0;
      node.compressor.ratio.value = compressor.enabled ? compressor.ratio : 1;
      node.compressor.attack.value = compressor.enabled ? compressor.attack / 1000 : 0.001;
      node.compressor.release.value = compressor.enabled ? compressor.release / 1000 : 0.01;
    }
    if (node.compressorMakeup) {
      node.compressorMakeup.gain.value = compressor.enabled ? 10 ** (compressor.makeupGain / 20) : 1;
    }
  }
}

function getFadeMultiplier(clip: Extract<Clip, { type: 'audio' | 'video' }>, playheadTime: number): number {
  const localTime = Math.max(0, playheadTime - clip.start);
  let multiplier = 1;
  if ('fadeInDuration' in clip && clip.fadeInDuration && clip.fadeInDuration > 0) {
    multiplier = Math.min(multiplier, Math.min(1, localTime / clip.fadeInDuration));
  }
  if ('fadeOutDuration' in clip && clip.fadeOutDuration && clip.fadeOutDuration > 0) {
    const remaining = Math.max(0, clip.duration - localTime);
    multiplier = Math.min(multiplier, Math.min(1, remaining / clip.fadeOutDuration));
  }
  return Math.max(0, Math.min(1, multiplier));
}
