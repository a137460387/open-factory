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
  /** Which AI feature generated this record (optional for backward compat) */
  service?: string;
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

export interface AIColorGradingSuggestion {
  style: string;
  issues: string[];
  suggestions: AIColorGradingSuggestionItem[];
}

export interface AIColorGradingSuggestionItem {
  parameter: string;
  currentValue?: number;
  recommendedValue: number;
  reason: string;
}

export const COLOR_GRADING_PARAMETER_LIMITS: Record<string, { min: number; max: number }> = {
  brightness: { min: -1, max: 1 },
  contrast: { min: 0, max: 2 },
  saturation: { min: 0, max: 2 },
  hue: { min: -180, max: 180 },
  lift_r: { min: -1, max: 1 },
  lift_g: { min: -1, max: 1 },
  lift_b: { min: -1, max: 1 },
  gain_r: { min: -1, max: 1 },
  gain_g: { min: -1, max: 1 },
  gain_b: { min: -1, max: 1 }
};

export function parseColorGradingSuggestionResponse(json: unknown): AIColorGradingSuggestion | null {
  if (!json || typeof json !== 'object') return null;
  const input = json as Record<string, unknown>;
  const style = typeof input.style === 'string' ? input.style.trim() : '';
  const issues = Array.isArray(input.issues)
    ? (input.issues as unknown[]).filter((i): i is string => typeof i === 'string').map((i) => i.trim()).filter(Boolean)
    : [];
  if (!Array.isArray(input.suggestions)) return null;
  const suggestions: AIColorGradingSuggestionItem[] = [];
  for (const item of input.suggestions as unknown[]) {
    if (!item || typeof item !== 'object') continue;
    const entry = item as Record<string, unknown>;
    const parameter = typeof entry.parameter === 'string' ? entry.parameter.trim().toLowerCase() : '';
    if (!parameter || !(parameter in COLOR_GRADING_PARAMETER_LIMITS)) continue;
    const limits = COLOR_GRADING_PARAMETER_LIMITS[parameter];
    const recommendedRaw = typeof entry.recommendedValue === 'number' ? entry.recommendedValue : Number(entry.recommendedValue);
    if (!Number.isFinite(recommendedRaw)) continue;
    const recommendedValue = Math.min(limits.max, Math.max(limits.min, Math.round(recommendedRaw * 100) / 100));
    const currentRaw = typeof entry.currentValue === 'number' ? entry.currentValue : undefined;
    const currentValue = currentRaw !== undefined ? Math.min(limits.max, Math.max(limits.min, Math.round(currentRaw * 100) / 100)) : undefined;
    const reason = typeof entry.reason === 'string' ? entry.reason.trim() : '';
    suggestions.push({ parameter, currentValue, recommendedValue, reason });
  }
  if (suggestions.length === 0) return null;
  return { style, issues, suggestions };
}

export function buildColorGradingSystemPrompt(): string {
  return '你是一个专业的视频调色助手。用户会给你一帧视频画面的截图和当前的色彩校正参数。请分析画面的色调、曝光、饱和度等，给出调色建议。返回JSON格式：{"style": "风格描述", "issues": ["问题1","问题2"], "suggestions": [{"parameter": "brightness|contrast|saturation|hue|lift_r|lift_g|lift_b|gain_r|gain_g|gain_b", "currentValue": 当前值, "recommendedValue": 建议值, "reason": "原因"}]}。parameter取值范围：brightness(-1~1)、contrast(0~2)、saturation(0~2)、hue(-180~180)、lift_r/g/b(-1~1)、gain_r/g/b(-1~1)。只返回JSON，不要其他内容。';
}

