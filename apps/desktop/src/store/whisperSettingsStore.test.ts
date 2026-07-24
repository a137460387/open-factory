import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../settings/appSettings', () => ({
  saveLocalAiModelsSettings: vi.fn().mockResolvedValue(undefined),
}));

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: vi.fn(() => { store = {}; }),
  };
})();

Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock });
Object.defineProperty(globalThis, 'window', { value: { localStorage: localStorageMock } });

import { useWhisperSettingsStore } from './whisperSettingsStore';

describe('whisperSettingsStore', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
    useWhisperSettingsStore.setState({ executablePath: '', modelPath: '' });
  });

  it('默认值为空字符串', () => {
    const state = useWhisperSettingsStore.getState();
    expect(state.executablePath).toBe('');
    expect(state.modelPath).toBe('');
  });

  describe('setExecutablePath', () => {
    it('更新状态并写入 localStorage', () => {
      const { setExecutablePath } = useWhisperSettingsStore.getState();
      setExecutablePath('/usr/bin/whisper');

      expect(useWhisperSettingsStore.getState().executablePath).toBe('/usr/bin/whisper');
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'open-factory:whisper-executable-path',
        '/usr/bin/whisper',
      );
    });

    it('空字符串时从 localStorage 移除', () => {
      localStorageMock.setItem('open-factory:whisper-executable-path', '/old/path');
      const { setExecutablePath } = useWhisperSettingsStore.getState();
      setExecutablePath('');

      expect(useWhisperSettingsStore.getState().executablePath).toBe('');
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('open-factory:whisper-executable-path');
    });

    it('去除首尾空格后存储', () => {
      const { setExecutablePath } = useWhisperSettingsStore.getState();
      setExecutablePath('  /path/with/spaces  ');

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'open-factory:whisper-executable-path',
        '/path/with/spaces',
      );
    });
  });

  describe('setModelPath', () => {
    it('更新状态并写入 localStorage', () => {
      const { setModelPath } = useWhisperSettingsStore.getState();
      setModelPath('/models/ggml-base.bin');

      expect(useWhisperSettingsStore.getState().modelPath).toBe('/models/ggml-base.bin');
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'open-factory:whisper-model-path',
        '/models/ggml-base.bin',
      );
    });

    it('空字符串时从 localStorage 移除', () => {
      const { setModelPath } = useWhisperSettingsStore.getState();
      setModelPath('');

      expect(useWhisperSettingsStore.getState().modelPath).toBe('');
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('open-factory:whisper-model-path');
    });
  });
});
