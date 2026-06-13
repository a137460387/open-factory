import { create } from 'zustand';

const DEMUCS_EXECUTABLE_KEY = 'open-factory:demucs-executable-path';

export interface DemucsSettingsState {
  executablePath: string;
  setExecutablePath: (path: string) => void;
}

export const useDemucsSettingsStore = create<DemucsSettingsState>((set) => ({
  executablePath: readStoredPath(DEMUCS_EXECUTABLE_KEY),
  setExecutablePath: (executablePath) => {
    writeStoredPath(DEMUCS_EXECUTABLE_KEY, executablePath);
    set({ executablePath });
  }
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
