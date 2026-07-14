/**
 * AI Chat Editor — 核心逻辑
 *
 * 负责：
 * 1. 定义允许的 action 白名单
 * 2. 验证 AI 返回的结构化 command
 * 3. 构建 system prompt（含时间线上下文）
 * 4. 解析 AI 响应为可执行的编辑命令
 * 5. 管理对话历史（LRU 20条）
 */

import type { Clip, Project, Timeline } from './model-types';
import { round } from './time';

// ─── Action 白名单 ─────────────────────────────────────────────────

export type ChatActionType =
  | 'setSpeed'
  | 'setVolume'
  | 'delete'
  | 'split'
  | 'trim'
  | 'deleteAllSilence'
  | 'setAllClipsSpeed'
  | 'applyColorPreset'
  | 'jumpTo'
  | 'selectClip'
  | 'query';

export const CHAT_ACTION_WHITELIST: ReadonlySet<ChatActionType> = new Set<ChatActionType>([
  'setSpeed',
  'setVolume',
  'delete',
  'split',
  'trim',
  'deleteAllSilence',
  'setAllClipsSpeed',
  'applyColorPreset',
  'jumpTo',
  'selectClip',
  'query',
]);

// ─── Chat Command 类型定义 ─────────────────────────────────────────

export interface ChatCommandBase {
  action: string;
}

export interface SetSpeedCommand extends ChatCommandBase {
  action: 'setSpeed';
  clipId: string;
  value: number;
}

export interface SetVolumeCommand extends ChatCommandBase {
  action: 'setVolume';
  clipId: string;
  value: number;
}

export interface DeleteCommand extends ChatCommandBase {
  action: 'delete';
  clipId: string;
}

export interface SplitCommand extends ChatCommandBase {
  action: 'split';
  clipId: string;
  atTime: number;
}

export interface TrimCommand extends ChatCommandBase {
  action: 'trim';
  clipId: string;
  trimStart: number;
  trimEnd: number;
}

export interface DeleteAllSilenceCommand extends ChatCommandBase {
  action: 'deleteAllSilence';
}

export interface SetAllClipsSpeedCommand extends ChatCommandBase {
  action: 'setAllClipsSpeed';
  value: number;
}

export interface ApplyColorPresetCommand extends ChatCommandBase {
  action: 'applyColorPreset';
  presetName: string;
}

export interface JumpToCommand extends ChatCommandBase {
  action: 'jumpTo';
  time: number;
}

export interface SelectClipCommand extends ChatCommandBase {
  action: 'selectClip';
  clipId: string;
}

export interface QueryCommand extends ChatCommandBase {
  action: 'query';
  answer: string;
}

export type ChatCommand =
  | SetSpeedCommand
  | SetVolumeCommand
  | DeleteCommand
  | SplitCommand
  | TrimCommand
  | DeleteAllSilenceCommand
  | SetAllClipsSpeedCommand
  | ApplyColorPresetCommand
  | JumpToCommand
  | SelectClipCommand
  | QueryCommand;

// ─── 验证 ─────────────────────────────────────────────────────────

export interface ChatActionValidationResult {
  valid: boolean;
  reason?: string;
}

/**
 * 验证单个 chat action 是否在白名单内且字段合法。
 * 非白名单 action 被视为 prompt injection，直接拒绝。
 */