export function mapColorParameterToColorCorrection(
  parameter: string,
  value: number
): { brightness?: number; contrast?: number; saturation?: number; hue?: number; threeWayColor?: { lift?: { r?: number; g?: number; b?: number }; gain?: { r?: number; g?: number; b?: number } } } | null {
  switch (parameter) {
    case 'brightness': return { brightness: value };
    case 'contrast': return { contrast: value };
    case 'saturation': return { saturation: value };
    case 'hue': return { hue: value };
    case 'lift_r': return { threeWayColor: { lift: { r: value } } };
    case 'lift_g': return { threeWayColor: { lift: { g: value } } };
    case 'lift_b': return { threeWayColor: { lift: { b: value } } };
    case 'gain_r': return { threeWayColor: { gain: { r: value } } };
    case 'gain_g': return { threeWayColor: { gain: { g: value } } };
    case 'gain_b': return { threeWayColor: { gain: { b: value } } };
    default: return null;
  }
}

export function buildColorGradingColorCorrectionPatch(
  selectedItems: Array<{ parameter: string; recommendedValue: number }>
): Record<string, unknown> | null {
  if (selectedItems.length === 0) return null;
  const patch: Record<string, unknown> = {};
  let threeWay: Record<string, unknown> | undefined;
  for (const item of selectedItems) {
    const mapped = mapColorParameterToColorCorrection(item.parameter, item.recommendedValue);
    if (!mapped) continue;
    if (mapped.threeWayColor) {
      if (!threeWay) threeWay = {};
      const tw = mapped.threeWayColor;
      if (tw.lift) {
        if (!threeWay.lift) threeWay.lift = {};
        Object.assign(threeWay.lift as Record<string, unknown>, tw.lift);
      }
      if (tw.gain) {
        if (!threeWay.gain) threeWay.gain = {};
        Object.assign(threeWay.gain as Record<string, unknown>, tw.gain);
      }
    } else {
      Object.assign(patch, mapped);
    }
  }
  if (threeWay) {
    patch.threeWayColor = threeWay;
  }
  return Object.keys(patch).length > 0 ? patch : null;
}

// ─── AI 粗剪助手 ───────────────────────────────────────────────

export interface AIRoughCutClip {
  mediaId: string;
  startTime: number;
  duration: number;
  trackIndex: number;
  reason: string;
}

export interface AIRoughCutMediaInfo {
  mediaId: string;
  filename: string;
  type: string;
  duration: number;
  tags?: string[];
  scene?: string;
  mood?: string;
}

export function buildMediaInfoForAI(media: Array<{ id: string; name: string; type: string; duration: number; aiAnalysis?: { tags?: string[]; scene?: string; mood?: string } }>): AIRoughCutMediaInfo[] {
  return media.map((m) => ({
    mediaId: m.id,
    filename: m.name,
    type: m.type,
    duration: m.duration,
    tags: m.aiAnalysis?.tags,
    scene: m.aiAnalysis?.scene,
    mood: m.aiAnalysis?.mood
  }));
}

export function buildRoughCutSystemPrompt(): string {
  return '你是一个专业的视频粗剪助手。用户会给你一个视频主题或脚本描述，以及媒体库中可用素材的信息。请根据主题和素材信息，返回一个粗剪建议的JSON数组。每个元素包含：mediaId（素材ID）、startTime（素材起始时间，秒）、duration（建议使用时长，秒）、trackIndex（轨道索引，从0开始）、reason（选择该素材的理由）。请优先使用有aiAnalysis标签的素材以获得更精准的匹配；如果没有aiAnalysis，根据文件名推断。只返回JSON数组，不要其他内容。';
}

export function parseRoughCutAIResponse(json: unknown): AIRoughCutClip[] {
  if (!Array.isArray(json)) {
    return [];
  }
  return json
    .filter(
      (item) =>
        item &&
        typeof item === 'object' &&
        typeof (item as AIRoughCutClip).mediaId === 'string' &&
        typeof (item as AIRoughCutClip).duration === 'number'
    )
    .map((item) => {
      const entry = item as AIRoughCutClip;
      return {
        mediaId: String(entry.mediaId).trim(),
        startTime: typeof entry.startTime === 'number' && Number.isFinite(entry.startTime) ? Math.max(0, entry.startTime) : 0,
        duration: Math.max(0.1, Number.isFinite(entry.duration) ? entry.duration : 3),
        trackIndex: typeof entry.trackIndex === 'number' && Number.isFinite(entry.trackIndex) ? Math.max(0, Math.round(entry.trackIndex)) : 0,
        reason: typeof entry.reason === 'string' ? entry.reason.trim() : ''
      };
    })
    .filter((item) => item.mediaId.length > 0);
}

