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
export type ChatActionType = 'setSpeed' | 'setVolume' | 'delete' | 'split' | 'trim' | 'deleteAllSilence' | 'setAllClipsSpeed' | 'applyColorPreset' | 'jumpTo' | 'selectClip' | 'query';
export declare const CHAT_ACTION_WHITELIST: ReadonlySet<ChatActionType>;
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
export type ChatCommand = SetSpeedCommand | SetVolumeCommand | DeleteCommand | SplitCommand | TrimCommand | DeleteAllSilenceCommand | SetAllClipsSpeedCommand | ApplyColorPresetCommand | JumpToCommand | SelectClipCommand | QueryCommand;
export interface ChatActionValidationResult {
    valid: boolean;
    reason?: string;
}
/**
 * 验证单个 chat action 是否在白名单内且字段合法。
 * 非白名单 action 被视为 prompt injection，直接拒绝。
 */
export declare function validateChatAction(action: unknown): ChatActionValidationResult;
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
    markers?: Array<{
        time: number;
        label: string;
    }>;
}
/**
 * 将当前项目状态打包为 AI 可理解的简要上下文。
 */
export declare function buildTimelineContext(project: Project, selectedClipId?: string): TimelineContext;
export declare function buildChatSystemPrompt(): string;
export interface ParseResult {
    commands: ChatCommand[];
    rejected: string[];
}
/**
 * 解析 AI 响应，过滤不在白名单中的 action。
 */
export declare function parseChatAIResponse(json: unknown): ParseResult;
/**
 * 安全解析 JSON 字符串，返回解析结果。
 */
export declare function safeParseChatResponse(raw: string): ParseResult;
export declare const CHAT_HISTORY_MAX = 20;
export interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
    timestamp: number;
}
export declare class ChatHistory {
    private messages;
    get length(): number;
    get all(): readonly ChatMessage[];
    add(message: ChatMessage): void;
    clear(): void;
    /**
     * 导出为 AI API messages 格式（不含 timestamp）
     */
    toApiMessages(): Array<{
        role: 'user' | 'assistant';
        content: string;
    }>;
}
/**
 * 为执行反馈生成人类可读的命令描述（中文）。
 */
export declare function describeChatCommand(command: ChatCommand): string;
/**
 * 查找 timeline 中的 clip，找不到时抛错。
 */
export declare function findClipInTimeline(timeline: Timeline, clipId: string): Clip;
/**
 * 收集 timeline 中所有 clip 的 ID 列表。
 */
export declare function getAllClipIds(timeline: Timeline): string[];
//# sourceMappingURL=ai-chat-editor.d.ts.map