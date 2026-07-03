import { create } from 'zustand';
import type { AIProvider, AIUsageRecord } from '@open-factory/editor-core';
import { createAllBuiltInProviders, isProviderConfigured } from '@open-factory/editor-core';
import { readAiApiKey, writeAiApiKey, checkOllamaReachable, listOllamaModels } from '../lib/tauri-bridge';

const AI_SETTINGS_STORAGE_KEY = 'open-factory:ai-settings';

export type AIServiceType = 'subtitle-polish' | 'chapter-title' | 'vision-analysis' | 'voiceover' | 'color-grading-suggestion' | 'rough-cut' | 'export-suggestion' | 'chat-editor' | 'video-summary' | 'narration-script';

interface StoredAIProvider {
  id: string;
  name: string;
  protocol: 'openai-compatible' | 'custom';
  baseUrl: string;
  defaultModel: string;
  enabled: boolean;
  customHeaders?: Record<string, string>;
  isBuiltIn: boolean;
}

interface StoredAISettings {
  providers: StoredAIProvider[];
  serviceMapping: Record<AIServiceType, string>;
  usageRecords: AIUsageRecord[];
  ttsVoiceId?: string;
  ttsSpeed?: number;
  ttsStability?: number;
  costAlertThreshold?: number;
}

interface AISettingsState {
  providers: AIProvider[];
  serviceMapping: Record<AIServiceType, string>;
  usageRecords: AIUsageRecord[];
  ollamaReachable: boolean;
  ollamaModels: string[];
  loadedProviderKeys: Set<string>;
  testResults: Record<string, { ok: boolean; latencyMs?: number }>;
  ttsVoiceId: string;
  ttsSpeed: number;
  ttsStability: number;
  costAlertThreshold: number;

  setCostAlertThreshold: (threshold: number) => void;

  setTtsVoiceId: (voiceId: string) => void;
  setTtsSpeed: (speed: number) => void;
  setTtsStability: (stability: number) => void;

  loadProviderKey: (providerId: string) => Promise<void>;
  setProviderApiKey: (providerId: string, apiKey: string) => Promise<void>;
  updateProvider: (providerId: string, patch: Partial<AIProvider>) => void;
  toggleProvider: (providerId: string, enabled: boolean) => void;
  addCustomProvider: (provider: AIProvider) => void;
  removeCustomProvider: (providerId: string) => void;
  setServiceMapping: (service: AIServiceType, providerId: string) => void;
  testConnection: (providerId: string) => Promise<boolean>;
  checkOllama: () => Promise<void>;
  addUsageRecord: (record: AIUsageRecord) => void;
}

function readStoredSettings(): StoredAISettings {
  if (typeof localStorage === 'undefined') {
    return { providers: [], serviceMapping: {} as Record<AIServiceType, string>, usageRecords: [] };
  }
  try {
    const parsed = JSON.parse(localStorage.getItem(AI_SETTINGS_STORAGE_KEY) ?? '{}') as Partial<StoredAISettings>;
    return {
      providers: Array.isArray(parsed.providers) ? parsed.providers : [],
      serviceMapping: (parsed.serviceMapping ?? {}) as Record<AIServiceType, string>,
      usageRecords: Array.isArray(parsed.usageRecords) ? parsed.usageRecords : []
    };
  } catch {
    return { providers: [], serviceMapping: {} as Record<AIServiceType, string>, usageRecords: [] };
  }
}

function writeStoredSettings(settings: StoredAISettings): void {
  if (typeof localStorage === 'undefined') {
    return;
  }
  const toStore: StoredAISettings = {
    providers: settings.providers.map((p) => ({
      id: p.id,
      name: p.name,
      protocol: p.protocol,
      baseUrl: p.baseUrl,
      defaultModel: p.defaultModel,
      enabled: p.enabled,
      customHeaders: p.customHeaders,
      isBuiltIn: p.isBuiltIn
    })),
    serviceMapping: settings.serviceMapping,
    usageRecords: settings.usageRecords.slice(-100),
    ttsVoiceId: settings.ttsVoiceId,
    ttsSpeed: settings.ttsSpeed,
    ttsStability: settings.ttsStability,
    costAlertThreshold: settings.costAlertThreshold
  };
  localStorage.setItem(AI_SETTINGS_STORAGE_KEY, JSON.stringify(toStore));
}

