import type { SubtitleClip, SubtitleStyle } from '../model-types';
import { type SubtitleStyleTemplate } from './style-templates';
export declare const QUICKBAR_MAX_VISIBLE = 8;
export interface QuickbarState {
    visible: boolean;
    templates: SubtitleStyleTemplate[];
    activeTemplateId: string | null;
    selectedClipIds: string[];
}
/**
 * 判断快速样式条是否应当显示。
 * 条件：有选中的字幕 clip 且用户偏好未关闭浮层。
 */
export declare function shouldShowQuickbar(selectedClips: Array<{
    type: string;
}>, userPrefEnabled: boolean): boolean;
/**
 * 获取当前快速样式条可用的内置模板列表（最多 QUICKBAR_MAX_VISIBLE 个）。
 */
export declare function getQuickbarTemplates(): SubtitleStyleTemplate[];
/**
 * 判断当前选中 clip 的样式是否匹配指定模板。
 * 通过比较关键字段来判断，不依赖引用相等。
 */
export declare function isStyleMatchingTemplate(clipStyle: SubtitleStyle, templateStyle: SubtitleStyle): boolean;
/**
 * 在已选字幕 clips 中，确定当前高亮的模板 id。
 * 如果所有选中 clip 样式一致且匹配某个模板，返回该模板 id；否则返回 null。
 */
export declare function resolveActiveTemplateId(clips: SubtitleClip[]): string | null;
/**
 * 批量应用样式模板到多个字幕 clips。
 * 返回更新后的 clips 数组（只修改 style 字段）。
 */
export declare function applyStyleTemplateBatch(clips: SubtitleClip[], template: SubtitleStyleTemplate, targetClipIds: Set<string>): SubtitleClip[];
//# sourceMappingURL=subtitle-style-quickbar.d.ts.map