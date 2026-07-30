import type { AIProvider, BuiltInProviderPreset } from './types';

export const BUILT_IN_PROVIDER_PRESETS: BuiltInProviderPreset[] = [
  { id: 'openai', name: 'OpenAI', baseUrl: 'https://api.openai.com/v1', defaultModel: 'gpt-4o', needsKey: true },
  {
    id: 'anthropic',
    name: 'Anthropic Claude',
    baseUrl: 'https://api.anthropic.com/v1',
    defaultModel: 'claude-sonnet-4-5',
    needsKey: true,
  },
  {
    id: 'gemini',
    name: 'Google Gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    defaultModel: 'gemini-2.0-flash',
    needsKey: true,
  },
  {
    id: 'mimo',
    name: '小米 MiMo',
    baseUrl: 'https://api.xiaomimimo.com/v1',
    defaultModel: 'mimo-v2-flash',
    needsKey: true,
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1',
    defaultModel: 'deepseek-chat',
    needsKey: true,
  },
  {
    id: 'glm',
    name: '智谱AI (GLM)',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    defaultModel: 'glm-4-flash',
    needsKey: true,
  },
  {
    id: 'qwen',
    name: '阿里通义千问',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    defaultModel: 'qwen-plus',
    needsKey: true,
  },
  {
    id: 'kimi',
    name: '月之暗面 (Kimi)',
    baseUrl: 'https://api.moonshot.cn/v1',
    defaultModel: 'moonshot-v1-8k',
    needsKey: true,
  },
  {
    id: 'ernie',
    name: '百度文心',
    baseUrl: 'https://qianfan.baidubce.com/v2',
    defaultModel: 'ernie-4.0',
    needsKey: true,
  },
  {
    id: 'spark',
    name: '讯飞星火',
    baseUrl: 'https://spark-api-open.xf-yun.com/v1',
    defaultModel: 'spark-max',
    needsKey: true,
  },
  {
    id: 'doubao',
    name: '字节豆包',
    baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
    defaultModel: 'doubao-pro-32k',
    needsKey: true,
  },
  {
    id: 'groq',
    name: 'Groq',
    baseUrl: 'https://api.groq.com/openai/v1',
    defaultModel: 'llama-3.3-70b',
    needsKey: true,
  },
  {
    id: 'together',
    name: 'Together AI',
    baseUrl: 'https://api.together.xyz/v1',
    defaultModel: 'meta-llama/Llama-3-70b',
    needsKey: true,
  },
  {
    id: 'elevenlabs',
    name: 'ElevenLabs',
    baseUrl: 'https://api.elevenlabs.io/v1',
    defaultModel: 'eleven_multilingual_v2',
    needsKey: true,
  },
  {
    id: 'ollama',
    name: 'Ollama（本地）',
    baseUrl: 'http://localhost:11434/v1',
    defaultModel: 'llama3.2',
    needsKey: false,
  },
];

export const VISION_KEYWORDS = ['vision', 'omni', '4o', 'gemini', 'vl', 'gpt-4o', 'claude-3', 'qwen-vl', 'glm-4v'];

export function createBuiltInProvider(preset: BuiltInProviderPreset): AIProvider {
  return {
    id: preset.id,
    name: preset.name,
    protocol: 'openai-compatible',
    baseUrl: preset.baseUrl,
    defaultModel: preset.defaultModel,
    enabled: preset.id === 'openai' || preset.id === 'ollama',
    isBuiltIn: true,
  };
}

export function createAllBuiltInProviders(): AIProvider[] {
  return BUILT_IN_PROVIDER_PRESETS.map(createBuiltInProvider);
}

export function normalizeAIProvider(input: Partial<AIProvider> & { id: string }): AIProvider {
  return {
    id: input.id.trim(),
    name: typeof input.name === 'string' && input.name.trim() ? input.name.trim().slice(0, 80) : input.id,
    protocol: input.protocol === 'custom' ? 'custom' : 'openai-compatible',
    baseUrl: typeof input.baseUrl === 'string' && input.baseUrl.trim() ? input.baseUrl.trim().slice(0, 500) : '',
    apiKey: typeof input.apiKey === 'string' ? input.apiKey : undefined,
    defaultModel:
      typeof input.defaultModel === 'string' && input.defaultModel.trim()
        ? input.defaultModel.trim().slice(0, 200)
        : 'gpt-4o',
    enabled: input.enabled !== false,
    customHeaders:
      input.customHeaders && typeof input.customHeaders === 'object' ? { ...input.customHeaders } : undefined,
    isBuiltIn: input.isBuiltIn === true,
  };
}

export function isVisionCapable(modelName: string): boolean {
  const lower = modelName.toLowerCase();
  return VISION_KEYWORDS.some((keyword) => lower.includes(keyword));
}

export function isProviderConfigured(provider: AIProvider): boolean {
  if (!provider.enabled) {
    return false;
  }
  const preset = BUILT_IN_PROVIDER_PRESETS.find((p) => p.id === provider.id);
  if (preset && !preset.needsKey) {
    return true;
  }
  return Boolean(provider.apiKey && provider.apiKey.trim().length > 0);
}
