/**
 * 智能粗剪编排器
 *
 * 整合场景检测、静音检测、Whisper 字幕、对话检测、节拍检测等 AI 分析结果，
 * 生成统一的、按优先级排序的剪辑建议列表，供 SmartRoughCutPanel 消费。
 *
 * 设计原则：
 * - 纯函数，无副作用，方便测试
 * - 接受预分析数据（Tauri bridge 调用在 app 层完成）
 * - 输出标准化的建议与报告
 */
import type { SilentRange } from './audio/silence-detection';
import type { DialogueInterval } from './audio/dialogue-detection';
import type { SceneDetectionResult } from './ai-scene-detector';
import type { EmotionAnalysisResult } from './ai-emotion-analyzer';
import type { SpeechUnderstandingResult } from './ai-speech-understanding';
import type { NarrativeAnalysisResult } from './ai-narrative-analyzer';
export type SmartRoughCutSuggestionType = 'scene_split' | 'silence_remove' | 'subtitle_add' | 'dialogue_extract' | 'broll_insert' | 'rhythm_cut' | 'emotion_highlight' | 'narrative_structure';
export type SmartRoughCutActionType = 'split' | 'remove' | 'add_track' | 'extract' | 'insert' | 'reorder';
export interface SmartRoughCutSuggestion {
    id: string;
    type: SmartRoughCutSuggestionType;
    action: SmartRoughCutActionType;
    priority: number;
    confidence: number;
    timeStart: number;
    timeEnd: number;
    reason: string;
    metadata: Record<string, unknown>;
    selected: boolean;
}
export interface SmartRoughCutSceneInput {
    mediaId: string;
    result: SceneDetectionResult;
}
export interface SmartRoughCutSilenceInput {
    mediaId: string;
    clipId: string;
    ranges: SilentRange[];
}
export interface SmartRoughCutSubtitleInput {
    mediaId: string;
    clipId: string;
    cueCount: number;
    totalDuration: number;
}
export interface SmartRoughCutDialogueInput {
    mediaId: string;
    clipId: string;
    intervals: DialogueInterval[];
}
export interface SmartRoughCutBeatInput {
    beatTimes: number[];
    bpm?: number;
}
export interface SmartRoughCutEmotionInput {
    result: EmotionAnalysisResult;
}
export interface SmartRoughCutSpeechInput {
    result: SpeechUnderstandingResult;
}
export interface SmartRoughCutNarrativeInput {
    result: NarrativeAnalysisResult;
}
export interface SmartRoughCutAnalysisData {
    scenes?: SmartRoughCutSceneInput[];
    silences?: SmartRoughCutSilenceInput[];
    subtitles?: SmartRoughCutSubtitleInput[];
    dialogues?: SmartRoughCutDialogueInput[];
    beats?: SmartRoughCutBeatInput;
    emotions?: SmartRoughCutEmotionInput;
    speech?: SmartRoughCutSpeechInput;
    narrative?: SmartRoughCutNarrativeInput;
}
export interface SmartRoughCutOrchestratorOptions {
    enableSceneSplit?: boolean;
    enableSilenceRemoval?: boolean;
    enableSubtitleGeneration?: boolean;
    enableDialogueExtraction?: boolean;
    enableRhythmCut?: boolean;
    enableEmotionHighlight?: boolean;
    enableNarrativeStructure?: boolean;
    minConfidence?: number;
    silenceThresholdDb?: number;
    minSilenceDuration?: number;
    maxSuggestions?: number;
}
export interface SmartRoughCutReport {
    totalMediaAnalyzed: number;
    sceneBoundaries: number;
    silenceRangesFound: number;
    silenceDurationRemoved: number;
    subtitleCuesGenerated: number;
    dialogueIntervalsFound: number;
    dialogueDurationTotal: number;
    beatCount: number;
    estimatedBpm: number;
    suggestionsByType: Record<SmartRoughCutSuggestionType, number>;
    totalSuggestions: number;
    selectedSuggestions: number;
    estimatedOutputDuration: number;
    emotionPeaks: number;
    narrativeActs: number;
    generatedAt: string;
}
export interface SmartRoughCutOrchestrationResult {
    suggestions: SmartRoughCutSuggestion[];
    report: SmartRoughCutReport;
}
export declare function orchestrateSmartRoughCut(data: SmartRoughCutAnalysisData, options?: SmartRoughCutOrchestratorOptions): SmartRoughCutOrchestrationResult;
export declare function toggleSuggestionSelection(suggestions: SmartRoughCutSuggestion[], id: string): SmartRoughCutSuggestion[];
export declare function setAllSuggestionSelection(suggestions: SmartRoughCutSuggestion[], selected: boolean): SmartRoughCutSuggestion[];
export declare function selectSuggestionsByType(suggestions: SmartRoughCutSuggestion[], type: SmartRoughCutSuggestionType, selected: boolean): SmartRoughCutSuggestion[];
export declare function getSelectedSuggestions(suggestions: SmartRoughCutSuggestion[]): SmartRoughCutSuggestion[];
export declare function reorderSuggestions(suggestions: SmartRoughCutSuggestion[], fromIndex: number, toIndex: number): SmartRoughCutSuggestion[];
export declare function buildSmartRoughCutReport(data: SmartRoughCutAnalysisData, suggestions: SmartRoughCutSuggestion[]): SmartRoughCutReport;
/**
 * 从原始的 Tauri bridge 分析结果构建编排输入。
 * 适用于 app 层直接调用 bridge 后传入结果。
 */
export declare function buildOrchestrationInput(mediaId: string, sceneResult?: SceneDetectionResult, silenceRanges?: SilentRange[], clipId?: string, dialogueIntervals?: DialogueInterval[], beatTimes?: number[], bpm?: number): SmartRoughCutAnalysisData;
//# sourceMappingURL=smart-rough-cut-orchestrator.d.ts.map