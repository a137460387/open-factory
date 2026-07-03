import { create } from 'zustand';

const RECORDING_WIDTH_KEY = 'open-factory:recording-width';
const RECORDING_HEIGHT_KEY = 'open-factory:recording-height';
const RECORDING_FRAME_RATE_KEY = 'open-factory:recording-frame-rate';

export interface RecordingSettings {
  width: number;
  height: number;
  frameRate: number;
}

export interface RecordingSettingsState {
  settings: RecordingSettings;
  setSettings: (settings: Partial<RecordingSettings>) => void;
}

const DEFAULT_RECORDING_SETTINGS: RecordingSettings = {
  width: 1280,
  height: 720,
  frameRate: 30
};

export const useRecordingSettingsStore = create<RecordingSettingsState>((set, get) => ({
  settings: readRecordingSettings(),
  setSettings: (patch) => {
    const next = normalizeRecordingSettings({ ...get().settings, ...patch });
    writeNumber(RECORDING_WIDTH_KEY, next.width);
    writeNumber(RECORDING_HEIGHT_KEY, next.height);
    writeNumber(RECORDING_FRAME_RATE_KEY, next.frameRate);
    set({ settings: next });
  }
}));

function readRecordingSettings(): RecordingSettings {
  return normalizeRecordingSettings({
    width: readNumber(RECORDING_WIDTH_KEY),
    height: readNumber(RECORDING_HEIGHT_KEY),
    frameRate: readNumber(RECORDING_FRAME_RATE_KEY)
  });
}

function normalizeRecordingSettings(settings: Partial<RecordingSettings>): RecordingSettings {
  return {
    width: clampInteger(settings.width, 320, 7680, DEFAULT_RECORDING_SETTINGS.width),
    height: clampInteger(settings.height, 240, 4320, DEFAULT_RECORDING_SETTINGS.height),
    frameRate: clampInteger(settings.frameRate, 1, 120, DEFAULT_RECORDING_SETTINGS.frameRate)
  };
}

function readNumber(key: string): number | undefined {
  if (typeof window === 'undefined') {
    return undefined;
  }
  const value = Number(window.localStorage.getItem(key));
  return Number.isFinite(value) ? value : undefined;
}

function writeNumber(key: string, value: number): void {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.setItem(key, String(value));
}

function clampInteger(value: number | undefined, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, Math.round(value!)));
}
