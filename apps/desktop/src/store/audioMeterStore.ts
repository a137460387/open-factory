import { create } from 'zustand';

export interface AudioMeterLevel {
  levelDb: number;
  peakDb: number;
}

export interface AudioMeterState {
  trackLevels: Record<string, AudioMeterLevel>;
  trackFrequencyBands: Record<string, number[]>;
  masterLevel: AudioMeterLevel;
  setLevels: (trackLevels: Record<string, AudioMeterLevel>, masterLevel: AudioMeterLevel, trackFrequencyBands?: Record<string, number[]>) => void;
  resetLevels: () => void;
}

const SILENCE: AudioMeterLevel = { levelDb: -60, peakDb: -60 };
const SILENT_FREQUENCY_BANDS = Object.freeze(Array.from({ length: 16 }, () => 0));

export const useAudioMeterStore = create<AudioMeterState>((set) => ({
  trackLevels: {},
  trackFrequencyBands: {},
  masterLevel: SILENCE,
  setLevels: (trackLevels, masterLevel, trackFrequencyBands = {}) => set({ trackLevels, masterLevel, trackFrequencyBands }),
  resetLevels: () => set({ trackLevels: {}, trackFrequencyBands: {}, masterLevel: SILENCE })
}));

export function getSilentMeterLevel(): AudioMeterLevel {
  return SILENCE;
}

export function getSilentFrequencyBands(): number[] {
  return SILENT_FREQUENCY_BANDS as number[];
}