export function validateChatAction(action: unknown): ChatActionValidationResult {
  if (!action || typeof action !== 'object') {
    return { valid: false, reason: 'action 不是有效对象' };
  }
  const obj = action as Record<string, unknown>;
  if (typeof obj.action !== 'string') {
    return { valid: false, reason: '缺少 action 字段' };
  }
  if (!CHAT_ACTION_WHITELIST.has(obj.action as ChatActionType)) {
    return { valid: false, reason: `不允许的操作类型: ${obj.action}` };
  }
  switch (obj.action) {
    case 'setSpeed':
    case 'setVolume': {
      if (typeof obj.clipId !== 'string' || !obj.clipId) {
        return { valid: false, reason: `${obj.action} 缺少 clipId` };
      }
      if (typeof obj.value !== 'number' || !Number.isFinite(obj.value)) {
        return { valid: false, reason: `${obj.action} 缺少有效 value` };
      }
      if (obj.action === 'setSpeed' && obj.value <= 0) {
        return { valid: false, reason: '速度值必须大于 0' };
      }
      if (obj.action === 'setVolume' && (obj.value < 0 || obj.value > 2)) {
        return { valid: false, reason: '音量值必须在 0~2 之间' };
      }
      break;
    }
    case 'delete':
    case 'selectClip': {
      if (typeof obj.clipId !== 'string' || !obj.clipId) {
        return { valid: false, reason: `${obj.action} 缺少 clipId` };
      }
      break;
    }
    case 'split': {
      if (typeof obj.clipId !== 'string' || !obj.clipId) {
        return { valid: false, reason: 'split 缺少 clipId' };
      }
      if (typeof obj.atTime !== 'number' || !Number.isFinite(obj.atTime) || obj.atTime < 0) {
        return { valid: false, reason: 'split 缺少有效 atTime' };
      }
      break;
    }
    case 'trim': {
      if (typeof obj.clipId !== 'string' || !obj.clipId) {
        return { valid: false, reason: 'trim 缺少 clipId' };
      }
      if (typeof obj.trimStart !== 'number' || !Number.isFinite(obj.trimStart) || obj.trimStart < 0) {
        return { valid: false, reason: 'trim 缺少有效 trimStart' };
      }
      if (typeof obj.trimEnd !== 'number' || !Number.isFinite(obj.trimEnd) || obj.trimEnd < 0) {
        return { valid: false, reason: 'trim 缺少有效 trimEnd' };
      }
      break;
    }
    case 'setAllClipsSpeed': {
      if (typeof obj.value !== 'number' || !Number.isFinite(obj.value) || obj.value <= 0) {
        return { valid: false, reason: 'setAllClipsSpeed 速度值必须大于 0' };
      }
      break;
    }
    case 'applyColorPreset': {
      if (typeof obj.presetName !== 'string' || !obj.presetName) {
        return { valid: false, reason: 'applyColorPreset 缺少 presetName' };
      }
      break;
    }
    case 'jumpTo': {
      if (typeof obj.time !== 'number' || !Number.isFinite(obj.time) || obj.time < 0) {
        return { valid: false, reason: 'jumpTo 缺少有效 time' };
      }
      break;
    }
    case 'query': {
      if (typeof obj.answer !== 'string') {
        return { valid: false, reason: 'query 缺少 answer 字段' };
      }
      break;
    }
    case 'deleteAllSilence':
      break;
  }
  return { valid: true };
}

// ─── 时间线上下文打包 ─────────────────────────────────────────────

export interface TimelineContext {
  clipCount: number;
  totalDuration: number;
  trackCount: number;
  selectedClipId?: string;
  selectedClipInfo?: {
    name: string;
    type: string;
    start: number;
    duration: number;
    speed: number;
    volume?: number;
  };
  clips: Array<{
    id: string;
    name: string;
    type: string;
    start: number;
    duration: number;
    speed: number;
    volume?: number;
  }>;
  markers?: Array<{ time: number; label: string }>;
}

/**
 * 将当前项目状态打包为 AI 可理解的简要上下文。
 */
export function buildTimelineContext(project: Project, selectedClipId?: string): TimelineContext {
  const timeline = project.timeline;
  const allClips: Clip[] = [];
  for (const track of timeline.tracks) {
    for (const clip of track.clips) {
      allClips.push(clip);
    }
  }
  const totalDuration = allClips.length > 0 ? round(Math.max(...allClips.map((c) => c.start + c.duration))) : 0;

  const clipSummaries = allClips.map((clip) => ({
    id: clip.id,
    name: clip.name,
    type: clip.type,
    start: round(clip.start),
    duration: round(clip.duration),
    speed: clip.speed,
    ...('volume' in clip ? { volume: (clip as { volume?: number }).volume } : {}),
  }));

  let selectedClipInfo: TimelineContext['selectedClipInfo'];
  if (selectedClipId) {
    const selected = allClips.find((c) => c.id === selectedClipId);
    if (selected) {
      selectedClipInfo = {
        name: selected.name,
        type: selected.type,
        start: round(selected.start),
        duration: round(selected.duration),
        speed: selected.speed,
        ...('volume' in selected ? { volume: (selected as { volume?: number }).volume } : {}),
      };
    }
  }

  const markers = timeline.markers?.map((m) => ({
    time: round(m.time),
    label: m.label ?? '',
  }));

  return {
    clipCount: allClips.length,
    totalDuration,
    trackCount: timeline.tracks.length,
    selectedClipId,
    selectedClipInfo,
    clips: clipSummaries,
    ...(markers && markers.length > 0 ? { markers } : {}),
  };
}

// ─── System Prompt ─────────────────────────────────────────────────

