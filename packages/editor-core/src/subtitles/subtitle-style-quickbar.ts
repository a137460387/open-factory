import type { SubtitleClip, SubtitleStyle } from '../model-types';
import {
  BUILTIN_SUBTITLE_STYLE_TEMPLATES,
  type SubtitleStyleTemplate,
  type BuiltinSubtitleStyleTemplateId
} from './style-templates';

export const QUICKBAR_MAX_VISIBLE = 8;

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
export function shouldShowQuickbar(
  selectedClips: Array<{ type: string }>,
  userPrefEnabled: boolean
): boolean {
  if (!userPrefEnabled) return false;
  return selectedClips.some((clip) => clip.type === 'subtitle');
}

/**
 * 获取当前快速样式条可用的内置模板列表（最多 QUICKBAR_MAX_VISIBLE 个）。
 */
export function getQuickbarTemplates(): SubtitleStyleTemplate[] {
  return BUILTIN_SUBTITLE_STYLE_TEMPLATES.slice(0, QUICKBAR_MAX_VISIBLE);
}

/**
 * 判断当前选中 clip 的样式是否匹配指定模板。
 * 通过比较关键字段来判断，不依赖引用相等。
 */
export function isStyleMatchingTemplate(
  clipStyle: SubtitleStyle,
  templateStyle: SubtitleStyle
): boolean {
  return (
    clipStyle.fontSize === templateStyle.fontSize &&
    clipStyle.color === templateStyle.color &&
    clipStyle.backgroundColor === templateStyle.backgroundColor &&
    clipStyle.fontFamily === templateStyle.fontFamily &&
    clipStyle.bold === templateStyle.bold &&
    clipStyle.italic === templateStyle.italic
  );
}

/**
 * 在已选字幕 clips 中，确定当前高亮的模板 id。
 * 如果所有选中 clip 样式一致且匹配某个模板，返回该模板 id；否则返回 null。
 */
export function resolveActiveTemplateId(clips: SubtitleClip[]): string | null {
  if (clips.length === 0) return null;
  const templates = getQuickbarTemplates();
  const firstStyle = clips[0].style;
  const allSame = clips.every((c) => isStyleMatchingTemplate(c.style, firstStyle));
  if (!allSame) return null;
  const match = templates.find((t) => isStyleMatchingTemplate(firstStyle, t.style));
  return match?.id ?? null;
}

/**
 * 批量应用样式模板到多个字幕 clips。
 * 返回更新后的 clips 数组（只修改 style 字段）。
 */
export function applyStyleTemplateBatch(
  clips: SubtitleClip[],
  template: SubtitleStyleTemplate,
  targetClipIds: Set<string>
): SubtitleClip[] {
  return clips.map((clip) => {
    if (!targetClipIds.has(clip.id)) return clip;
    return { ...clip, style: { ...template.style } };
  });
}
