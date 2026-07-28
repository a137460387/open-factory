/**
 * 自动剪辑生成器
 * 接收场景分析结果，根据模板规则筛选素材并计算剪辑点
 * 通过命令对象自动在时间线上生成片段序列
 * 支持与音频节奏（BPM）匹配的卡点剪辑
 * 本地优先：所有处理在本地完成
 */
import type { Clip, Transition, TransitionType } from '../model-types';
import type { SceneAnalysis, AnalysisReport } from './scene-analyzer';
import type { EditTemplate, RhythmParams, ClipFilterRule } from './template-manager';
import type { PreferenceWeights } from './style-memory';
/** 自动编辑配置 */
export interface AutoEditorConfig {
    /** 目标视频轨道 ID（如不指定则创建新轨道） */
    targetTrackId?: string;
    /** 起始时间偏移（秒） */
    startOffset: number;
    /** 片段间间隔（秒） */
    clipGap: number;
    /** 是否自动添加转场 */
    autoTransitions: boolean;
    /** 是否启用 BPM 卡点 */
    enableBeatSync: boolean;
    /** 自定义 BPM（覆盖模板中的设置） */
    customBpm?: number;
    /** 最大总时长（秒），0 = 不限制 */
    maxTotalDuration: number;
    /** 是否随机选取素材 */
    shuffleMedia: boolean;
    /** 随机种子（用于可复现的随机） */
    randomSeed?: number;
}
/** 候选片段 */
export interface ClipCandidate {
    /** 场景分析 ID */
    sceneAnalysisId: string;
    /** 媒体路径 */
    mediaPath: string;
    /** 媒体资产 ID */
    mediaId: string;
    /** 场景开始时间（秒） */
    sourceStart: number;
    /** 场景结束时间（秒） */
    sourceEnd: number;
    /** 场景时长（秒） */
    duration: number;
    /** 场景类型 */
    sceneType: string;
    /** 综合评分 0-100 */
    score: number;
    /** 质量分 0-100 */
    quality: number;
    /** 关键帧时间点 */
    keyframes: number[];
    /** 是否被选中 */
    selected: boolean;
}
/** 生成的剪辑计划 */
export interface EditPlan {
    id: string;
    /** 使用的模板 ID */
    templateId: string;
    /** 候选片段列表 */
    candidates: ClipCandidate[];
    /** 选中的片段（按播放顺序） */
    selectedClips: ClipCandidate[];
    /** 计划的总时长（秒） */
    totalDuration: number;
    /** 计划的转场列表 */
    transitions: PlannedTransition[];
    /** 生成时间 */
    generatedAt: number;
    /** BPM 节拍点（如启用） */
    beatPoints?: number[];
}
/** 计划的转场 */
export interface PlannedTransition {
    /** 转场类型 */
    type: TransitionType;
    /** 转场时长（秒） */
    duration: number;
    /** 前一个片段 ID */
    fromClipIndex: number;
    /** 后一个片段 ID */
    toClipIndex: number;
}
/** 自动编辑进度回调 */
export type AutoEditProgressCallback = (progress: AutoEditProgress) => void;
/** 自动编辑进度 */
export interface AutoEditProgress {
    /** 当前阶段 */
    phase: 'filtering' | 'scoring' | 'arranging' | 'generating' | 'complete';
    /** 进度 0-1 */
    progress: number;
    /** 描述信息 */
    message: string;
}
/** 自动编辑结果 */
export interface AutoEditResult {
    /** 编辑计划 */
    plan: EditPlan;
    /** 生成的片段列表（可用于命令对象） */
    generatedClips: Clip[];
    /** 生成的转场列表 */
    generatedTransitions: Transition[];
    /** 目标轨道 ID */
    trackId: string;
    /** 总时长（秒） */
    totalDuration: number;
}
/** 创建默认自动编辑配置 */
export declare function createDefaultAutoEditorConfig(): AutoEditorConfig;
/**
 * 根据模板筛选规则过滤场景
 */
export declare function filterScenes(scenes: SceneAnalysis[], filter: ClipFilterRule): SceneAnalysis[];
/**
 * 对候选片段评分
 * 综合考虑质量、场景类型偏好、关键帧等因素
 */
export declare function scoreCandidate(scene: SceneAnalysis, rhythm: RhythmParams, preferSceneTypes: string[], weights?: PreferenceWeights): number;
/**
 * 计算目标片段时长
 * 考虑模板偏好和风格记忆
 */
export declare function calculateTargetDuration(scene: SceneAnalysis, rhythm: RhythmParams, weights?: PreferenceWeights): number;
/**
 * 根据 BPM 计算节拍时间点
 * @param bpm 每分钟节拍数
 * @param duration 总时长（秒）
 * @param offset 起始偏移（秒）
 */
export declare function calculateBeatPoints(bpm: number, duration: number, offset?: number): number[];
/**
 * 将片段对齐到最近的节拍点
 * 返回调整后的开始时间和时长
 */
export declare function alignClipToBeat(clipStart: number, clipDuration: number, beatPoints: number[]): {
    start: number;
    duration: number;
};
/**
 * 从场景分析和模板生成编辑计划
 */
export declare function generateEditPlan(scenes: SceneAnalysis[], template: EditTemplate, config: AutoEditorConfig, weights?: PreferenceWeights, bpm?: number): EditPlan;
/**
 * 从编辑计划生成可用于时间线的片段和转场
 * 返回值可直接用于 AddClipCommand 等命令对象
 */
export declare function generateTimelineElements(plan: EditPlan, trackId: string, config: AutoEditorConfig): AutoEditResult;
/**
 * 完整的自动编辑流程
 * 从场景分析结果直接生成时间线元素
 */
export declare function autoEdit(report: AnalysisReport, template: EditTemplate, config?: Partial<AutoEditorConfig>, weights?: PreferenceWeights, trackId?: string): AutoEditResult;
//# sourceMappingURL=auto-editor.d.ts.map