export function buildRoughCutUserPrompt(description: string, mediaInfo: AIRoughCutMediaInfo[]): string {
  const lines = [`用户描述: ${description}`];
  lines.push('');
  lines.push('可用素材:');
  for (const m of mediaInfo) {
    const parts = [`ID: ${m.mediaId}`, `文件: ${m.filename}`, `类型: ${m.type}`, `时长: ${m.duration}秒`];
    if (m.tags && m.tags.length > 0) parts.push(`标签: ${m.tags.join(',')}`);
    if (m.scene) parts.push(`场景: ${m.scene}`);
    if (m.mood) parts.push(`氛围: ${m.mood}`);
    lines.push(parts.join(' | '));
  }
  return lines.join('\n');
}

export const ROUGH_CUT_TEMPLATES: Array<{ id: string; name: string; segments: Array<{ label: string; defaultDuration: number }> }> = [
  {
    id: 'promo',
    name: '产品宣传片',
    segments: [
      { label: '开场', defaultDuration: 5 },
      { label: '产品展示', defaultDuration: 20 },
      { label: '使用场景', defaultDuration: 15 },
      { label: '结尾', defaultDuration: 5 }
    ]
  },
  {
    id: 'story',
    name: '故事起承转合',
    segments: [
      { label: '起', defaultDuration: 10 },
      { label: '承', defaultDuration: 20 },
      { label: '转', defaultDuration: 15 },
      { label: '合', defaultDuration: 10 }
    ]
  },
  {
    id: 'problem-solution',
    name: '问题→解决方案→行动号召',
    segments: [
      { label: '问题', defaultDuration: 10 },
      { label: '解决方案', defaultDuration: 25 },
      { label: '行动号召', defaultDuration: 10 }
    ]
  }
];

// ─── TTS 配音 ──────────────────────────────────────────────────

export type TTSEngine = 'elevenlabs' | 'openai' | 'compatible';

export interface TTSConfig {
  providerId: string;
  baseUrl: string;
  engine: TTSEngine;
  voiceId: string;
  speed: number;
  /** ElevenLabs stability parameter (0-1), ignored for other engines */
  stability?: number;
  model?: string;
}

export interface TTSTask {
  text: string;
  startTime: number;
  duration: number;
  clipId?: string;
}

export interface TTSResult {
  cachePath: string;
  text: string;
  startTime: number;
  duration: number;
}

/**
 * Build TTS request endpoint URL for the given engine.
 * ElevenLabs: {baseUrl}/text-to-speech/{voiceId}
 * OpenAI / compatible: {baseUrl}/audio/speech
 */
export function buildTtsEndpoint(config: TTSConfig): string {
  const base = config.baseUrl.replace(/\/+$/, '');
  if (config.engine === 'elevenlabs') {
    return `${base}/text-to-speech/${encodeURIComponent(config.voiceId)}`;
  }
  return `${base}/audio/speech`;
}

/**
 * Build TTS request body.
 * ElevenLabs: { text, model_id, voice_settings: { stability, speed } }
 * OpenAI: { model, input, voice, speed }
 */
export function buildTtsRequestBody(text: string, config: TTSConfig): Record<string, unknown> {
  if (config.engine === 'elevenlabs') {
    return {
      text,
      model_id: config.model ?? 'eleven_multilingual_v2',
      voice_settings: {
        stability: config.stability ?? 0.5,
        speed: config.speed
      }
    };
  }
  return {
    model: config.model ?? 'tts-1',
    input: text,
    voice: config.voiceId,
    speed: config.speed
  };
}

