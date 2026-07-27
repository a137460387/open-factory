/**
 * 模板化创作系统
 * 内置基础模板（Vlog、短视频、宣传片），支持节奏参数、转场偏好、字幕样式
 * 支持模板 CRUD 及导入导出
 * 本地优先：所有数据存储在本地
 */
import type { TransitionType } from '../model-types';
/** 模板类别 */
export type EditTemplateCategory = 'vlog' | 'short-video' | 'promo' | 'documentary' | 'music-video' | 'custom';
/** 节奏风格 */
export type RhythmStyle = 'fast' | 'medium' | 'slow' | 'dynamic' | 'calm';
/** 字幕位置 */
export type AutoEditSubtitlePosition = 'bottom' | 'top' | 'center' | 'lower-third';
/** 节奏参数 */
export interface RhythmParams {
    /** 节奏风格 */
    style: RhythmStyle;
    /** 目标片段时长范围（秒） */
    clipDurationRange: {
        min: number;
        max: number;
        preferred: number;
    };
    /** 是否匹配 BPM 卡点 */
    beatSync: boolean;
    /** 目标 BPM（如不指定则自动检测） */
    targetBpm?: number;
    /** 片段间静默容忍时长（秒），超过则剪掉 */
    silenceTolerance: number;
    /** 场景切换权重：优先在场景切换点剪辑 */
    sceneChangeWeight: number;
    /** 关键帧权重：优先在关键帧处剪辑 */
    keyframeWeight: number;
    /** 质量权重：优先选择高质量片段 */
    qualityWeight: number;
}
/** 转场偏好 */
export interface TransitionPreference {
    /** 默认转场类型 */
    defaultType: TransitionType;
    /** 默认转场时长（秒） */
    defaultDuration: number;
    /** 特定场景类型的转场映射 */
    sceneTypeOverrides: Partial<Record<string, TransitionType>>;
    /** 是否自动添加转场 */
    autoAddTransitions: boolean;
}
/** 字幕样式配置 */
export interface AutoEditSubtitleStyleConfig {
    /** 是否自动生成字幕 */
    autoGenerate: boolean;
    /** 字幕位置 */
    position: AutoEditSubtitlePosition;
    /** 字体大小（相对值 0-1） */
    fontSize: number;
    /** 字体系列 */
    fontFamily: string;
    /** 字体颜色（十六进制） */
    fontColor: string;
    /** 背景颜色（十六进制，含透明度） */
    backgroundColor: string;
    /** 是否加粗 */
    bold: boolean;
    /** 描边宽度（像素） */
    outlineWidth: number;
    /** 描边颜色 */
    outlineColor: string;
}
/** 片段筛选规则 */
export interface ClipFilterRule {
    /** 最低质量分 */
    minQuality: number;
    /** 排除的场景类型 */
    excludeSceneTypes: string[];
    /** 优先的场景类型 */
    preferSceneTypes: string[];
    /** 最短片段时长（秒） */
    minClipDuration: number;
    /** 最长片段时长（秒） */
    maxClipDuration: number;
}
/** 编辑模板 */
export interface EditTemplate {
    id: string;
    /** 模板名称 */
    name: string;
    /** 模板描述 */
    description: string;
    /** 模板类别 */
    category: EditTemplateCategory;
    /** 模板版本 */
    version: number;
    /** 节奏参数 */
    rhythm: RhythmParams;
    /** 转场偏好 */
    transition: TransitionPreference;
    /** 字幕样式 */
    subtitle: AutoEditSubtitleStyleConfig;
    /** 片段筛选规则 */
    filter: ClipFilterRule;
    /** 目标总时长范围（秒），不指定则不限制 */
    targetDurationRange?: {
        min: number;
        max: number;
    };
    /** 每个素材最多使用的片段数 */
    maxClipsPerMedia: number;
    /** 是否随机排列素材顺序 */
    shuffleOrder: boolean;
    /** 创建时间 */
    createdAt: number;
    /** 更新时间 */
    updatedAt: number;
    /** 是否为内置模板 */
    builtin: boolean;
    /** 自定义标签 */
    tags: string[];
}
/** 模板导出格式 */
export interface TemplateExportData {
    formatVersion: 1;
    template: Omit<EditTemplate, 'id' | 'createdAt' | 'updatedAt' | 'builtin'>;
    exportedAt: number;
}
/** 模板管理器配置 */
export interface TemplateManagerConfig {
    /** 最大自定义模板数 */
    maxCustomTemplates: number;
    /** 存储键名（用于 localStorage） */
    storageKey: string;
}
/** 模板变更事件 */
export type TemplateManagerEvent = 'created' | 'updated' | 'deleted' | 'imported';
/** 模板变更监听器 */
export type TemplateManagerEventListener = (event: TemplateManagerEvent, template: EditTemplate) => void;
/** 创建默认节奏参数 */
export declare function createDefaultRhythmParams(): RhythmParams;
/** 创建默认转场偏好 */
export declare function createDefaultTransitionPreference(): TransitionPreference;
/** 创建默认字幕样式 */
export declare function createDefaultSubtitleStyleConfig(): AutoEditSubtitleStyleConfig;
/** 创建默认片段筛选规则 */
export declare function createDefaultClipFilterRule(): ClipFilterRule;
/** 创建空模板 */
export declare function createEmptyTemplate(name: string, category: EditTemplateCategory): EditTemplate;
/** 内置 Vlog 模板 */
export declare const BUILTIN_vlog_TEMPLATE: EditTemplate;
/** 内置短视频模板 */
export declare const BUILTIN_SHORT_VIDEO_TEMPLATE: EditTemplate;
/** 内置宣传片模板 */
export declare const BUILTIN_PROMO_TEMPLATE: EditTemplate;
/** 所有内置编辑模板 */
export declare const BUILTIN_EDIT_TEMPLATES: EditTemplate[];
/** 规范化节奏参数 */
export declare function normalizeRhythmParams(data: Partial<RhythmParams>): RhythmParams;
/** 规范化模板 */
export declare function normalizeTemplate(data: Partial<EditTemplate>): EditTemplate;
/** 创建默认模板管理器配置 */
export declare function createDefaultTemplateManagerConfig(): TemplateManagerConfig;
/**
 * 模板管理器
 * 管理编辑模板的增删改查及导入导出
 */
