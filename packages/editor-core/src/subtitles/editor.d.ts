import type { SubtitleClip, SubtitleStyle, Timeline } from '../model';
import { type SubtitleStyleTemplate } from './style-templates';
/** 字幕查找替换选项 */
export interface SubtitleSearchOptions {
    /** 搜索文本 */
    searchText: string;
    /** 是否区分大小写 */
    caseSensitive?: boolean;
    /** 是否全词匹配 */
    wholeWord?: boolean;
    /** 是否使用正则表达式 */
    useRegex?: boolean;
    /** 搜索范围：指定轨道ID或全部 */
    trackId?: string;
}
/** 字幕替换选项 */
export interface SubtitleReplaceOptions extends SubtitleSearchOptions {
    /** 替换文本 */
    replaceText: string;
}
/** 查找结果 */
export interface SubtitleSearchResult {
    /** 字幕片段ID */
    clipId: string;
    /** 轨道索引 */
    trackIndex: number;
    /** 匹配的文本 */
    matchedText: string;
    /** 匹配在文本中的起始位置 */
    matchStart: number;
    /** 匹配在文本中的结束位置 */
    matchEnd: number;
    /** 完整的字幕文本 */
    fullText: string;
}
/** 批量样式更新选项 */
export interface SubtitleBatchStyleUpdate {
    /** 要更新的字幕片段ID列表 */
    clipIds: string[];
    /** 要更新的样式属性（部分） */
    style: Partial<SubtitleStyle>;
}
/** 多选操作结果 */
export interface SubtitleSelectionResult {
    /** 选中的字幕片段ID列表 */
    selectedIds: string[];
    /** 选中的字幕片段 */
    selectedClips: SubtitleClip[];
    /** 选中数量 */
    count: number;
}
/** 字幕编辑操作类型 */
export type SubtitleEditOperation = 'delete' | 'duplicate' | 'split' | 'merge' | 'style-update' | 'time-shift' | 'time-scale';
/** 字幕编辑操作结果 */
export interface SubtitleEditResult {
    /** 操作类型 */
    operation: SubtitleEditOperation;
    /** 影响的字幕片段数量 */
    affectedCount: number;
    /** 操作后的Timeline */
    timeline: Timeline;
}
/**
 * 在Timeline中搜索字幕文本
 */
export declare function searchSubtitles(timeline: Timeline, options: SubtitleSearchOptions): SubtitleSearchResult[];
/**
 * 批量替换字幕文本
 */
export declare function replaceSubtitles(timeline: Timeline, options: SubtitleReplaceOptions, clipIds?: string[]): {
    timeline: Timeline;
    replacedCount: number;
};
/**
 * 替换单个搜索结果
 */
export declare function replaceSingleResult(timeline: Timeline, result: SubtitleSearchResult, replaceText: string): Timeline;
/**
 * 获取选中的字幕片段
 */
export declare function getSelectedSubtitleClips(timeline: Timeline, selectedIds: string[]): SubtitleSelectionResult;
/**
 * 全选指定轨道的字幕片段
 */
export declare function selectAllSubtitlesInTrack(timeline: Timeline, trackId: string): string[];
/**
 * 反选字幕片段
 */
export declare function invertSubtitleSelection(timeline: Timeline, selectedIds: string[], trackId?: string): string[];
/**
 * 批量更新字幕样式
 */
export declare function batchUpdateSubtitleStyle(timeline: Timeline, update: SubtitleBatchStyleUpdate): Timeline;
/**
 * 批量应用样式模板到选中的字幕
 */
export declare function batchApplyStyleTemplate(timeline: Timeline, clipIds: string[], template: SubtitleStyleTemplate): Timeline;
/**
 * 从选中的字幕中提取共同样式
 */
export declare function extractCommonStyle(clips: SubtitleClip[]): Partial<SubtitleStyle> | null;
/**
 * 删除选中的字幕片段
 */
export declare function deleteSelectedSubtitles(timeline: Timeline, selectedIds: string[]): SubtitleEditResult;
/**
 * 复制选中的字幕片段
 */
export declare function duplicateSelectedSubtitles(timeline: Timeline, selectedIds: string[], timeOffset?: number): SubtitleEditResult;
/**
 * 合并选中的字幕片段
 */
export declare function mergeSelectedSubtitles(timeline: Timeline, selectedIds: string[], separator?: string): SubtitleEditResult;
/**
 * 批量调整字幕时间
 */
export declare function batchShiftSubtitleTime(timeline: Timeline, selectedIds: string[], timeShift: number): SubtitleEditResult;
/**
 * 批量缩放字幕时间
 */
export declare function batchScaleSubtitleTime(timeline: Timeline, selectedIds: string[], scaleFactor: number, pivotTime?: number): SubtitleEditResult;
//# sourceMappingURL=editor.d.ts.map