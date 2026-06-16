import { create } from 'zustand';
import type { ChannelAnalysisFrame } from '../media/channelAnalysis';

export interface AudioMeterLevel {
  levelDb: number;
  peakDb: number;
}

export interface AudioMeterState {
  trackLevels: Record<string, AudioMeterLevel>;
  trackFrequencyBands: Record<string, number[]>;
  trackAnalysisFrames: Record<string, ChannelAnalysisFrame>;
  masterLevel: AudioMeterLevel;
  setLevels: (
    trackLevels: Record<string, AudioMeterLevel>,
    masterLevel: AudioMeterLevel,
    trackFrequencyBands?: Record<string, number[]>,
    trackAnalysisFrames?: Record<string, ChannelAnalysisFrame>
  ) => void;
  resetLevels: () => void;
}

const SILENCE: AudioMeterLevel = { levelDb: -60, peakDb: -60 };
const SILENT_FREQUENCY_BANDS = Object.freeze(Array.from({ length: 16 }, () => 0));

export const useAudioMeterStore = create<AudioMeterState>((set) => ({
  trackLevels: {},
  trackFrequencyBands: {},
  trackAnalysisFrames: {},
  masterLevel: SILENCE,
  setLevels: (trackLevels, masterLevel, trackFrequencyBands = {}, trackAnalysisFrames = {}) => set({ trackLevels, masterLevel, trackFrequencyBands, trackAnalysisFrames }),
  resetLevels: () => set({ trackLevels: {}, trackFrequencyBands: {}, trackAnalysisFrames: {}, masterLevel: SILENCE })
}));

export function getSilentMeterLevel(): AudioMeterLevel {
  return SILENCE;
}

export function getSilentFrequencyBands(): number[] {
  return SILENT_FREQUENCY_BANDS as number[];
}
