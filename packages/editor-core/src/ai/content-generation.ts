/**
 * AI 内容生成模块
 *
 * 功能：
 * 1. 字幕生成 - 基于音频能量检测与静音分段，自动对齐时间轴生成字幕
 * 2. AI 配音 - 文本分析 + 韵律生成 + 时间映射，输出配音参数
 * 3. AI 配乐 - 基于风格、情绪、节奏的音乐结构生成（intro-verse-chorus-outro）
 * 4. AI 特效 - 粒子 / 光效 / 天气等特效参数计算
 * 5. 统一配置、验证、估算、提示构建与 AI 响应解析
 * 6. 批量生成与进度事件
 *
 * 所有函数均为纯计算，无副作用。
 */

import type {AiModuleResult, TranslateFn} from '../ai-module-types';
import {identityTranslator} from '../ai-module-types';
import {clamp} from '../utils/math';
import type {
  ContentType,
  ContentQuality,
  ContentGenerationConfig,
  GeneratedContent,
  ContentGenerationResult,
} from './content-generation-types';
import {
  BASE_GENERATION_TIME_MS,
  QUALITY_TIME_FACTOR,
  generateId,
} from './content-generation-types';

// Re-export all types and constants
export type {
  ContentType,
  ContentQuality,
  MusicGenre,
  MusicMood,
  AIEffectType,
  SubtitlePosition,
  SubtitleStyleConfig,
  ContentGenerationConfig,
  SubtitleGenerationConfig,
  DubbingConfig,
  MusicGenerationConfig,
  EffectGenerationConfig,
  GeneratedContent,
  ContentGenerationResult,
  ContentGenerationBatchRequest,
  ContentGenerationProgressEvent,
  MusicSection,
  MusicStructure,
} from './content-generation-types';

export {
  QUALITY_TIME_FACTOR,
  BASE_GENERATION_TIME_MS,
  DEFAULT_MAX_CHARS_PER_LINE,
  DEFAULT_MAX_LINES,
  DEFAULT_FONT_SIZE,
  DEFAULT_SILENCE_THRESHOLD_DB,
  DEFAULT_MIN_SILENCE_DURATION_MS,
  DEFAULT_ENERGY_WINDOW_SIZE,
  GENRE_DEFAULT_TEMPO,
  GENRE_DEFAULT_KEY,
  MOOD_INTENSITY_BASE,
  EFFECT_BASE_PARTICLE_COUNT,
  DB_REF,
  generateId,
} from './content-generation-types';

// Re-export subtitle generation
export {computeAudioEnergyEnvelope, detectSilence, generateSubtitle} from './content-generation-subtitle';

// Re-export dubbing generation
export {generateDubbing} from './content-generation-dubbing';

// Re-export music generation
export {generateMusicStructure, generateMusic} from './content-generation-music';

// Re-export effect generation
export {generateEffect} from './content-generation-effect';

// ==================== Estimation & Config ====================

/**
 * 估算生成时间（毫秒）
 *
 * 基于内容类型、质量等级和配置参数综合估算。
 *
 * @param config - 内容生成配置
 * @returns 预估生成时间（毫秒）
 */
export function estimateGenerationTime(config: ContentGenerationConfig): number {
  const baseTime = BASE_GENERATION_TIME_MS[config.type];
  const qualityFactor = QUALITY_TIME_FACTOR[config.quality ?? 'standard'];
  const gpuFactor = config.enableGPU ? 0.6 : 1.0;

  let contentFactor = 1.0;

  // 根据自定义参数调整
  if (config.customParams) {
    // 如果有 duration 参数，按比例调整
    if (typeof config.customParams.duration === 'number') {
      contentFactor *= clamp(config.customParams.duration / 30, 0.5, 10);
    }
    // 如果有文本长度，按比例调整
    if (typeof config.customParams.textLength === 'number') {
      contentFactor *= clamp(config.customParams.textLength / 100, 0.3, 5);
    }
  }

  return Math.round(baseTime * qualityFactor * gpuFactor * contentFactor);
}

/**
 * 创建默认内容生成配置
 *
 * @param type - 内容类型
 * @returns 默认配置
 */