/**
 * Generate a deterministic cache key for a TTS request.
 * Based on text content + voice + speed + stability + engine.
 */
export function generateTtsCacheKey(text: string, config: TTSConfig): string {
  const parts = [text, config.voiceId, String(config.speed), config.engine, config.providerId];
  if (config.engine === 'elevenlabs' && config.stability !== undefined) {
    parts.push(String(config.stability));
  }
  // Simple DJB2 hash as hex string
  let hash = 5381;
  for (const part of parts) {
    for (let i = 0; i < part.length; i++) {
      hash = ((hash << 5) + hash + part.charCodeAt(i)) >>> 0;
    }
  }
  return hash.toString(16).padStart(8, '0');
}

/**
 * Detect TTS engine from provider baseUrl patterns.
 */
export function detectTtsEngine(baseUrl: string, providerId: string): TTSEngine {
  const url = baseUrl.toLowerCase();
  if (url.includes('elevenlabs')) return 'elevenlabs';
  if (url.includes('openai')) return 'openai';
  if (providerId === 'elevenlabs') return 'elevenlabs';
  return 'compatible';
}


// ── AI Export Optimization Suggestions ─────────────────────────────────────

export const EXPORT_SUGGESTION_CACHE_TTL_MS = 5 * 60 * 1000;

export type AIExportSuggestionPriority = 'high' | 'medium' | 'low';

export interface AIExportSuggestion {
  parameter: string;
  currentValue: string;
  suggestedValue: string;
  reason: string;
  priority: AIExportSuggestionPriority;
}

export interface AIExportProjectInfo {
  durationSeconds: number;
  width: number;
  height: number;
  fps: number;
  trackCount: number;
  effectCount: number;
  hasSubtitle: boolean;
  hasHDR: boolean;
  clipCount: number;
}

/**
 * Build project info summary for AI export optimization.
 */
export function buildExportProjectInfo(project: {
  settings: { width: number; height: number; fps: number };
  timeline: { tracks: Array<{ type: string; clips: Array<Record<string, unknown>> }> };
}): AIExportProjectInfo {
  const tracks = project.timeline.tracks;
  const allClips = tracks.flatMap((t) => t.clips);
  const hasSubtitle = tracks.some((t) => t.type === 'subtitle');
  const effectCount = allClips.filter((c) => 'effects' in c && Array.isArray((c as Record<string, unknown>).effects) && ((c as Record<string, unknown>).effects as unknown[]).length > 0).length;
  const hasHDR = allClips.some((c) => {
    const style = (c as Record<string, unknown>).style as Record<string, unknown> | undefined;
    return Boolean(style && style.hdr);
  });
  const maxDuration = allClips.reduce((max, c) => {
    const end = ((c as Record<string, unknown>).start as number) + ((c as Record<string, unknown>).duration as number);
    return end > max ? end : max;
  }, 0);
  return {
    durationSeconds: Math.round(maxDuration),
    width: project.settings.width,
    height: project.settings.height,
    fps: project.settings.fps,
    trackCount: tracks.length,
    effectCount,
    hasSubtitle,
    hasHDR,
    clipCount: allClips.length
  };
}

/**
 * Build system prompt for AI export optimization.
 */
export function buildExportOptimizationSystemPrompt(): string {
  return [
    'You are an expert video encoding advisor. Analyze the current export preset and project info, then suggest parameter improvements.',
    'Return a JSON array of suggestion objects with exactly these fields:',
    '[{parameter: string, currentValue: string, suggestedValue: string, reason: string, priority: \'high\'|\'medium\'|\'low\'}]',
    '',
    'Cover these areas when relevant:',
    '* videoBitrate: whether bitrate matches content complexity (action-heavy vs talking-head)',
    '* audioBitrate: whether audio bitrate is appropriate for content type',
    '* loudnessNormalization: whether loudness normalization should be enabled',
    '* subtitleFormat: whether subtitle format matches target platform',
    '* videoCodec: whether the encoder is optimal for quality/speed',
    '* width/height: whether resolution matches source media',
    '* fps: whether frame rate matches source media',
    '* hardwareEncoding: whether GPU encoding is beneficial',
    '',
    'Only suggest changes that would genuinely improve the output. Return an empty array if the current settings are already optimal.',
    'Return ONLY the JSON array, no markdown fences or explanation.'
  ].join('\n');
}