export function buildChatSystemPrompt(): string {
  return [
    '你是一个专业的视频编辑助手。用户会用自然语言描述剪辑需求，你需要理解意图后返回结构化的JSON命令。',
    '',
    '你必须且只能返回以下格式的JSON对象（单条命令）或JSON数组（多条命令）：',
    '',
    '支持的操作类型：',
    '',
    '1. setSpeed: 设置片段速度 — {"action":"setSpeed","clipId":"clip的id","value":0.5}',
    '2. setVolume: 设置片段音量 — {"action":"setVolume","clipId":"clip的id","value":0.8}',
    '3. delete: 删除片段 — {"action":"delete","clipId":"clip的id"}',
    '4. split: 在指定时间点拆分片段 — {"action":"split","clipId":"clip的id","atTime":10.5}',
    '5. trim: 裁剪片段 — {"action":"trim","clipId":"clip的id","trimStart":1,"trimEnd":2}',
    '6. deleteAllSilence: 删除所有静音片段 — {"action":"deleteAllSilence"}',
    '7. setAllClipsSpeed: 批量设置所有片段速度 — {"action":"setAllClipsSpeed","value":1.5}',
    '8. applyColorPreset: 应用调色预设 — {"action":"applyColorPreset","presetName":"电影"}',
    '9. jumpTo: 跳转到时间点 — {"action":"jumpTo","time":30}',
    '10. selectClip: 选中片段 — {"action":"selectClip","clipId":"clip的id"}',
    '11. query: 信息查询（不执行操作，直接回答） — {"action":"query","answer":"当前有5个clip，总时长60秒"}',
    '',
    '重要规则：',
    '- 只返回上述定义的 action 类型，不要返回任何其他 action',
    '- 如果用户的问题只需要信息回答，使用 query action',
    '- 如果用户的指令模糊或信息不足，使用 query action 请求澄清',
    '- clipId 必须使用上下文中提供的真实ID，不要编造',
    '- 返回纯JSON，不要包含markdown代码块标记或其他说明文字',
  ].join('\n');
}

// ─── 响应解析 ─────────────────────────────────────────────────────

export interface ParseResult {
  commands: ChatCommand[];
  rejected: string[];
}

/**
 * 解析 AI 响应，过滤不在白名单中的 action。
 */
export function parseChatAIResponse(json: unknown): ParseResult {
  const rejected: string[] = [];
  const commands: ChatCommand[] = [];

  const items = Array.isArray(json) ? json : [json];
  for (const item of items) {
    const result = validateChatAction(item);
    if (result.valid) {
      commands.push(item as ChatCommand);
    } else {
      rejected.push(result.reason ?? '未知错误');
    }
  }
  return { commands, rejected };
}

/**
 * 安全解析 JSON 字符串，返回解析结果。
 */
export function safeParseChatResponse(raw: string): ParseResult {
  try {
    const parsed: unknown = JSON.parse(raw);
    return parseChatAIResponse(parsed);
  } catch {
    return { commands: [], rejected: ['AI 返回内容不是有效的 JSON'] };
  }
}

// ─── 对话历史（LRU 20 条） ───────────────────────────────────────

export const CHAT_HISTORY_MAX = 20;

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export class ChatHistory {
  private messages: ChatMessage[] = [];

  get length(): number {
    return this.messages.length;
  }

  get all(): readonly ChatMessage[] {
    return this.messages;
  }

  add(message: ChatMessage): void {
    this.messages.push(message);
    if (this.messages.length > CHAT_HISTORY_MAX) {
      this.messages = this.messages.slice(-CHAT_HISTORY_MAX);
    }
  }

  clear(): void {
    this.messages = [];
  }

  /**
   * 导出为 AI API messages 格式（不含 timestamp）
   */
  toApiMessages(): Array<{ role: 'user' | 'assistant'; content: string }> {
    return this.messages.map((m) => ({ role: m.role, content: m.content }));
  }
}

// ─── 命令描述生成 ─────────────────────────────────────────────────

/**
 * 为执行反馈生成人类可读的命令描述（中文）。
 */
export function describeChatCommand(command: ChatCommand): string {
  switch (command.action) {
    case 'setSpeed':
      return `设置片段 ${command.clipId} 速度为 ${command.value}x`;
    case 'setVolume':
      return `设置片段 ${command.clipId} 音量为 ${command.value}`;
    case 'delete':
      return `删除片段 ${command.clipId}`;
    case 'split':
      return `在 ${command.atTime}s 处拆分片段 ${command.clipId}`;
    case 'trim':
      return `裁剪片段 ${command.clipId}（起始 ${command.trimStart}s，末尾 ${command.trimEnd}s）`;
    case 'deleteAllSilence':
      return '删除所有静音片段';
    case 'setAllClipsSpeed':
      return `批量设置所有片段速度为 ${command.value}x`;
    case 'applyColorPreset':
      return `应用调色预设"${command.presetName}"`;
    case 'jumpTo':
      return `跳转到 ${command.time}s`;
    case 'selectClip':
      return `选中片段 ${command.clipId}`;
    case 'query':
      return command.answer;
  }
}

// ─── 其他工具函数 ─────────────────────────────────────────────────

/**
 * 查找 timeline 中的 clip，找不到时抛错。
 */
export function findClipInTimeline(timeline: Timeline, clipId: string): Clip {
  for (const track of timeline.tracks) {
    const clip = track.clips.find((c) => c.id === clipId);
    if (clip) return clip;
  }
  throw new Error(`片段 ${clipId} 不存在`);
}

/**
 * 收集 timeline 中所有 clip 的 ID 列表。
 */
export function getAllClipIds(timeline: Timeline): string[] {
  const ids: string[] = [];
  for (const track of timeline.tracks) {
    for (const clip of track.clips) {
      ids.push(clip.id);
    }
  }
  return ids;
}
