import { DEFAULT_SUBTITLE_STYLE, type SubtitleStyle } from '../model';

export type BuiltinSubtitleStyleTemplateId =
  | 'news-lower-third'
  | 'cinema-white'
  | 'karaoke'
  | 'variety-bold'
  | 'documentary'
  | 'social-bold'
  | 'game-hud'
  | 'handwritten';

export type SubtitleStyleTemplateKind = 'builtin' | 'custom';

export interface SubtitleStyleTemplate {
  id: string;
  kind: SubtitleStyleTemplateKind;
  name: string;
  style: SubtitleStyle;
}

export const SUBTITLE_STYLE_TEMPLATE_PREVIEW_TEXT = '示例字幕';

export const BUILTIN_SUBTITLE_STYLE_TEMPLATES: SubtitleStyleTemplate[] = [
  {
    id: 'news-lower-third',
    kind: 'builtin',
    name: '新闻下三分之一',
    style: normalizeSubtitleStyleTemplateStyle({
      fontFamily: 'Inter, Arial, sans-serif',
      fontSize: 34,
      color: '#ffffff',
      backgroundColor: '#0f3a66',
      backgroundOpacity: 0.82,
      bold: true,
      italic: false,
      yOffset: 110,
      outlineColor: '#08233f',
      outlineWidth: 1,
      shadowColor: '#000000',
      shadowOffset: 1
    })
  },
  {
    id: 'cinema-white',
    kind: 'builtin',
    name: '电影白字',
    style: normalizeSubtitleStyleTemplateStyle({
      fontFamily: 'Georgia, Times New Roman, serif',
      fontSize: 44,
      color: '#ffffff',
      backgroundColor: '#000000',
      backgroundOpacity: 0,
      bold: false,
      italic: false,
      yOffset: 78,
      outlineColor: '#000000',
      outlineWidth: 2,
      shadowColor: '#000000',
      shadowOffset: 0
    })
  },
  {
    id: 'karaoke',
    kind: 'builtin',
    name: '卡拉OK',
    style: normalizeSubtitleStyleTemplateStyle({
      fontFamily: 'Arial Rounded MT Bold, Arial, sans-serif',
      fontSize: 46,
      color: '#fff45a',
      backgroundColor: '#5b21b6',
      backgroundOpacity: 0.34,
      bold: true,
      italic: false,
      yOffset: 64,
      outlineColor: '#7c2d12',
      outlineWidth: 2,
      shadowColor: '#000000',
      shadowOffset: 2
    })
  },
  {
    id: 'variety-bold',
    kind: 'builtin',
    name: '综艺综字',
    style: normalizeSubtitleStyleTemplateStyle({
      fontFamily: 'Microsoft YaHei, Arial, sans-serif',
      fontSize: 50,
      color: '#ffef5f',
      backgroundColor: '#ef4444',
      backgroundOpacity: 0.74,
      bold: true,
      italic: false,
      yOffset: 58,
      outlineColor: '#111827',
      outlineWidth: 3,
      shadowColor: '#2563eb',
      shadowOffset: 2
    })
  },
  {
    id: 'documentary',
    kind: 'builtin',
    name: '纪录片',
    style: normalizeSubtitleStyleTemplateStyle({
      fontFamily: 'Source Serif Pro, Georgia, serif',
      fontSize: 38,
      color: '#f8fafc',
      backgroundColor: '#111827',
      backgroundOpacity: 0.46,
      bold: false,
      italic: false,
      yOffset: 84,
      outlineColor: '#020617',
      outlineWidth: 1,
      shadowColor: '#000000',
      shadowOffset: 1
    })
  },
  {
    id: 'social-bold',
    kind: 'builtin',
    name: '社交媒体粗体',
    style: normalizeSubtitleStyleTemplateStyle({
      fontFamily: 'Inter, Arial Black, Arial, sans-serif',
      fontSize: 56,
      color: '#ffffff',
      backgroundColor: '#0f172a',
      backgroundOpacity: 0.68,
      bold: true,
      italic: false,
      yOffset: 92,
      outlineColor: '#f97316',
      outlineWidth: 2,
      shadowColor: '#000000',
      shadowOffset: 2
    })
  },
  {
    id: 'game-hud',
    kind: 'builtin',
    name: '游戏HUD',
    style: normalizeSubtitleStyleTemplateStyle({
      fontFamily: 'Consolas, Menlo, monospace',
      fontSize: 36,
      color: '#7dd3fc',
      backgroundColor: '#04111f',
      backgroundOpacity: 0.72,
      bold: true,
      italic: false,
      yOffset: 118,
      outlineColor: '#22d3ee',
      outlineWidth: 1,
      shadowColor: '#0f172a',
      shadowOffset: 2
    })
  },
  {
    id: 'handwritten',
    kind: 'builtin',
    name: '手写风',
    style: normalizeSubtitleStyleTemplateStyle({
      fontFamily: 'Comic Sans MS, Segoe Print, cursive',
      fontSize: 48,
      color: '#1f2937',
      backgroundColor: '#fff7ed',
      backgroundOpacity: 0.52,
      bold: false,
      italic: true,
      yOffset: 82,
      outlineColor: '#ffffff',
      outlineWidth: 1,
      shadowColor: '#f59e0b',
      shadowOffset: 1
    })
  }
];

