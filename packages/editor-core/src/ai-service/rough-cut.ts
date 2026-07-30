import type { AIRoughCutClip, AIRoughCutMediaInfo } from './types';

export function buildMediaInfoForAI(
  media: Array<{
    id: string;
    name: string;
    type: string;
    duration: number;
    aiAnalysis?: { tags?: string[]; scene?: string; mood?: string };
  }>,
): AIRoughCutMediaInfo[] {
  return media.map((m) => ({
    mediaId: m.id,
    filename: m.name,
    type: m.type,
    duration: m.duration,
    tags: m.aiAnalysis?.tags,
    scene: m.aiAnalysis?.scene,
    mood: m.aiAnalysis?.mood,
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
        typeof (item as AIRoughCutClip).duration === 'number',
    )
    .map((item) => {
      const entry = item as AIRoughCutClip;
      return {
        mediaId: String(entry.mediaId).trim(),
        startTime:
          typeof entry.startTime === 'number' && Number.isFinite(entry.startTime) ? Math.max(0, entry.startTime) : 0,
        duration: Math.max(0.1, Number.isFinite(entry.duration) ? entry.duration : 3),
        trackIndex:
          typeof entry.trackIndex === 'number' && Number.isFinite(entry.trackIndex)
            ? Math.max(0, Math.round(entry.trackIndex))
            : 0,
        reason: typeof entry.reason === 'string' ? entry.reason.trim() : '',
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

export const ROUGH_CUT_TEMPLATES: Array<{
  id: string;
  name: string;
  segments: Array<{ label: string; defaultDuration: number }>;
}> = [
  {
    id: 'promo',
    name: '产品宣传片',
    segments: [
      { label: '开场', defaultDuration: 5 },
      { label: '产品展示', defaultDuration: 20 },
      { label: '使用场景', defaultDuration: 15 },
      { label: '结尾', defaultDuration: 5 },
    ],
  },
  {
    id: 'story',
    name: '故事起承转合',
    segments: [
      { label: '起', defaultDuration: 10 },
      { label: '承', defaultDuration: 20 },
      { label: '转', defaultDuration: 15 },
      { label: '合', defaultDuration: 10 },
    ],
  },
  {
    id: 'problem-solution',
    name: '问题→解决方案→行动号召',
    segments: [
      { label: '问题', defaultDuration: 10 },
      { label: '解决方案', defaultDuration: 25 },
      { label: '行动号召', defaultDuration: 10 },
    ],
  },
];
