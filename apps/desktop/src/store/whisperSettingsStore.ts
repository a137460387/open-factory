import { create } from 'zustand';
import { saveLocalAiModelsSettings } from '../settings/appSettings';

const WHISPER_EXECUTABLE_KEY = 'open-factory:whisper-executable-path';
const WHISPER_MODEL_KEY = 'open-factory:whisper-model-path';

export interface WhisperSettingsState {
  executablePath: string;
  modelPath: string;
  setExecutablePath: (path: string) => void;
  setModelPath: (path: string) => void;
}

export const useWhisperSettingsStore = create<WhisperSettingsState>((set) => ({
  executablePath: readStoredPath(WHISPER_EXECUTABLE_KEY),
  modelPath: readStoredPath(WHISPER_MODEL_KEY),
  setExecutablePath: (executablePath) => {
    writeStoredPath(WHISPER_EXECUTABLE_KEY, executablePath);
    set({ executablePath });
  },
  setModelPath: (modelPath) => {
    writeStoredPath(WHISPER_MODEL_KEY, modelPath);
    void saveLocalAiModelsSettings({ whisper: { path: modelPath, version: 'whisper.cpp' } }).catch((error) => {
      console.warn('Unable to save Whisper model path', error);
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
