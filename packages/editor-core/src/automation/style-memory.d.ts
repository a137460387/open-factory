/**
 * 个人风格记忆库
 * 监听用户对自动生成序列的修改操作，将偏好转化为可复用的权重参数
 * 本地优先：所有数据存储在本地
 */
import type { TransitionType } from '../model-types';
/** 修改操作类型 */
export type ModificationType = 'clip-duration-adjust' | 'clip-reorder' | 'clip-remove' | 'transition-change' | 'transition-duration' | 'volume-adjust' | 'trim-adjust' | 'speed-change' | 'color-adjust';
/** 修改记录 */
export interface ModificationRecord {
    id: string;
    /** 修改类型 */
    type: ModificationType;
    /** 修改时间戳 */
    timestamp: number;
    /** 模板 ID（关联的模板） */
    templateId: string;
    /** 原始值 */
    before: Record<string, unknown>;
    /** 修改后的值 */
    after: Record<string, unknown>;
    /** 关联的场景类型 */
    sceneType?: string;
    /** 关联的媒体路径 */
    mediaPath?: string;
}
/** 偏好权重 */
export interface PreferenceWeights {
    /** 片段时长偏好：负值偏好更短，正值偏好更长 */
    clipDurationBias: number;
    /** 转场类型偏好 */
    transitionPreference: Partial<Record<TransitionType, number>>;
    /** 转场时长偏好（秒） */
    preferredTransitionDuration: number;
    /** 节奏偏好：-1 慢节奏，0 中等，1 快节奏 */
    pacePreference: number;
    /** 场景类型权重调整 */
    sceneTypeWeights: Record<string, number>;
    /** 质量阈值偏好 */
    qualityThresholdAdjust: number;
    /** 样本数量（用于置信度评估） */
    sampleCount: number;
}
/** 风格配置文件 */
export interface StyleProfile {
    id: string;
    /** 配置文件名称 */
    name: string;
    /** 创建时间 */
    createdAt: number;
    /** 更新时间 */
    updatedAt: number;
    /** 修改记录 */
    records: ModificationRecord[];
    /** 计算出的偏好权重 */
    weights: PreferenceWeights;
    /** 关联的模板 ID */
    templateId?: string;
}
/** 风格记忆配置 */
export interface StyleMemoryConfig {
    /** 最大记录数（每个配置文件） */
    maxRecordsPerProfile: number;
    /** 最大配置文件数 */
    maxProfiles: number;
    /** 存储键名 */
    storageKey: string;
    /** 最小样本数，低于此数时权重不生效 */
    minSampleCount: number;
}
/** 创建默认偏好权重 */
export declare function createDefaultPreferenceWeights(): PreferenceWeights;
/** 创建默认风格记忆配置 */
export declare function createDefaultStyleMemoryConfig(): StyleMemoryConfig;
/** 创建空的风格配置文件 */
export declare function createEmptyStyleProfile(name: string, templateId?: string): StyleProfile;
/**
 * 从修改记录计算偏好权重
 * 基于统计分析用户行为模式
 */
export declare function calculateWeights(records: ModificationRecord[]): PreferenceWeights;
/**
 * 将偏好权重应用到模板参数
 * 返回调整后的参数（不修改原模板）
 */
export declare function applyWeightsToTemplateParams(params: {
    clipDurationRange: {
        min: number;
        max: number;
        preferred: number;
    };
    qualityWeight: number;
    sceneChangeWeight: number;
    transitionDuration: number;
    transitionType?: TransitionType;
}, weights: PreferenceWeights, strength?: number): typeof params;
/**
 * 风格记忆管理器
 * 记录用户修改行为，计算偏好权重，应用于后续生成
 */
export declare class StyleMemory {
    private profiles;
    private config;
    constructor(config?: Partial<StyleMemoryConfig>);
    /** 获取所有配置文件 */
    getAllProfiles(): StyleProfile[];
    /** 获取指定配置文件 */
    getProfile(id: string): StyleProfile | undefined;
    /** 创建配置文件 */
    createProfile(name: string, templateId?: string): StyleProfile;
    /** 删除配置文件 */
    deleteProfile(id: string): boolean;
    /** 记录一次修改操作 */
    recordModification(profileId: string, type: ModificationType, before: Record<string, unknown>, after: Record<string, unknown>, context?: {
        sceneType?: string;
        mediaPath?: string;
        templateId?: string;
    }): ModificationRecord;
    /** 获取配置文件的偏好权重 */
    getWeights(profileId: string): PreferenceWeights;
    /** 检查权重是否已达到最小置信度 */
    hasEnoughSamples(profileId: string): boolean;
    /** 获取指定模板关联的配置文件 */
    getProfileForTemplate(templateId: string): StyleProfile | undefined;
    /** 重置配置文件的记录和权重 */
    resetProfile(id: string): void;
    /** 获取配置文件统计 */
    getProfileStats(profileId: string): {
        totalRecords: number;
        byType: Record<ModificationType, number>;
        hasEnoughSamples: boolean;
        topTransition: TransitionType | null;
    };
}
//# sourceMappingURL=style-memory.d.ts.map