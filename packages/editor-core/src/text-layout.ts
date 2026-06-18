import { round } from './time';
import type { RichTextDocument, RichTextRun, TextArcOptions, TextLayoutOptions, TextOpenTypeFeatures, TextStyle } from './model-types';

export const DEFAULT_TEXT_LAYOUT: TextLayoutOptions = {
  fitMode: 'fixed',
  boxWidth: 640,
  boxHeight: 180,
  paragraphSpacing: 12,
  firstLineIndent: 0
};

export const DEFAULT_TEXT_OPEN_TYPE_FEATURES: TextOpenTypeFeatures = {
  liga: false,
  smcp: false,
  tnum: false,
  swsh: false
};

export const DEFAULT_TEXT_ARC: TextArcOptions = {
  enabled: false,
  radius: 280,
  startAngle: -30,
  clockwise: true,
  rotateCharacters: true
};

export interface RichTextDrawSegment {
  text: string;
  paragraphIndex: number;
  runIndex: number;
  xOffset: number;
  yOffset: number;
  style: {
    fontSize: number;
    color: string;
    bold: boolean;
    italic: boolean;
    underline: boolean;
  };
}

export interface TextAutoLayoutResult {
  fitMode: TextLayoutOptions['fitMode'];
  width: number;
  height: number;
  scale: number;
  paragraphCount: number;
}

export interface ArcTextCharacterLayout {
  char: string;
  index: number;
  angle: number;
  rotation: number;
  x: number;
  y: number;
}

export function normalizeRichTextDocument(value: Partial<RichTextDocument> | undefined, fallbackText = ''): RichTextDocument {
  if (!value || !Array.isArray(value.paragraphs)) {
    return plainTextToRichTextDocument(fallbackText);
  }
  const paragraphs = value.paragraphs.map((paragraph) => ({
    runs: Array.isArray(paragraph?.runs)
      ? paragraph.runs.map((run) => normalizeRichTextRun(run)).filter((run) => run.text.length > 0)
      : []
  }));
  const nonEmpty = paragraphs.filter((paragraph) => paragraph.runs.length > 0);
  return nonEmpty.length > 0 ? { paragraphs: nonEmpty } : plainTextToRichTextDocument(fallbackText);
}

export function serializeRichTextDocument(value: Partial<RichTextDocument> | undefined, fallbackText = ''): string {
  return JSON.stringify(normalizeRichTextDocument(value, fallbackText));
}

export function richTextToPlainText(value: Partial<RichTextDocument> | undefined, fallbackText = ''): string {
  return normalizeRichTextDocument(value, fallbackText)
    .paragraphs.map((paragraph) => paragraph.runs.map((run) => run.text).join(''))
    .join('\n');
}