export function createDefaultContentGenerationConfig(type: ContentType): ContentGenerationConfig {
  return {
    type,
    language: 'auto',
    enableGPU: false,
    quality: 'standard',
    outputFormat: getDefaultOutputFormat(type),
    customParams: {},
  };
}

/**
 * 获取默认输出格式
 */
function getDefaultOutputFormat(type: ContentType): string {
  const formats: Record<ContentType, string> = {
    subtitle: 'srt',
    dubbing: 'wav',
    music: 'wav',
    effect: 'json',
    voiceover: 'wav',
  };
  return formats[type];
}

/**
 * 验证内容生成配置
 *
 * 检查配置参数的完整性和合法性。
 *
 * @param config - 内容生成配置
 * @returns 配置是否有效
 */
export function validateContentGenerationConfig(config: ContentGenerationConfig): boolean {
  if (!config || !config.type) {
    return false;
  }

  const validTypes: ContentType[] = ['subtitle', 'dubbing', 'music', 'effect', 'voiceover'];
  if (!validTypes.includes(config.type)) {
    return false;
  }

  if (config.quality !== undefined) {
    const validQualities: ContentQuality[] = ['draft', 'standard', 'high', 'ultra'];
    if (!validQualities.includes(config.quality)) {
      return false;
    }
  }

  return true;
}

// ==================== AI Prompt Building & Response Parsing ====================

/**
 * 构建 AI 系统提示
 *
 * 根据内容类型生成用于指导 AI 模型的系统提示词。
 *
 * @param type - 内容类型
 * @returns 系统提示词
 */
export function buildContentGenerationSystemPrompt(type: ContentType): string {
  const basePrompt = '你是一个专业的视频内容生成助手。请根据用户的要求生成高质量的内容，并以 JSON 格式返回结果。';

  const typePrompts: Record<ContentType, string> = {
    subtitle: `${basePrompt}
你的任务是为视频生成字幕。要求：
1. 字幕应自然断行，每行不超过指定字符数
2. 时间戳应与音频精确对齐
3. 支持多语言和说话人分离
4. 返回格式：{ "subtitles": [{ "text": string, "startMs": number, "endMs": number }] }`,

    dubbing: `${basePrompt}
你的任务是生成配音参数。要求：
1. 根据文本内容调整语速、音调和情感
2. 生成自然的韵律和停顿
3. 支持口型同步
4. 返回格式：{ "timeline": [{ "text": string, "startMs": number, "endMs": number, "speed": number, "pitch": number }] }`,

    music: `${basePrompt}
你的任务是生成配乐结构和参数。要求：
1. 根据指定风格和情绪生成音乐结构
2. 包含 intro-verse-chorus-outro 段落
3. 为每个段落指定乐器和动态参数
4. 返回格式：{ "structure": { "sections": [...] }, "arrangement": [...] }`,

    effect: `${basePrompt}
你的任务是生成视觉特效参数。要求：
1. 根据特效类型计算粒子/光效参数
2. 参数应可直接用于渲染引擎
3. 支持强度和时长调节
4. 返回格式：{ "effectType": string, "parameters": { ... } }`,

    voiceover: `${basePrompt}
你的任务是生成旁白配音参数。要求：
1. 根据文本内容生成自然的旁白节奏
2. 适当停顿以配合画面
3. 控制语速和情感表达
4. 返回格式：{ "segments": [{ "text": string, "startMs": number, "endMs": number, "speed": number }] }`,
  };

  return typePrompts[type];
}

/**
 * 构建 AI 用户提示
 *
 * 将配置参数转换为 AI 模型可理解的用户提示词。
 *
 * @param config - 内容生成配置
 * @returns 用户提示词
 */