function mergeStoredProvidersWithBuiltIn(stored: StoredAIProvider[]): AIProvider[] {
  const builtIn = createAllBuiltInProviders();
  const storedMap = new Map(stored.map((p) => [p.id, p]));
  const result: AIProvider[] = [];

  for (const preset of builtIn) {
    const s = storedMap.get(preset.id);
    if (s) {
      result.push({
        ...preset,
        name: s.name,
        protocol: s.protocol,
        baseUrl: s.baseUrl,
        defaultModel: s.defaultModel,
        enabled: s.enabled,
        customHeaders: s.customHeaders
      });
    } else {
      result.push({ ...preset });
    }
  }

  for (const s of stored) {
    if (!builtIn.some((b) => b.id === s.id)) {
      result.push({
        ...s,
        apiKey: undefined
      });
    }
  }

  return result;
}

function initializeProviders(): AIProvider[] {
  const stored = readStoredSettings();
  return mergeStoredProvidersWithBuiltIn(stored.providers);
}

function initializeServiceMapping(): Record<AIServiceType, string> {
  const stored = readStoredSettings();
  return {
    'subtitle-polish': stored.serviceMapping['subtitle-polish'] ?? 'openai',
    'chapter-title': stored.serviceMapping['chapter-title'] ?? 'openai',
    'vision-analysis': stored.serviceMapping['vision-analysis'] ?? 'openai',
    'voiceover': stored.serviceMapping['voiceover'] ?? 'elevenlabs',
    'color-grading-suggestion': stored.serviceMapping['color-grading-suggestion'] ?? 'openai',
    'rough-cut': stored.serviceMapping['rough-cut'] ?? 'openai',
    'export-suggestion': stored.serviceMapping['export-suggestion'] ?? 'openai',
    'chat-editor': stored.serviceMapping['chat-editor'] ?? 'openai',
    'video-summary': stored.serviceMapping['video-summary'] ?? 'openai',
    'narration-script': stored.serviceMapping['narration-script'] ?? 'openai',
  };
}

