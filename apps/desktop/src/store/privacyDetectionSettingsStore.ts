import { create } from 'zustand';
import { saveLocalAiModelsSettings } from '../settings/appSettings';

const PRIVACY_MODEL_KEY = 'open-factory:privacy-detection-model-path';

export interface PrivacyDetectionSettingsState {
  modelPath: string;
  setModelPath: (path: string) => void;
}

export const usePrivacyDetectionSettingsStore = create<PrivacyDetectionSettingsState>((set) => ({
  modelPath: readStoredPath(PRIVACY_MODEL_KEY),
  setModelPath: (modelPath) => {
    writeStoredPath(PRIVACY_MODEL_KEY, modelPath);
    void saveLocalAiModelsSettings({ yunet: { path: modelPath, version: 'YuNet ONNX' } }).catch((error) => {
      console.warn('Unable to save YuNet model path', error);
    });
    set({ modelPath });
  },
}));

function readStoredPath(key: string): string {
  if (typeof window === 'undefined') {
    return '';
  }
  return window.localStorage.getItem(key) ?? '';
}

function writeStoredPath(key: string, value: string): void {
  if (typeof window === 'undefined') {
    return;
  }
  const trimmed = value.trim();
  if (trimmed) {
    window.localStorage.setItem(key, trimmed);
  } else {
    window.localStorage.removeItem(key);
  }
}