export function buildContentGenerationUserPrompt(config: ContentGenerationConfig): string {
  const parts: string[] = [`请生成 ${config.type} 类型的内容。`];

  if (config.language && config.language !== 'auto') {
    parts.push(`语言：${config.language}。`);
  }

  if (config.quality) {
    parts.push(`质量等级：${config.quality}。`);
  }

  if (config.enableGPU) {
    parts.push('请启用 GPU 加速优化。');
  }

  if (config.outputFormat) {
    parts.push(`输出格式：${config.outputFormat}。`);
  }

  if (config.customParams) {
    const paramEntries = Object.entries(config.customParams);
    if (paramEntries.length > 0) {
      parts.push('自定义参数：');
      for (const [key, value] of paramEntries) {
        parts.push(`  - ${key}: ${JSON.stringify(value)}`);
      }
    }
  }

  parts.push('请以 JSON 格式返回结果。');

  return parts.join('\n');
}

/**
 * 解析 AI 内容生成响应
 *
 * 从 AI 返回的 JSON 中提取结构化的内容生成结果。
 * 如果解析失败则抛出异常。
 *
 * @param json - AI 返回的原始 JSON 数据
 * @param type - 内容类型
 * @returns 解析后的内容生成结果
 * @throws 当 JSON 格式不合法时抛出错误
 */
export function parseContentGenerationResponse(json: unknown, type: ContentType): ContentGenerationResult {
  if (!json || typeof json !== 'object') {
    throw new Error('无效的 AI 响应：不是对象');
  }

  const obj = json as Record<string, unknown>;
  const contents: GeneratedContent[] = [];
  const warnings: string[] = [];

  // 尝试从不同格式中提取内容
  const contentsSource = Array.isArray(obj.contents) ? obj.contents : Array.isArray(obj) ? obj : [obj];

  for (let i = 0; i < contentsSource.length; i++) {
    const item = contentsSource[i];
    if (!item || typeof item !== 'object') {
      warnings.push(`内容项 ${i} 不是有效对象，已跳过`);
      continue;
    }

    const itemObj = item as Record<string, unknown>;

    const content: GeneratedContent = {
      id: typeof itemObj.id === 'string' ? itemObj.id : generateId(type),
      type,
      data: itemObj.data ?? itemObj.parameters ?? itemObj,
      duration: typeof itemObj.duration === 'number' ? itemObj.duration : 0,
      metadata:
        typeof itemObj.metadata === 'object' && itemObj.metadata !== null
          ? (itemObj.metadata as Record<string, unknown>)
          : {},
      quality: isContentQuality(itemObj.quality) ? itemObj.quality : 'standard',
      generationTimeMs: typeof itemObj.generationTimeMs === 'number' ? itemObj.generationTimeMs : 0,
    };

    contents.push(content);
  }

  if (contents.length === 0) {
    throw new Error('AI 响应中没有有效内容');
  }

  return {
    contents,
    totalGenerationTimeMs:
      typeof obj.totalGenerationTimeMs === 'number'
        ? obj.totalGenerationTimeMs
        : contents.reduce((sum, c) => sum + c.generationTimeMs, 0),
    gpuUsed: typeof obj.gpuUsed === 'boolean' ? obj.gpuUsed : false,
    warnings,
  };
}

/**
 * 类型守卫：检查值是否为有效的 ContentQuality
 */
function isContentQuality(value: unknown): value is ContentQuality {
  return value === 'draft' || value === 'standard' || value === 'high' || value === 'ultra';
}

/**
 * 安全解析 AI 内容生成响应
 *
 * 包装 parseContentGenerationResponse，在解析失败时返回错误信息而非抛出异常。
 *
 * @param json - AI 返回的原始 JSON 数据
 * @param type - 内容类型
 * @param t - 可选的翻译函数
 * @returns 包装在 AiModuleResult 中的内容生成结果
 */
export async function parseContentGenerationResponseSafe(
  json: unknown,
  type: ContentType,
  t: TranslateFn = identityTranslator,
): Promise<AiModuleResult<ContentGenerationResult>> {
  try {
    const data = parseContentGenerationResponse(json, type);
    return { data, error: null };
  } catch {
    const emptyResult: ContentGenerationResult = {
      contents: [],
      totalGenerationTimeMs: 0,
      gpuUsed: false,
      warnings: [],
    };
    return { data: emptyResult, error: t('aiModules.error.parseFailed') };
  }
}
