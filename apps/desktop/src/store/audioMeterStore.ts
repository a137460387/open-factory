import { create } from 'zustand';

export interface AudioMeterLevel {
  levelDb: number;
  peakDb: number;
}

export interface AudioMeterState {
  trackLevels: Record<string, AudioMeterLevel>;
  masterLevel: AudioMeterLevel;
  setLevels: (trackLevels: Record<string, AudioMeterLevel>, masterLevel: AudioMeterLevel) => void;
  resetLevels: () => void;
}

const SILENCE: AudioMeterLevel = { levelDb: -60, peakDb: -60 };

export const useAudioMeterStore = create<AudioMeterState>((set) => ({
  trackLevels: {},
  masterLevel: SILENCE,
  setLevels: (trackLevels, masterLevel) => set({ trackLevels, masterLevel }),
  resetLevels: () => set({ trackLevels: {}, masterLevel: SILENCE })
}));

export function getSilentMeterLevel(): AudioMeterLevel {
  return SILENCE;
}
