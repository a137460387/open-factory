export type AIProtocol = 'openai-compatible' | 'custom';

export interface AIProvider {
  id: string;
  name: string;
  protocol: AIProtocol;
  baseUrl: string;
  apiKey?: string;
  defaultModel: string;
  enabled: boolean;
  customHeaders?: Record<string, string>;
  isBuiltIn: boolean;
}

export interface AIUsageRecord {
  providerId: string;
  timestamp: number;
  inputTokens: number;
  outputTokens: number;
  estimatedCostCny: number;
}

export interface AITestConnectionResult {
  ok: boolean;
  latencyMs?: number;
  error?: string;
}

export interface AISubtitlePolishItem {
  index: number;
  text: string;
}

export interface AIChapterResult {
  time: number;
  title: string;
}

export interface AIVisionAnalysisResult {
  tags: string[];
  scene: string;
  mood: string;
  objects: string[];
}

export interface MediaAIAnalysis {
  tags: string[];
  scene: string;
  mood: string;
  objects: string[];
  analysisTime: string;
  providerId: string;
}

export interface BuiltInProviderPreset {
  id: string;
  name: string;
  baseUrl: string;
  defaultModel: string;
  needsKey: boolean;
}

export const BUILT_IN_PROVIDER_PRESETS: BuiltInProviderPreset[] = [
  { id: 'openai', name: 'OpenAI', baseUrl: 'https://api.openai.com/v1', defaultModel: 'gpt-4o', needsKey: true },
  { id: 'anthropic', name: 'Anthropic Claude', baseUrl: 'https://api.anthropic.com/v1', defaultModel: 'claude-sonnet-4-5', needsKey: true },
  { id: 'gemini', name: 'Google Gemini', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', defaultModel: 'gemini-2.0-flash', needsKey: true },
  { id: 'mimo', name: '小米 MiMo', baseUrl: 'https://api.xiaomimimo.com/v1', defaultModel: 'mimo-v2-flash', needsKey: true },
  { id: 'deepseek', name: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1', defaultModel: 'deepseek-chat', needsKey: true },
  { id: 'glm', name: '智谱AI (GLM)', baseUrl: 'https://open.bigmodel.cn/api/paas/v4', defaultModel: 'glm-4-flash', needsKey: true },
  { id: 'qwen', name: '阿里通义千问', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', defaultModel: 'qwen-plus', needsKey: true },
  { id: 'kimi', name: '月之暗面 (Kimi)', baseUrl: 'https://api.moonshot.cn/v1', defaultModel: 'moonshot-v1-8k', needsKey: true },
  { id: 'ernie', name: '百度文心', baseUrl: 'https://qianfan.baidubce.com/v2', defaultModel: 'ernie-4.0', needsKey: true },
  { id: 'spark', name: '讯飞星火', baseUrl: 'https://spark-api-open.xf-yun.com/v1', defaultModel: 'spark-max', needsKey: true },
  { id: 'doubao', name: '字节豆包', baseUrl: 'https://ark.cn-beijing.volces.com/api/v3', defaultModel: 'doubao-pro-32k', needsKey: true },
  { id: 'groq', name: 'Groq', baseUrl: 'https://api.groq.com/openai/v1', defaultModel: 'llama-3.3-70b', needsKey: true },
  { id: 'together', name: 'Together AI', baseUrl: 'https://api.together.xyz/v1', defaultModel: 'meta-llama/Llama-3-70b', needsKey: true },
  { id: 'elevenlabs', name: 'ElevenLabs', baseUrl: 'https://api.elevenlabs.io/v1', defaultModel: 'eleven_multilingual_v2', needsKey: true },
  { id: 'ollama', name: 'Ollama（本地）', baseUrl: 'http://localhost:11434/v1', defaultModel: 'llama3.2', needsKey: false }
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
    isBuiltIn: true
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
    defaultModel: typeof input.defaultModel === 'string' && input.defaultModel.trim() ? input.defaultModel.trim().slice(0, 200) : 'gpt-4o',
    enabled: input.enabled !== false,
    customHeaders: input.customHeaders && typeof input.customHeaders === 'object' ? { ...input.customHeaders } : undefined,
    isBuiltIn: input.isBuiltIn === true
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

export function isOllamaReachable(): boolean {
  return false;
}

export function calculateSubtitlePolishBatchSplit(total: number, batchSize = 50): number[] {
  if (total <= 0) {
    return [];
  }
  const batches: number[] = [];
  let remaining = total;
  while (remaining > 0) {
    const count = Math.min(batchSize, remaining);
    batches.push(count);
    remaining -= count;
  }
  return batches;
}

export function parseSubtitlePolishResponse(json: unknown): AISubtitlePolishItem[] {
  if (!Array.isArray(json)) {
    return [];
  }
  return json
    .filter((item) => item && typeof item === 'object' && typeof (item as AISubtitlePolishItem).index === 'number' && typeof (item as AISubtitlePolishItem).text === 'string')
    .map((item) => ({
      index: Math.max(0, Math.round((item as AISubtitlePolishItem).index)),
      text: ((item as AISubtitlePolishItem).text || '').trim()
    }))
    .filter((item) => item.text.length > 0);
}

export const FILLER_WORDS_ZH = ['嗯', '啊', '那个', '就是', '然后'];

export function removeFillerWords(text: string, fillers: string[] = FILLER_WORDS_ZH): string {
  let result = text;
  for (const filler of fillers) {
    result = result.replace(new RegExp(`${filler}(?=[，。！？、\\s]|$)`, 'g'), '');
  }
  return result.replace(/^[，。！？、\s]+/, '').replace(/\s{2,}/g, ' ').trim();
}

export function splitChapterSegments(durationSeconds: number, segmentMinSeconds = 60, segmentMaxSeconds = 90): Array<{ start: number; end: number }> {
  if (durationSeconds <= 0) {
    return [];
  }
  const avgSegment = (segmentMinSeconds + segmentMaxSeconds) / 2;
  const segmentCount = Math.max(1, Math.round(durationSeconds / avgSegment));
  const segmentDuration = durationSeconds / segmentCount;
  const segments: Array<{ start: number; end: number }> = [];
  for (let i = 0; i < segmentCount; i++) {
    segments.push({
      start: Math.round(i * segmentDuration * 100) / 100,
      end: Math.round(Math.min((i + 1) * segmentDuration, durationSeconds) * 100) / 100
    });
  }
  return segments;
}

export function suggestChapterCount(durationSeconds: number): { min: number; max: number } {
  if (durationSeconds <= 0) {
    return { min: 0, max: 0 };
  }
  const minutes = durationSeconds / 60;
  if (minutes <= 5) {
    return { min: 3, max: 5 };
  }
  if (minutes <= 15) {
    return { min: 5, max: 8 };
  }
  if (minutes <= 30) {
    return { min: 8, max: 12 };
  }
  if (minutes <= 60) {
    return { min: 12, max: 20 };
  }
  return { min: 15, max: 30 };
}

export function parseChapterResponse(json: unknown): AIChapterResult[] {
  if (!Array.isArray(json)) {
    return [];
  }
  return json
    .filter((item) => item && typeof item === 'object' && typeof (item as AIChapterResult).time === 'number' && typeof (item as AIChapterResult).title === 'string')
    .map((item) => ({
      time: Math.max(0, (item as AIChapterResult).time),
      title: ((item as AIChapterResult).title || '').trim().slice(0, 15)
    }))
    .filter((item) => item.title.length > 0)
    .sort((a, b) => a.time - b.time);
}

export function formatChaptersYouTube(chapters: AIChapterResult[]): string {
  return chapters
    .map((ch) => {
      const mins = Math.floor(ch.time / 60);
      const secs = Math.floor(ch.time % 60);
      return `${mins}:${secs.toString().padStart(2, '0')} ${ch.title}`;
    })
    .join('\n');
}

export function formatChaptersBilibili(chapters: AIChapterResult[]): string {
  return chapters
    .map((ch) => {
      const mins = Math.floor(ch.time / 60);
      const secs = Math.floor(ch.time % 60);
      return `${mins}:${secs.toString().padStart(2, '0')} ${ch.title}`;
    })
    .join('\n');
}

export function calculateExtractFrameTimes(duration: number, maxFrames = 5): number[] {
  if (duration <= 0 || maxFrames <= 0) {
    return [];
  }
  const frameCount = Math.min(maxFrames, Math.max(1, Math.floor(duration / 6)));
  const interval = duration / (frameCount + 1);
  const times: number[] = [];
  for (let i = 1; i <= frameCount; i++) {
    times.push(Math.round(interval * i * 100) / 100);
  }
  return times;
}

export function parseVisionAnalysisResponse(json: unknown): AIVisionAnalysisResult {
  if (!json || typeof json !== 'object') {
    return { tags: [], scene: '', mood: '', objects: [] };
  }
  const input = json as Record<string, unknown>;
  const tags = Array.isArray(input.tags) ? (input.tags as unknown[]).filter((t): t is string => typeof t === 'string').map((t) => t.trim()).filter(Boolean) : [];
  const scene = typeof input.scene === 'string' ? input.scene.trim() : '';
  const mood = typeof input.mood === 'string' ? input.mood.trim() : '';
  const objects = Array.isArray(input.objects) ? (input.objects as unknown[]).filter((o): o is string => typeof o === 'string').map((o) => o.trim()).filter(Boolean) : [];
  return { tags, scene, mood, objects };
}

export function mergeAITags(existing: string[], newTags: string[]): string[] {
  const seen = new Set(existing.map((t) => t.toLowerCase()));
  const merged = [...existing];
  for (const tag of newTags) {
    const lower = tag.toLowerCase();
    if (!seen.has(lower)) {
      seen.add(lower);
      merged.push(tag);
    }
  }
  return merged;
}

export function estimateVisionCost(frameCount: number, model: string): { tokens: number; costCny: number } {
  const baseTokensPerFrame = 800;
  const totalTokens = frameCount * baseTokensPerFrame + 500;
  let costPer1k = 0.01;
  const lower = model.toLowerCase();
  if (lower.includes('gpt-4o')) {
    costPer1k = 0.02;
  } else if (lower.includes('gemini')) {
    costPer1k = 0.005;
  } else if (lower.includes('qwen-vl')) {
    costPer1k = 0.008;
  }
  const estimatedCostCny = Math.round((totalTokens / 1000) * costPer1k * 100) / 100;
  return { tokens: totalTokens, costCny: estimatedCostCny };
}
