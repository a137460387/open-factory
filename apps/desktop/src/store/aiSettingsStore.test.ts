import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@open-factory/editor-core', () => ({
  createAllBuiltInProviders: () => [
    { id: 'openai', name: 'OpenAI', protocol: 'openai-compatible', baseUrl: 'https://api.openai.com/v1', defaultModel: 'gpt-4o', enabled: true, isBuiltIn: true },
    { id: 'elevenlabs', name: 'ElevenLabs', protocol: 'openai-compatible', baseUrl: 'https://api.elevenlabs.io/v1', defaultModel: 'eleven_multilingual_v2', enabled: true, isBuiltIn: true },
  ],
}));

vi.mock('../lib/tauri-bridge', () => ({
  readAiApiKey: vi.fn().mockResolvedValue(null),
  writeAiApiKey: vi.fn().mockResolvedValue(undefined),
  checkOllamaReachable: vi.fn().mockResolvedValue(false),
  listOllamaModels: vi.fn().mockResolvedValue({ models: [] }),
  testAiConnection: vi.fn().mockResolvedValue(true),
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

import { useAISettingsStore } from './aiSettingsStore';

describe('aiSettingsStore', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
    // Reset store to initial state
    useAISettingsStore.setState({
      providers: [],
      serviceMapping: {} as Record<string, string>,
      usageRecords: [],
      ollamaReachable: false,
      ollamaModels: [],
      loadedProviderKeys: new Set(),
      testResults: {},
      ttsVoiceId: '',
      ttsSpeed: 1.0,
      ttsStability: 0.5,
      costAlertThreshold: 0,
    });
  });

  describe('setCostAlertThreshold', () => {
    it('更新阈值', () => {
      const { setCostAlertThreshold } = useAISettingsStore.getState();
      setCostAlertThreshold(100);
      expect(useAISettingsStore.getState().costAlertThreshold).toBe(100);
    });
  });

  describe('setTtsVoiceId', () => {
    it('更新语音 ID', () => {
      const { setTtsVoiceId } = useAISettingsStore.getState();
      setTtsVoiceId('voice-123');
      expect(useAISettingsStore.getState().ttsVoiceId).toBe('voice-123');
    });
  });

  describe('setTtsSpeed', () => {
    it('更新语速', () => {
      const { setTtsSpeed } = useAISettingsStore.getState();
      setTtsSpeed(1.5);
      expect(useAISettingsStore.getState().ttsSpeed).toBe(1.5);
    });
  });

  describe('setTtsStability', () => {
    it('更新稳定性', () => {
      const { setTtsStability } = useAISettingsStore.getState();
      setTtsStability(0.8);
      expect(useAISettingsStore.getState().ttsStability).toBe(0.8);
    });
  });

  describe('toggleProvider', () => {
    it('切换 provider 启用状态', () => {
      useAISettingsStore.setState({
        providers: [
          { id: 'openai', name: 'OpenAI', protocol: 'openai-compatible', baseUrl: 'https://api.openai.com/v1', defaultModel: 'gpt-4o', enabled: true, isBuiltIn: true },
        ],
      });

      const { toggleProvider } = useAISettingsStore.getState();
      toggleProvider('openai', false);

      const provider = useAISettingsStore.getState().providers.find((p) => p.id === 'openai');
      expect(provider?.enabled).toBe(false);
    });
  });

  describe('addCustomProvider', () => {
    it('添加自定义 provider', () => {
      const { addCustomProvider } = useAISettingsStore.getState();
      const custom = {
        id: 'custom-1',
        name: 'My API',
        protocol: 'openai-compatible' as const,
        baseUrl: 'https://my-api.com/v1',
        defaultModel: 'gpt-4o',
        enabled: true,
        isBuiltIn: false,
      };
      addCustomProvider(custom);

      const providers = useAISettingsStore.getState().providers;
      expect(providers).toHaveLength(1);
      expect(providers[0].id).toBe('custom-1');
    });

    it('拒绝重复 ID', () => {
      const { addCustomProvider } = useAISettingsStore.getState();
      const custom = {
        id: 'custom-1',
        name: 'My API',
        protocol: 'openai-compatible' as const,
        baseUrl: 'https://my-api.com/v1',
        defaultModel: 'gpt-4o',
        enabled: true,
        isBuiltIn: false,
      };
      addCustomProvider(custom);
      addCustomProvider({ ...custom, name: 'Duplicate' });

      expect(useAISettingsStore.getState().providers).toHaveLength(1);
    });
  });

  describe('removeCustomProvider', () => {
    it('移除自定义 provider', () => {
      useAISettingsStore.setState({
        providers: [
          { id: 'custom-1', name: 'My API', protocol: 'openai-compatible', baseUrl: 'https://my-api.com/v1', defaultModel: 'gpt-4o', enabled: true, isBuiltIn: false },
          { id: 'openai', name: 'OpenAI', protocol: 'openai-compatible', baseUrl: 'https://api.openai.com/v1', defaultModel: 'gpt-4o', enabled: true, isBuiltIn: true },
        ],
      });

      const { removeCustomProvider } = useAISettingsStore.getState();
      removeCustomProvider('custom-1');

      expect(useAISettingsStore.getState().providers).toHaveLength(1);
      expect(useAISettingsStore.getState().providers[0].id).toBe('openai');
    });

    it('不能移除内置 provider', () => {
      useAISettingsStore.setState({
        providers: [
          { id: 'openai', name: 'OpenAI', protocol: 'openai-compatible', baseUrl: 'https://api.openai.com/v1', defaultModel: 'gpt-4o', enabled: true, isBuiltIn: true },
        ],
      });

      const { removeCustomProvider } = useAISettingsStore.getState();
      removeCustomProvider('openai');

      expect(useAISettingsStore.getState().providers).toHaveLength(1);
    });
  });

  describe('setServiceMapping', () => {
    it('更新服务映射', () => {
      const { setServiceMapping } = useAISettingsStore.getState();
      setServiceMapping('subtitle-polish', 'elevenlabs');

      expect(useAISettingsStore.getState().serviceMapping['subtitle-polish']).toBe('elevenlabs');
    });
  });

  describe('addUsageRecord', () => {
    it('添加使用记录', () => {
      const { addUsageRecord } = useAISettingsStore.getState();
      addUsageRecord({
        providerId: 'openai',
        service: 'subtitle-polish',
        inputTokens: 100,
        outputTokens: 50,
        estimatedCostCny: 0.01,
        timestamp: Date.now(),
      });

      expect(useAISettingsStore.getState().usageRecords).toHaveLength(1);
    });

    it('最多保留 100 条记录', () => {
      const { addUsageRecord } = useAISettingsStore.getState();
      for (let i = 0; i < 110; i++) {
        addUsageRecord({
          providerId: 'openai',
          service: 'subtitle-polish',
          inputTokens: 100,
          outputTokens: 50,
          estimatedCostCny: 0.01,
          timestamp: Date.now() + i,
        });
      }

      expect(useAISettingsStore.getState().usageRecords).toHaveLength(100);
    });
  });

  describe('updateProvider', () => {
    it('更新 provider 属性', () => {
      useAISettingsStore.setState({
        providers: [
          { id: 'openai', name: 'OpenAI', protocol: 'openai-compatible', baseUrl: 'https://api.openai.com/v1', defaultModel: 'gpt-4o', enabled: true, isBuiltIn: true },
        ],
      });

      const { updateProvider } = useAISettingsStore.getState();
      updateProvider('openai', { defaultModel: 'gpt-4o-mini' });

      const provider = useAISettingsStore.getState().providers.find((p) => p.id === 'openai');
      expect(provider?.defaultModel).toBe('gpt-4o-mini');
    });

    it('不能修改 id 和 isBuiltIn', () => {
      useAISettingsStore.setState({
        providers: [
          { id: 'openai', name: 'OpenAI', protocol: 'openai-compatible', baseUrl: 'https://api.openai.com/v1', defaultModel: 'gpt-4o', enabled: true, isBuiltIn: true },
        ],
      });

      const { updateProvider } = useAISettingsStore.getState();
      updateProvider('openai', { id: 'hacked', isBuiltIn: false } as never);

      const provider = useAISettingsStore.getState().providers[0];
      expect(provider.id).toBe('openai');
      expect(provider.isBuiltIn).toBe(true);
    });
  });
});
