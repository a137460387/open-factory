import { create } from 'zustand';

export type TranslationProvider = 'deepl' | 'google';

export interface TranslationSettings {
  provider: TranslationProvider;
  apiKey: string;
  targetLanguage: string;
}

interface TranslationSettingsState extends TranslationSettings {
  setProvider(provider: TranslationProvider): void;
  setApiKey(apiKey: string): void;
  setTargetLanguage(targetLanguage: string): void;
  reset(): void;
}

const STORAGE_KEY = 'open-factory:translation-settings';

export const DEFAULT_TRANSLATION_SETTINGS: TranslationSettings = {
  provider: 'deepl',
  apiKey: '',
  targetLanguage: 'ZH'
};

export const useTranslationSettingsStore = create<TranslationSettingsState>((set, get) => ({
  ...readTranslationSettings(),
  setProvider(provider) {
    const next = { ...get(), provider };
    writeTranslationSettings(next);
    set({ provider });
  },
  setApiKey(apiKey) {
    const next = { ...get(), apiKey };
    writeTranslationSettings(next);
    set({ apiKey });
  },
  setTargetLanguage(targetLanguage) {
    const next = { ...get(), targetLanguage: normalizeTargetLanguage(targetLanguage) };
    writeTranslationSettings(next);
    set({ targetLanguage: next.targetLanguage });
  },
  reset() {
    writeTranslationSettings(DEFAULT_TRANSLATION_SETTINGS);
    set(DEFAULT_TRANSLATION_SETTINGS);
  }
}));

export function readTranslationSettings(): TranslationSettings {
  if (typeof localStorage === 'undefined') {
    return DEFAULT_TRANSLATION_SETTINGS;
  }
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Partial<TranslationSettings>;
    return {
      provider: parsed.provider === 'google' ? 'google' : 'deepl',
      apiKey: typeof parsed.apiKey === 'string' ? parsed.apiKey : '',
      targetLanguage: normalizeTargetLanguage(parsed.targetLanguage)
    };
  } catch {
    return DEFAULT_TRANSLATION_SETTINGS;
  }
}

export function isTranslationConfigured(settings: TranslationSettings): boolean {
  return settings.apiKey.trim().length > 0 && settings.targetLanguage.trim().length > 0;
}

function writeTranslationSettings(settings: TranslationSettings): void {
  if (typeof localStorage === 'undefined') {
    return;
  }
  // 安全说明：API Key 存储于用户本地 localStorage，不上传至任何服务器。
  // 桌面端生产环境建议迁移至 tauri-plugin-stronghold 或系统 Keychain。
  // 当前实现为临时方案，适用于个人使用场景。
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

function normalizeTargetLanguage(value: unknown): string {
  const normalized = typeof value === 'string' ? value.trim().toUpperCase() : '';
  return normalized || DEFAULT_TRANSLATION_SETTINGS.targetLanguage;
}