export const useAISettingsStore = create<AISettingsState>((set, get) => ({
  providers: initializeProviders(),
  serviceMapping: initializeServiceMapping(),
  usageRecords: readStoredSettings().usageRecords,
  ollamaReachable: false,
  ollamaModels: [],
  loadedProviderKeys: new Set<string>(),
  testResults: {},
  ttsVoiceId: readStoredSettings().ttsVoiceId ?? '',
  ttsSpeed: readStoredSettings().ttsSpeed ?? 1.0,
  ttsStability: readStoredSettings().ttsStability ?? 0.5,
  costAlertThreshold: readStoredSettings().costAlertThreshold ?? 0,

  setTtsVoiceId(voiceId) {
    set({ ttsVoiceId: voiceId });
    writeStoredSettings(get());
  },
  setTtsSpeed(speed) {
    set({ ttsSpeed: speed });
    writeStoredSettings(get());
  },
  setTtsStability(stability) {
    set({ ttsStability: stability });
    writeStoredSettings(get());
  },

  setCostAlertThreshold(threshold) {
    set({ costAlertThreshold: threshold });
    writeStoredSettings(get());
  },

  async loadProviderKey(providerId) {
    if (get().loadedProviderKeys.has(providerId)) {
      return;
    }
    try {
      const key = await readAiApiKey(providerId);
      set((state) => {
        const providers = state.providers.map((p) =>
          p.id === providerId ? { ...p, apiKey: key ?? '' } : p
        );
        const loadedProviderKeys = new Set(state.loadedProviderKeys);
        loadedProviderKeys.add(providerId);
        return { providers, loadedProviderKeys };
      });
    } catch {
      // keychain read failed, leave as empty
    }
  },

  async setProviderApiKey(providerId, apiKey) {
    set((state) => ({
      providers: state.providers.map((p) =>
        p.id === providerId ? { ...p, apiKey } : p
      )
    }));
    try {
      await writeAiApiKey(providerId, apiKey || undefined);
    } catch {
      // keychain write failed
    }
  },

  updateProvider(providerId, patch) {
    set((state) => {
      const providers = state.providers.map((p) =>
        p.id === providerId ? { ...p, ...patch, id: providerId, isBuiltIn: p.isBuiltIn } : p
      );
      const stored = readStoredSettings();
      writeStoredSettings({ ...stored, providers: providers.map(toStoredProvider) });
      return { providers };
    });
  },

  toggleProvider(providerId, enabled) {
    get().updateProvider(providerId, { enabled });
  },

  addCustomProvider(provider) {
    set((state) => {
      if (state.providers.some((p) => p.id === provider.id)) {
        return state;
      }
      const providers = [...state.providers, { ...provider, isBuiltIn: false }];
      const stored = readStoredSettings();
      writeStoredSettings({ ...stored, providers: providers.map(toStoredProvider) });
      return { providers };
    });
  },

  removeCustomProvider(providerId) {
    set((state) => {
      const provider = state.providers.find((p) => p.id === providerId);
      if (!provider || provider.isBuiltIn) {
        return state;
      }
      const providers = state.providers.filter((p) => p.id !== providerId);
      const stored = readStoredSettings();
      writeStoredSettings({ ...stored, providers: providers.map(toStoredProvider) });
      return { providers };
    });
  },

  setServiceMapping(service, providerId) {
    set((state) => {
      const serviceMapping = { ...state.serviceMapping, [service]: providerId };
      const stored = readStoredSettings();
      writeStoredSettings({ ...stored, serviceMapping });
      return { serviceMapping };
    });
  },

  async testConnection(providerId) {
    const provider = get().providers.find((p) => p.id === providerId);
    if (!provider) {
      return false;
    }
    try {
      const { testAiConnection } = await import('../lib/tauri-bridge');
      const ok = await testAiConnection(provider.baseUrl, provider.apiKey, provider.id);
      set((state) => ({
        testResults: { ...state.testResults, [providerId]: { ok, latencyMs: ok ? 0 : undefined } }
      }));
      return ok;
    } catch (error: unknown) {
      set((state) => ({
        testResults: { ...state.testResults, [providerId]: { ok: false } }
      }));
      throw error;
    }
  },

  async checkOllama() {
    try {
      const reachable = await checkOllamaReachable();
      set({ ollamaReachable: reachable });
      if (reachable) {
        const result = await listOllamaModels();
        set({ ollamaModels: result.models.map((m) => m.name) });
      } else {
        set({ ollamaModels: [] });
      }
    } catch {
      set({ ollamaReachable: false, ollamaModels: [] });
    }
  },

  addUsageRecord(record) {
    set((state) => {
      const usageRecords = [...state.usageRecords, record].slice(-100);
      const stored = readStoredSettings();
      writeStoredSettings({ ...stored, usageRecords });
      return { usageRecords };
    });
  }
}));

function toStoredProvider(p: AIProvider): StoredAIProvider {
  return {
    id: p.id,
    name: p.name,
    protocol: p.protocol,
    baseUrl: p.baseUrl,
    defaultModel: p.defaultModel,
    enabled: p.enabled,
    customHeaders: p.customHeaders,
    isBuiltIn: p.isBuiltIn
  };
}

export function isAIServiceReady(service: AIServiceType): boolean {
  const state = useAISettingsStore.getState();
  const providerId = state.serviceMapping[service];
  const provider = state.providers.find((p) => p.id === providerId);
  return provider ? isProviderConfigured(provider) : false;
}

export function getAIServiceProvider(service: AIServiceType): AIProvider | undefined {
  const state = useAISettingsStore.getState();
  const providerId = state.serviceMapping[service];
  return state.providers.find((p) => p.id === providerId);
}