export function plainTextToRichTextDocument(text: string): RichTextDocument {
  const paragraphs = String(text ?? '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => ({ runs: [{ text: line }] }));
  return { paragraphs: paragraphs.length > 0 ? paragraphs : [{ runs: [{ text: '' }] }] };
}

export function normalizeTextLayout(value: Partial<TextLayoutOptions> | undefined): TextLayoutOptions {
  return {
    fitMode: value?.fitMode === 'auto-height' || value?.fitMode === 'auto-scale' ? value.fitMode : DEFAULT_TEXT_LAYOUT.fitMode,
    boxWidth: round(Math.min(4096, Math.max(24, finiteOrDefault(value?.boxWidth, DEFAULT_TEXT_LAYOUT.boxWidth)))),
    boxHeight: round(Math.min(4096, Math.max(24, finiteOrDefault(value?.boxHeight, DEFAULT_TEXT_LAYOUT.boxHeight)))),
    paragraphSpacing: round(Math.min(240, Math.max(0, finiteOrDefault(value?.paragraphSpacing, DEFAULT_TEXT_LAYOUT.paragraphSpacing)))),
    firstLineIndent: round(Math.min(960, Math.max(-960, finiteOrDefault(value?.firstLineIndent, DEFAULT_TEXT_LAYOUT.firstLineIndent))))
  };
}

export function normalizeTextOpenTypeFeatures(value: Partial<TextOpenTypeFeatures> | undefined): TextOpenTypeFeatures {
  return {
    liga: value?.liga === true,
    smcp: value?.smcp === true,
    tnum: value?.tnum === true,
    swsh: value?.swsh === true
  };
}

export function normalizeTextArc(value: Partial<TextArcOptions> | undefined): TextArcOptions {
  return {
    enabled: value?.enabled === true,
    radius: round(Math.min(4000, Math.max(24, finiteOrDefault(value?.radius, DEFAULT_TEXT_ARC.radius)))),
    startAngle: round(Math.min(360, Math.max(-360, finiteOrDefault(value?.startAngle, DEFAULT_TEXT_ARC.startAngle)))),
    clockwise: value?.clockwise !== false,
    rotateCharacters: value?.rotateCharacters !== false
  };
}

export function buildRichTextDrawSegments(input: {
  richText?: Partial<RichTextDocument>;
  plainText: string;
  baseStyle: TextStyle;
  layout?: Partial<TextLayoutOptions>;
}): RichTextDrawSegment[] {
  const document = normalizeRichTextDocument(input.richText, input.plainText);
  const layout = normalizeTextLayout(input.layout);
  const segments: RichTextDrawSegment[] = [];
  let yOffset = 0;

  document.paragraphs.forEach((paragraph, paragraphIndex) => {
    let xOffset = paragraphIndex === 0 ? layout.firstLineIndent : 0;
    let paragraphLineHeight = Math.max(1, input.baseStyle.fontSize * 1.2);
    paragraph.runs.forEach((run, runIndex) => {
      const style = mergeRunStyle(run, input.baseStyle);
      paragraphLineHeight = Math.max(paragraphLineHeight, style.fontSize * 1.2);
      if (run.text.length > 0) {
        segments.push({
          text: run.text,
          paragraphIndex,
          runIndex,
          xOffset: round(xOffset),
          yOffset: round(yOffset),
          style
        });
      }
      xOffset += estimateTextWidth(run.text, style.fontSize);
    });
    yOffset += paragraphLineHeight + layout.paragraphSpacing;
  });

  return segments;
}

export function calculateTextAutoLayout(input: {
  richText?: Partial<RichTextDocument>;
  plainText: string;
  baseStyle: TextStyle;
  layout?: Partial<TextLayoutOptions>;
}): TextAutoLayoutResult {
  const layout = normalizeTextLayout(input.layout);
  const segments = buildRichTextDrawSegments(input);
  const paragraphCount = Math.max(1, normalizeRichTextDocument(input.richText, input.plainText).paragraphs.length);
  const contentHeight =
    segments.reduce((height, segment) => Math.max(height, segment.yOffset + segment.style.fontSize * 1.2), 0) + Math.max(0, paragraphCount - 1) * 0;
  const contentWidth = segments.reduce((width, segment) => Math.max(width, segment.xOffset + estimateTextWidth(segment.text, segment.style.fontSize)), 0);
  if (layout.fitMode === 'auto-height') {
    return { fitMode: layout.fitMode, width: layout.boxWidth, height: round(Math.max(layout.boxHeight, contentHeight)), scale: 1, paragraphCount };
  }
  if (layout.fitMode === 'auto-scale') {
    const widthScale = contentWidth > 0 ? layout.boxWidth / contentWidth : 1;
    const heightScale = contentHeight > 0 ? layout.boxHeight / contentHeight : 1;
    return { fitMode: layout.fitMode, width: layout.boxWidth, height: layout.boxHeight, scale: round(Math.min(1, widthScale, heightScale)), paragraphCount };
  }
  return { fitMode: layout.fitMode, width: layout.boxWidth, height: layout.boxHeight, scale: 1, paragraphCount };
}

export function buildArcTextLayout(input: {
  text: string;
  arc: Partial<TextArcOptions>;
  fontSize: number;
  letterSpacing?: number;
  centerX?: number;
  centerY?: number;
}): ArcTextCharacterLayout[] {
  const arc = normalizeTextArc(input.arc);
  if (!arc.enabled) {
    return [];
  }
  const chars = Array.from(input.text ?? '');
  const direction = arc.clockwise ? 1 : -1;
  const radius = Math.max(1, arc.radius);
  const centerX = finiteOrDefault(input.centerX, 0);
  const centerY = finiteOrDefault(input.centerY, 0);
  const spacing = Math.max(0, finiteOrDefault(input.letterSpacing, 0));
  let cursor = 0;
  return chars.map((char, index) => {
    const advance = estimateCharacterAdvance(char, input.fontSize) + spacing;
    const angle = round(arc.startAngle + direction * ((cursor + advance / 2) / radius) * (180 / Math.PI));
    const radians = (angle * Math.PI) / 180;
    cursor += advance;
    return {
      char,
      index,
      angle,
      rotation: arc.rotateCharacters ? round(angle + (arc.clockwise ? 90 : -90)) : 0,
      x: round(centerX + Math.cos(radians) * radius),
      y: round(centerY + Math.sin(radians) * radius)
    };
  });
}

export function formatOpenTypeFeatureList(features: Partial<TextOpenTypeFeatures> | undefined): string {
  const normalized = normalizeTextOpenTypeFeatures(features);
  return (['liga', 'smcp', 'tnum', 'swsh'] as const)
    .filter((key) => normalized[key])
    .map((key) => `${key}=1`)
    .join(',');
}

function normalizeRichTextRun(run: Partial<RichTextRun> | undefined): RichTextRun {
  const text = String(run?.text ?? '').replace(/\r\n?|\n/g, ' ');
  return {
    text,
    bold: run?.bold === true || undefined,
    italic: run?.italic === true || undefined,
    underline: run?.underline === true || undefined,
    color: typeof run?.color === 'string' && run.color.trim() ? run.color.trim() : undefined,
    fontSize: typeof run?.fontSize === 'number' && Number.isFinite(run.fontSize) ? round(Math.min(512, Math.max(1, run.fontSize))) : undefined
  };
}

function mergeRunStyle(run: RichTextRun, baseStyle: TextStyle): RichTextDrawSegment['style'] {
  return {
    fontSize: run.fontSize ?? baseStyle.fontSize,
    color: run.color ?? baseStyle.color,
    bold: run.bold ?? baseStyle.bold,
    italic: run.italic ?? baseStyle.italic,
    underline: run.underline === true
  };
}

function estimateTextWidth(text: string, fontSize: number): number {
  return Array.from(text).reduce((width, char) => width + estimateCharacterAdvance(char, fontSize), 0);
}

function estimateCharacterAdvance(char: string, fontSize: number): number {
  if (char.trim().length === 0) {
    return Math.max(1, fontSize * 0.35);
  }
  return Math.max(1, fontSize * (char.charCodeAt(0) > 255 ? 0.95 : 0.6));
}

function finiteOrDefault(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}
