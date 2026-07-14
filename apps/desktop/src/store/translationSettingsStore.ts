import { create } from 'zustand';
import { readTranslationApiKey, writeTranslationApiKey } from '../lib/tauri-bridge';

export type TranslationProvider = 'deepl' | 'google';

export interface TranslationSettings {
  provider: TranslationProvider;
  apiKey: string;
  targetLanguage: string;
}

interface TranslationSettingsState extends TranslationSettings {
  apiKeyLoaded: boolean;
  apiKeyError?: string;
  loadApiKey(provider?: TranslationProvider): Promise<void>;
  setProvider(provider: TranslationProvider): void;
  setApiKey(apiKey: string): Promise<void>;
  setTargetLanguage(targetLanguage: string): void;
  reset(): Promise<void>;
}

interface StoredTranslationSettings {
  provider: TranslationProvider;
  targetLanguage: string;
}

interface StoredTranslationSettingsSnapshot {
  settings: StoredTranslationSettings;
  legacyApiKey?: string;
}

export const TRANSLATION_SETTINGS_STORAGE_KEY = 'open-factory:translation-settings';
export const TRANSLATION_API_KEY_REENTRY_MESSAGE = '请重新输入 API Key';

export const DEFAULT_TRANSLATION_SETTINGS: TranslationSettings = {
  provider: 'deepl',
  apiKey: '',
  targetLanguage: 'ZH',
};

export const useTranslationSettingsStore = create<TranslationSettingsState>((set, get) => ({
  ...readTranslationSettings(),
  apiKeyLoaded: false,
  apiKeyError: undefined,
  async loadApiKey(providerOverride) {
    const provider = providerOverride ?? get().provider;
    const legacyApiKey = readLegacyApiKeyForProvider(provider);
    set({ apiKeyLoaded: false, apiKeyError: undefined });
    if (legacyApiKey) {
      try {
        await writeTranslationApiKey(provider, legacyApiKey);
        clearLegacyApiKey();
        if (get().provider === provider) {
          set({ apiKey: legacyApiKey, apiKeyLoaded: true, apiKeyError: undefined });
        }
      } catch {
        if (get().provider === provider) {
          set({ apiKey: '', apiKeyLoaded: true, apiKeyError: TRANSLATION_API_KEY_REENTRY_MESSAGE });
        }
      }
      return;
    }
    try {
      const apiKey = await readTranslationApiKey(provider);
      if (get().provider === provider) {
        set({ apiKey: apiKey ?? '', apiKeyLoaded: true, apiKeyError: undefined });
      }
    } catch {
      if (get().provider === provider) {
        set({ apiKey: '', apiKeyLoaded: true, apiKeyError: TRANSLATION_API_KEY_REENTRY_MESSAGE });
      }
    }
  },
  setProvider(provider) {
    const targetLanguage = get().targetLanguage;
    writeTranslationSettings({ provider, targetLanguage });
    set({ provider, apiKey: '', apiKeyLoaded: false, apiKeyError: undefined });
    void get().loadApiKey(provider);
  },
  async setApiKey(apiKey) {
    const provider = get().provider;
    set({ apiKey, apiKeyLoaded: true, apiKeyError: undefined });
    try {
      await writeTranslationApiKey(provider, apiKey);
    } catch {
      if (get().provider === provider) {
        set({ apiKeyError: TRANSLATION_API_KEY_REENTRY_MESSAGE });
      }
    }
  },
  setTargetLanguage(targetLanguage) {
    const nextTargetLanguage = normalizeTargetLanguage(targetLanguage);
    writeTranslationSettings({ provider: get().provider, targetLanguage: nextTargetLanguage });
    set({ targetLanguage: nextTargetLanguage });
  },
  async reset() {
    writeTranslationSettings(DEFAULT_TRANSLATION_SETTINGS);
    set({ ...DEFAULT_TRANSLATION_SETTINGS, apiKeyLoaded: true, apiKeyError: undefined });
    try {
      await Promise.all([writeTranslationApiKey('deepl', undefined), writeTranslationApiKey('google', undefined)]);
    } catch {
      set({ apiKeyError: TRANSLATION_API_KEY_REENTRY_MESSAGE });
    }
  },
}));

export function readTranslationSettings(): TranslationSettings {
  const { settings } = readStoredTranslationSettings();
  return {
    ...settings,
    apiKey: '',
  };
}

export function isTranslationConfigured(settings: TranslationSettings): boolean {
  return settings.apiKey.trim().length > 0 && settings.targetLanguage.trim().length > 0;
}

function readStoredTranslationSettings(): StoredTranslationSettingsSnapshot {
  if (typeof localStorage === 'undefined') {
    return { settings: storedDefaults() };
  }
  try {
    const parsed = JSON.parse(
      localStorage.getItem(TRANSLATION_SETTINGS_STORAGE_KEY) ?? '{}',
    ) as Partial<TranslationSettings>;
    return {
      settings: {
        provider: parsed.provider === 'google' ? 'google' : 'deepl',
        targetLanguage: normalizeTargetLanguage(parsed.targetLanguage),
      },
      legacyApiKey: typeof parsed.apiKey === 'string' && parsed.apiKey.trim() ? parsed.apiKey : undefined,
    };
  } catch {
    return { settings: storedDefaults() };
  }
}

function readLegacyApiKeyForProvider(provider: TranslationProvider): string | undefined {
  const snapshot = readStoredTranslationSettings();
  return snapshot.settings.provider === provider ? snapshot.legacyApiKey : undefined;
}

function clearLegacyApiKey(): void {
  const { provider, targetLanguage } = readStoredTranslationSettings().settings;
  writeTranslationSettings({ provider, targetLanguage });
}

function writeTranslationSettings(settings: Pick<TranslationSettings, 'provider' | 'targetLanguage'>): void {
  if (typeof localStorage === 'undefined') {
    return;
  }
  localStorage.setItem(
    TRANSLATION_SETTINGS_STORAGE_KEY,
    JSON.stringify({
      provider: settings.provider,
      targetLanguage: normalizeTargetLanguage(settings.targetLanguage),
    }),
  );
}

function storedDefaults(): StoredTranslationSettings {
  return {
    provider: DEFAULT_TRANSLATION_SETTINGS.provider,
    targetLanguage: DEFAULT_TRANSLATION_SETTINGS.targetLanguage,
  };
}

function normalizeTargetLanguage(value: unknown): string {
  const normalized = typeof value === 'string' ? value.trim().toUpperCase() : '';
  return normalized || DEFAULT_TRANSLATION_SETTINGS.targetLanguage;
}
