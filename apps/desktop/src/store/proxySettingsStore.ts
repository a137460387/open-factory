import { DEFAULT_PROXY_SETTINGS, type ProxySettings } from '@open-factory/editor-core';
import { create } from 'zustand';

export type ProxyResolutionPreset = '540p' | '720p' | '1080p';
export type ProxyTriggerThreshold = 720 | 1080 | 1440 | 2160;

export const PROXY_RESOLUTION_PRESETS: Record<ProxyResolutionPreset, Pick<ProxySettings, 'maxWidth' | 'maxHeight' | 'videoBitrate'>> = {
  '540p': { maxWidth: 960, maxHeight: 540, videoBitrate: '1600k' },
  '720p': { maxWidth: 1280, maxHeight: 720, videoBitrate: '2500k' },
  '1080p': { maxWidth: 1920, maxHeight: 1080, videoBitrate: '5000k' }
};

export const PROXY_TRIGGER_THRESHOLDS: ProxyTriggerThreshold[] = [720, 1080, 1440, 2160];

export interface ProxySettingsState {
  resolutionPreset: ProxyResolutionPreset;
  triggerShortEdge: ProxyTriggerThreshold;
  settings: ProxySettings;
  setResolutionPreset(preset: ProxyResolutionPreset): void;
  setTriggerShortEdge(threshold: ProxyTriggerThreshold): void;
  reset(): void;
}

const STORAGE_KEY = 'open-factory:proxy-settings';
const DEFAULT_RESOLUTION_PRESET: ProxyResolutionPreset = '720p';
const DEFAULT_TRIGGER_SHORT_EDGE: ProxyTriggerThreshold = 1080;

export const useProxySettingsStore = create<ProxySettingsState>((set, get) => {
  const saved = readProxySettings();
  return {
    ...saved,
    settings: toProxySettings(saved.resolutionPreset, saved.triggerShortEdge),
    setResolutionPreset(resolutionPreset) {
      const triggerShortEdge = get().triggerShortEdge;
      const next = { resolutionPreset, triggerShortEdge };
      writeProxySettings(next);
      set({ ...next, settings: toProxySettings(resolutionPreset, triggerShortEdge) });
    },
    setTriggerShortEdge(triggerShortEdge) {
      const resolutionPreset = get().resolutionPreset;
      const next = { resolutionPreset, triggerShortEdge };
      writeProxySettings(next);
      set({ ...next, settings: toProxySettings(resolutionPreset, triggerShortEdge) });
    },
    reset() {
      const next = { resolutionPreset: DEFAULT_RESOLUTION_PRESET, triggerShortEdge: DEFAULT_TRIGGER_SHORT_EDGE };
      writeProxySettings(next);
      set({ ...next, settings: toProxySettings(next.resolutionPreset, next.triggerShortEdge) });
    }
  };
});

export function readProxySettings(): Pick<ProxySettingsState, 'resolutionPreset' | 'triggerShortEdge'> {
  if (typeof localStorage === 'undefined') {
    return { resolutionPreset: DEFAULT_RESOLUTION_PRESET, triggerShortEdge: DEFAULT_TRIGGER_SHORT_EDGE };
  }
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Partial<Pick<ProxySettingsState, 'resolutionPreset' | 'triggerShortEdge'>>;
    return {
      resolutionPreset: normalizeResolutionPreset(parsed.resolutionPreset),
      triggerShortEdge: normalizeTriggerShortEdge(parsed.triggerShortEdge)
    };
  } catch {
    return { resolutionPreset: DEFAULT_RESOLUTION_PRESET, triggerShortEdge: DEFAULT_TRIGGER_SHORT_EDGE };
  }
}

function toProxySettings(resolutionPreset: ProxyResolutionPreset, triggerShortEdge: ProxyTriggerThreshold): ProxySettings {
  return {
    ...DEFAULT_PROXY_SETTINGS,
    ...PROXY_RESOLUTION_PRESETS[resolutionPreset],
    triggerShortEdge
  };
}

function writeProxySettings(settings: Pick<ProxySettingsState, 'resolutionPreset' | 'triggerShortEdge'>): void {
  if (typeof localStorage === 'undefined') {
    return;
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

function normalizeResolutionPreset(value: unknown): ProxyResolutionPreset {
  return value === '540p' || value === '1080p' ? value : DEFAULT_RESOLUTION_PRESET;
}

function normalizeTriggerShortEdge(value: unknown): ProxyTriggerThreshold {
  const numeric = typeof value === 'number' ? value : Number(value);
  return PROXY_TRIGGER_THRESHOLDS.includes(numeric as ProxyTriggerThreshold) ? (numeric as ProxyTriggerThreshold) : DEFAULT_TRIGGER_SHORT_EDGE;
}
