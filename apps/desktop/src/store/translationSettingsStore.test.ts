import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const bridgeMocks = vi.hoisted(() => ({
  readTranslationApiKey: vi.fn(),
  writeTranslationApiKey: vi.fn(),
}));

vi.mock('../lib/tauri-bridge', () => bridgeMocks);

function installLocalStorage() {
  const storage = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: vi.fn((key: string) => storage.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      storage.set(key, value);
    }),
    removeItem: vi.fn((key: string) => {
      storage.delete(key);
    }),
    clear: vi.fn(() => {
      storage.clear();
    }),
  });
}

async function loadStoreModule() {
  vi.resetModules();
  return import('./translationSettingsStore');
}

describe('translation settings store', () => {
  beforeEach(() => {
    installLocalStorage();
    bridgeMocks.readTranslationApiKey.mockReset();
    bridgeMocks.writeTranslationApiKey.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('does not expose legacy localStorage API keys through readTranslationSettings', async () => {
    localStorage.setItem(
      'open-factory:translation-settings',
      JSON.stringify({ provider: 'google', apiKey: 'legacy-key', targetLanguage: 'ja' }),
    );
    const { readTranslationSettings } = await loadStoreModule();

    expect(readTranslationSettings()).toEqual({ provider: 'google', apiKey: '', targetLanguage: 'JA' });
  });

  it('migrates a legacy localStorage API key into the keychain and clears the old field', async () => {
    bridgeMocks.writeTranslationApiKey.mockResolvedValue(undefined);
    localStorage.setItem(
      'open-factory:translation-settings',
      JSON.stringify({ provider: 'deepl', apiKey: 'legacy-key', targetLanguage: 'ZH' }),
    );
    const { useTranslationSettingsStore } = await loadStoreModule();

    await useTranslationSettingsStore.getState().loadApiKey();

    expect(bridgeMocks.writeTranslationApiKey).toHaveBeenCalledWith('deepl', 'legacy-key');
    expect(useTranslationSettingsStore.getState().apiKey).toBe('legacy-key');
    expect(JSON.parse(localStorage.getItem('open-factory:translation-settings') ?? '{}')).toEqual({
      provider: 'deepl',
      targetLanguage: 'ZH',
    });
  });

  it('keeps the legacy field and asks for re-entry when migration fails', async () => {
    bridgeMocks.writeTranslationApiKey.mockRejectedValue(new Error('keychain unavailable'));
    localStorage.setItem(
      'open-factory:translation-settings',
      JSON.stringify({ provider: 'deepl', apiKey: 'legacy-key', targetLanguage: 'ZH' }),
    );
    const { TRANSLATION_API_KEY_REENTRY_MESSAGE, useTranslationSettingsStore } = await loadStoreModule();

    await useTranslationSettingsStore.getState().loadApiKey();

    expect(useTranslationSettingsStore.getState().apiKey).toBe('');
    expect(useTranslationSettingsStore.getState().apiKeyError).toBe(TRANSLATION_API_KEY_REENTRY_MESSAGE);
    expect(JSON.parse(localStorage.getItem('open-factory:translation-settings') ?? '{}')).toMatchObject({
      apiKey: 'legacy-key',
    });
  });

  it('loads API keys from the keychain when no legacy key exists', async () => {
    bridgeMocks.readTranslationApiKey.mockResolvedValue('google-key');
    localStorage.setItem(
      'open-factory:translation-settings',
      JSON.stringify({ provider: 'google', targetLanguage: 'JA' }),
    );
    const { useTranslationSettingsStore } = await loadStoreModule();

    await useTranslationSettingsStore.getState().loadApiKey();

    expect(bridgeMocks.readTranslationApiKey).toHaveBeenCalledWith('google');
    expect(useTranslationSettingsStore.getState().apiKey).toBe('google-key');
    expect(useTranslationSettingsStore.getState().apiKeyError).toBeUndefined();
  });

  it('writes API keys to the keychain without writing them to localStorage', async () => {
    bridgeMocks.writeTranslationApiKey.mockResolvedValue(undefined);
    const { useTranslationSettingsStore } = await loadStoreModule();

    await useTranslationSettingsStore.getState().setApiKey('deepl-key');

    expect(bridgeMocks.writeTranslationApiKey).toHaveBeenCalledWith('deepl', 'deepl-key');
    expect(localStorage.getItem('open-factory:translation-settings') ?? '').not.toContain('deepl-key');
  });

  it('resets non-sensitive settings and clears both provider API keys', async () => {
    bridgeMocks.writeTranslationApiKey.mockResolvedValue(undefined);
    localStorage.setItem(
      'open-factory:translation-settings',
      JSON.stringify({ provider: 'google', targetLanguage: 'JA' }),
    );
    const { useTranslationSettingsStore } = await loadStoreModule();

    await useTranslationSettingsStore.getState().reset();

    expect(bridgeMocks.writeTranslationApiKey).toHaveBeenCalledWith('deepl', undefined);
    expect(bridgeMocks.writeTranslationApiKey).toHaveBeenCalledWith('google', undefined);
    expect(JSON.parse(localStorage.getItem('open-factory:translation-settings') ?? '{}')).toEqual({
      provider: 'deepl',
      targetLanguage: 'ZH',
    });
  });
});