export function normalizeSubtitleStyleTemplateStyle(style: Partial<SubtitleStyle>): SubtitleStyle {
  return {
    ...DEFAULT_SUBTITLE_STYLE,
    ...style,
    fontSize: clampNumber(style.fontSize, 8, 200, DEFAULT_SUBTITLE_STYLE.fontSize),
    backgroundOpacity: clampNumber(style.backgroundOpacity, 0, 1, DEFAULT_SUBTITLE_STYLE.backgroundOpacity),
    yOffset: clampNumber(style.yOffset, 0, 1000, DEFAULT_SUBTITLE_STYLE.yOffset),
    outlineWidth: clampNumber(style.outlineWidth, 0, 12, DEFAULT_SUBTITLE_STYLE.outlineWidth),
    shadowOffset: clampNumber(style.shadowOffset, 0, 24, DEFAULT_SUBTITLE_STYLE.shadowOffset),
    color: normalizeColor(style.color, DEFAULT_SUBTITLE_STYLE.color),
    backgroundColor: normalizeColor(style.backgroundColor, DEFAULT_SUBTITLE_STYLE.backgroundColor),
    outlineColor: normalizeColor(style.outlineColor, DEFAULT_SUBTITLE_STYLE.outlineColor),
    shadowColor: normalizeColor(style.shadowColor, DEFAULT_SUBTITLE_STYLE.shadowColor),
    fontFamily: normalizeFontFamily(style.fontFamily),
    bold: style.bold === true,
    italic: style.italic === true
  };
}

export function renderSubtitleStyleTemplatePreview(template: Pick<SubtitleStyleTemplate, 'style'>, text = SUBTITLE_STYLE_TEMPLATE_PREVIEW_TEXT): string {
  const style = normalizeSubtitleStyleTemplateStyle(template.style);
  const fontSize = Math.max(14, Math.min(24, Math.round(style.fontSize * 0.42)));
  const x = 96;
  const y = Math.max(34, Math.min(54, 60 - style.yOffset / 12));
  const boxOpacity = Number(style.backgroundOpacity.toFixed(2));
  const boxHeight = fontSize + 14;
  const escapedText = escapeXml(text);
  return [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 72" role="img" aria-label="subtitle style preview">',
    '<rect width="192" height="72" rx="6" fill="#111827"/>',
    `<rect x="18" y="${Math.round(y - fontSize)}" width="156" height="${boxHeight}" rx="4" fill="${style.backgroundColor}" opacity="${boxOpacity}"/>`,
    style.shadowOffset > 0
      ? `<text x="${x + style.shadowOffset}" y="${y + style.shadowOffset}" text-anchor="middle" font-family="${escapeXml(style.fontFamily)}" font-size="${fontSize}" font-weight="${style.bold ? 700 : 500}" font-style="${style.italic ? 'italic' : 'normal'}" fill="${style.shadowColor}" opacity="0.75">${escapedText}</text>`
      : '',
    `<text x="${x}" y="${y}" text-anchor="middle" font-family="${escapeXml(style.fontFamily)}" font-size="${fontSize}" font-weight="${style.bold ? 700 : 500}" font-style="${style.italic ? 'italic' : 'normal'}" fill="${style.color}" stroke="${style.outlineColor}" stroke-width="${style.outlineWidth}" paint-order="stroke fill">${escapedText}</text>`,
    '</svg>'
  ].join('');
}

export function getBuiltinSubtitleStyleTemplate(id: BuiltinSubtitleStyleTemplateId | string): SubtitleStyleTemplate | undefined {
  return BUILTIN_SUBTITLE_STYLE_TEMPLATES.find((template) => template.id === id);
}

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, numeric));
}

function normalizeColor(value: unknown, fallback: string): string {
  return typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value.trim()) ? value.trim().toLowerCase() : fallback;
}

function normalizeFontFamily(value: unknown): string {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  return trimmed || DEFAULT_SUBTITLE_STYLE.fontFamily;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