/**
 * Build user prompt for AI export optimization.
 */
export function buildExportOptimizationUserPrompt(
  projectInfo: AIExportProjectInfo,
  presetSettings: {
    format?: string;
    videoCodec?: string;
    audioCodec?: string;
    videoBitrate?: string;
    audioBitrate?: string;
    width?: number;
    height?: number;
    fps?: number;
    loudnessNormalization?: string;
    subtitleFormat?: string;
    hardwareEncoding?: boolean;
    outputMode?: string;
  }
): string {
  return [
    'Project info:',
    '  Duration: ' + projectInfo.durationSeconds + 's',
    '  Resolution: ' + projectInfo.width + 'x' + projectInfo.height,
    '  FPS: ' + projectInfo.fps,
    '  Tracks: ' + projectInfo.trackCount + ' (' + projectInfo.clipCount + ' clips total)',
    '  Effects: ' + projectInfo.effectCount + ' clips with effects',
    '  Subtitles: ' + (projectInfo.hasSubtitle ? 'yes' : 'no'),
    '  HDR: ' + (projectInfo.hasHDR ? 'yes' : 'no'),
    '',
    'Current export preset:',
    '  Format: ' + (presetSettings.format ?? 'mp4'),
    '  Video codec: ' + (presetSettings.videoCodec ?? 'h264'),
    '  Audio codec: ' + (presetSettings.audioCodec ?? 'aac'),
    '  Video bitrate: ' + (presetSettings.videoBitrate ?? 'auto'),
    '  Audio bitrate: ' + (presetSettings.audioBitrate ?? 'auto'),
    '  Output resolution: ' + (presetSettings.width ?? projectInfo.width) + 'x' + (presetSettings.height ?? projectInfo.height),
    '  Output FPS: ' + (presetSettings.fps ?? projectInfo.fps),
    '  Loudness normalization: ' + (presetSettings.loudnessNormalization ?? 'off'),
    '  Subtitle format: ' + (presetSettings.subtitleFormat ?? 'none'),
    '  Hardware encoding: ' + (presetSettings.hardwareEncoding ? 'yes' : 'no'),
    '  Output mode: ' + (presetSettings.outputMode ?? 'video')
  ].join('\n');
}

/**
 * Parse AI export optimization response into typed suggestions.
 */
export function parseExportOptimizationResponse(json: unknown): AIExportSuggestion[] {
  if (!Array.isArray(json)) return [];
  const validPriorities = new Set<AIExportSuggestionPriority>(['high', 'medium', 'low']);
  return json
    .filter((item): item is Record<string, unknown> =>
      typeof item === 'object' && item !== null &&
      typeof (item as Record<string, unknown>).parameter === 'string' &&
      typeof (item as Record<string, unknown>).currentValue === 'string' &&
      typeof (item as Record<string, unknown>).suggestedValue === 'string' &&
      typeof (item as Record<string, unknown>).reason === 'string' &&
      validPriorities.has((item as Record<string, unknown>).priority as AIExportSuggestionPriority)
    )
    .map((item) => ({
      parameter: item.parameter as string,
      currentValue: item.currentValue as string,
      suggestedValue: item.suggestedValue as string,
      reason: item.reason as string,
      priority: item.priority as AIExportSuggestionPriority
    }));
}

const PRIORITY_ORDER: Record<AIExportSuggestionPriority, number> = { high: 0, medium: 1, low: 2 };

/**
 * Sort suggestions by priority (high first).
 */
export function sortExportSuggestionsByPriority(suggestions: AIExportSuggestion[]): AIExportSuggestion[] {
  return [...suggestions].sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);
}