export declare class TemplateManager {
    private templates;
    private listeners;
    private config;
    constructor(config?: Partial<TemplateManagerConfig>);
    /** 获取所有模板 */
    getAllTemplates(): EditTemplate[];
    /** 获取指定模板 */
    getTemplate(id: string): EditTemplate | undefined;
    /** 按类别获取模板 */
    getTemplatesByCategory(category: EditTemplateCategory): EditTemplate[];
    /** 获取自定义模板 */
    getCustomTemplates(): EditTemplate[];
    /** 创建模板 */
    createTemplate(data: Partial<EditTemplate>): EditTemplate;
    /** 更新模板 */
    updateTemplate(id: string, updates: Partial<EditTemplate>): EditTemplate;
    /** 删除模板 */
    deleteTemplate(id: string): boolean;
    /** 导出模板 */
    exportTemplate(id: string): TemplateExportData;
    /** 导入模板 */
    importTemplate(data: TemplateExportData): EditTemplate;
    /** 导出所有自定义模板 */
    exportAllCustom(): TemplateExportData[];
    /** 批量导入模板 */
    importBatch(dataList: TemplateExportData[]): EditTemplate[];
    /** 注册事件监听器 */
    on(event: TemplateManagerEvent, listener: TemplateManagerEventListener): void;
    /** 移除事件监听器 */
    off(event: TemplateManagerEvent, listener: TemplateManagerEventListener): void;
    /** 触发事件 */
    private emit;
    /** 搜索模板 */
    searchTemplates(query: string): EditTemplate[];
    /** 获取模板统计 */
    getStats(): {
        total: number;
        builtin: number;
        custom: number;
        byCategory: Record<string, number>;
    };
}
//# sourceMappingURL=template-manager.d.ts.map