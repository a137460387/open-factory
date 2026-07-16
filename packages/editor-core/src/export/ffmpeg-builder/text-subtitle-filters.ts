import {
  normalizeSubtitleLanguage,
  normalizeTextPath,
  type TextStyle,
} from '../../model';
import {
  buildCustomShaderFragmentSource,
  getEnabledCustomShaderEffect,
  normalizeCustomShaderParams,
} from '../../effects';
import {
  buildArcTextLayout,
  buildRichTextDrawSegments,
  calculateTextAutoLayout,
  formatOpenTypeFeatureList,
  normalizeTextArc,
  normalizeTextLayout,
  normalizeTextOpenTypeFeatures,
  richTextToPlainText,
} from '../../text-layout';
import { buildPathTextFrameLayouts } from '../../text-path';
import { buildCreditsRollYExpression, formatCreditsRowsForTextfile } from '../../credits-roll';
import {
  serializeSubtitleCueInputsToAss,
  serializeSubtitleCueInputsToSrt,
  serializeSubtitleCueInputsToVtt,
  type SubtitleCueInput,
} from '../../subtitles/srt';
import { normalizeDataSubtitleSource, resolveDataSubtitleText } from '../../data-subtitle';
import { MOTION_GRAPHIC_SEQUENCE_KIND, normalizeMotionGraphic } from '../../motion-graphics';
import {
  cssColorToFfmpeg,
  escapeDrawtextValue,
  formatFfmpegSeconds,
  normalizeFfmpegPath,
} from '../ffmpeg-escape';
import type {
  ExportClip,
  ExportAudioVisualizationBackground,
  ExportAudioVisualizationSettings,
  ExportSubtitleFormat,
  ExportSettings,
  ExportTimeline,
  TextArtifact,
} from '../export-types';
import { formatFfmpegNumber, safeLabel, getAnimatedFrames, buildTimelineExpression } from './utils';
import { CUSTOM_SHADER_SEQUENCE_KIND, PATH_TEXT_SEQUENCE_KIND, MOTION_GRAPHIC_SEQUENCE_PATH_MODE } from './settings-normalize';
import { resolveExportAudioVisualizationTheme } from './audio-visualization';
import { buildOpacityFilters } from './visual-filters';
import { expandAudioVisualizationTheme, type ExpandedAudioVisualizationTheme } from '../../audio-visualization-themes';

// ---------------------------------------------------------------------------
// Input builders
// ---------------------------------------------------------------------------

export function buildInputArgs(clip: ExportClip): string[] {
  if (clip.imageSequence) {
    return ['-f', 'concat', '-safe', '0'];
  }
  if (clip.type === 'image') {
    return ['-loop', '1', '-t', formatFfmpegSeconds(clip.duration)];
  }
  if (clip.type === 'video' || clip.type === 'audio' || clip.type === 'nested-sequence') {
    return ['-ss', formatFfmpegSeconds(clip.trimStart), '-t', formatFfmpegSeconds(getExportClipSourceDuration(clip))];
  }
  return [];
}

export function buildCustomShaderSequenceInputArgs(settings: ExportSettings): string[] {
  return ['-f', 'image2', '-framerate', String(settings.fps), '-start_number', '1'];
}

export function buildCustomShaderSequenceClip(clip: ExportClip): ExportClip {
  return {
    ...clip,
    trimStart: 0,
    trimEnd: 0,
    speed: 1,
    sourceDuration: clip.duration,
    keyframes: clip.keyframes ? { ...clip.keyframes, speed: [] } : clip.keyframes,
  };
}

export function buildPathTextSequenceArtifact(clip: ExportClip, settings: ExportSettings): TextArtifact | undefined {
  if (clip.type !== 'text' || !clip.textStyle) {
    return undefined;
  }
  const text = richTextToPlainText(clip.textStyle.richText ?? undefined, clip.textStyle.text);
  if (!text.trim()) {
    return undefined;
  }
  const pathText = normalizeTextPath(clip.textPath ?? undefined);
  const arcText = normalizeTextArc(clip.textStyle.arcText ?? undefined);
  if (!arcText.enabled && (!pathText.enabled || pathText.path.length < 2)) {
    return undefined;
  }
  const safeId = safeLabel(clip.id);
  const scale = Math.max(0.01, clip.transform.scaleX ?? clip.transform.scale);
  const fontSize = Math.max(1, Math.round(clip.textStyle.fontSize * scale));
  const fps = Math.max(1, settings.fps);
  const frameCount = Math.max(1, Math.ceil(Math.max(clip.duration, 1 / fps) * fps));
  const frames = arcText.enabled
    ? Array.from({ length: frameCount }, (_, frameIndex) => ({
        time: round(frameIndex / fps),
        chars: buildArcTextLayout({
          text,
          arc: arcText,
          fontSize,
          letterSpacing: pathText.letterSpacing,
          centerX: settings.width / 2 + clip.transform.x,
          centerY: settings.height / 2 + clip.transform.y,
        }).map((item) => ({
          char: item.char,
          index: item.index,
          x: item.x,
          y: item.y,
          angle: item.rotation,
          distance: Math.abs(item.angle - arcText.startAngle),
        })),
      }))
    : buildPathTextFrameLayouts({
        text,
        path: pathText.path,
        pathText,
        keyframes: clip.keyframes,
        duration: clip.duration,
        fps,
        width: settings.width,
        height: settings.height,
        fontSize,
        letterSpacing: pathText.letterSpacing,
        rotateCharacters: pathText.rotateCharacters,
        offsetX: clip.transform.x,
        offsetY: clip.transform.y,
      });
  return {
    clipId: `${clip.id}:${arcText.enabled ? 'arc-text' : 'path-text'}`,
    text: JSON.stringify({
      kind: PATH_TEXT_SEQUENCE_KIND,
      version: 1,
      clipId: clip.id,
      width: Math.max(1, Math.round(settings.width)),
      height: Math.max(1, Math.round(settings.height)),
      fps,
      frameCount,
      fontSize,
      fontColor: clip.textStyle.fontColor,
      fontFamily: clip.textStyle.fontFamily,
      fontPath: clip.textStyle.fontPath,
      bold: clip.textStyle.bold,
      italic: clip.textStyle.italic,
      frames: frames.slice(0, frameCount),
    }),
    fileName: `${arcText.enabled ? 'arc-text' : 'path-text'}-${safeId}.json`,
    placeholder: `__PATH_TEXT_SEQUENCE_${safeId}__`,
    pathMode: 'path-text-sequence',
  };
}

export function buildMotionGraphicSequenceArtifact(clip: ExportClip, settings: ExportSettings): TextArtifact | undefined {
  if (clip.type !== 'motion-graphic' || !clip.motionGraphic) {
    return undefined;
  }
  const safeId = safeLabel(clip.id);
  const fps = Math.max(1, settings.fps);
  const frameCount = Math.max(1, Math.ceil(Math.max(clip.duration, 1 / fps) * fps));
  return {
    clipId: `${clip.id}:motion-graphic`,
    text: JSON.stringify({
      kind: MOTION_GRAPHIC_SEQUENCE_KIND,
      version: 1,
      clipId: clip.id,
      templateType: clip.motionGraphic.templateType,
      motionGraphic: normalizeMotionGraphic(clip.motionGraphic, clip.duration),
      width: Math.max(1, Math.round(settings.width)),
      height: Math.max(1, Math.round(settings.height)),
      fps,
      frameCount,
      duration: clip.duration,
    }),
    fileName: `motion-graphic-${safeId}.json`,
    placeholder: `__MOTION_GRAPHIC_SEQUENCE_${safeId}__`,
    pathMode: MOTION_GRAPHIC_SEQUENCE_PATH_MODE,
  };
}

export function buildCustomShaderSequenceArtifact(clip: ExportClip, settings: ExportSettings): TextArtifact | undefined {
  if (clip.type !== 'video' && clip.type !== 'image' && clip.type !== 'nested-sequence') {
    return undefined;
  }
  if (!clip.mediaPath || clip.imageSequence) {
    return undefined;
  }
  const effect = getEnabledCustomShaderEffect(clip.effects);
  if (!effect) {
    return undefined;
  }
  const safeId = safeLabel(clip.id);
  const params = normalizeCustomShaderParams(effect.params);
  const frameCount = Math.max(
    1,
    Math.ceil(Math.max(clip.duration, 1 / Math.max(1, settings.fps)) * Math.max(1, settings.fps)),
  );
  return {
    clipId: `${clip.id}:custom-shader`,
    text: JSON.stringify({
      kind: CUSTOM_SHADER_SEQUENCE_KIND,
      version: 1,
      clipId: clip.id,
      preset: params.preset,
      shaderSource: params.source,
      fragmentSource: buildCustomShaderFragmentSource(params.source),
      mediaPath: normalizeFfmpegPath(clip.mediaPath),
      clipType: clip.type,
      trimStart: clip.trimStart,
      sourceDuration: getExportClipSourceDuration(clip),
      duration: clip.duration,
      speed: clip.speed,
      width: Math.max(1, Math.round(settings.width)),
      height: Math.max(1, Math.round(settings.height)),
      fps: Math.max(1, settings.fps),
      frameCount,
    }),
    fileName: `custom-shader-${safeId}.json`,
    placeholder: `__CUSTOM_SHADER_SEQUENCE_${safeId}__`,
    pathMode: 'shader-sequence',
  };
}

export function buildImageSequenceArtifact(clip: ExportClip): TextArtifact {
  const safeId = safeLabel(clip.id);
  const frameDuration = 1 / Math.max(1, clip.imageSequence?.frameRate ?? 30);
  const paths = clip.imageSequence?.paths ?? [];
  const lines = ['ffconcat version 1.0'];
  for (const path of paths) {
    lines.push(`file '${escapeConcatPath(path)}'`);
    lines.push(`duration ${formatSequenceFrameDuration(frameDuration)}`);
  }
  const lastPath = paths.at(-1);
  if (lastPath) {
    lines.push(`file '${escapeConcatPath(lastPath)}'`);
  }
  return {
    clipId: `${clip.id}:image-sequence`,
    text: `${lines.join('\n')}\n`,
    fileName: `sequence-${safeId}.ffconcat`,
    placeholder: `__IMAGE_SEQUENCE_${safeId}__`,
    pathMode: 'argument',
  };
}

// ---------------------------------------------------------------------------
// Sequence / concat helpers
// ---------------------------------------------------------------------------

export function pngSequenceOutputPath(outputPath: string): string {
  const normalized = normalizeFfmpegPath(outputPath);
  const lower = normalized.toLowerCase();
  if (lower.includes('%') || lower.endsWith('.png')) {
    return normalized;
  }
  return `${normalized.replace(/\/+$/g, '')}/frame%04d.png`;
}

export function escapeConcatPath(path: string): string {
  return normalizeFfmpegPath(path).replace(/'/g, "'\\''");
}

export function formatSequenceFrameDuration(value: number): string {
  return value.toFixed(6).replace(/0+$/g, '').replace(/\.$/g, '');
}

export function getExportClipSourceDuration(clip: ExportClip): number {
  return clip.type === 'video' || clip.type === 'audio' || clip.type === 'nested-sequence'
    ? Math.max(0.001, clip.sourceDuration)
    : Math.max(0.001, clip.duration);
}

// ---------------------------------------------------------------------------
// Text filter builders
// ---------------------------------------------------------------------------

export function buildTextFilter(
  inputLabel: string,
  outputLabel: string,
  clip: ExportClip,
  settings: ExportSettings,
): { filter: string; artifacts: TextArtifact[] } {
  const safeId = safeLabel(clip.id);
  const placeholder = `__TEXTFILE_${safeId}__`;
  const textSourceLabel = `textsrc_${safeId}`;
  const textDrawLabel = `textdraw_${safeId}`;
  const textLayerLabel = `textlayer_${safeId}`;
  const style = clip.textStyle;
  if (style && shouldUseAdvancedTextFilters(style)) {
    return buildAdvancedTextFilter(inputLabel, outputLabel, clip, settings, style, textSourceLabel, textLayerLabel);
  }
  const artifact: TextArtifact = {
    clipId: clip.id,
    text: style?.text ?? '',
    fileName: `${safeId}.txt`,
    placeholder,
  };
  const fontPath = style?.fontPath ? `:fontfile=${escapeDrawtextValue(style.fontPath)}` : '';
  const openType = buildOpenTypeDrawtextOptions(style);
  const fontColor = cssColorToFfmpeg(style?.fontColor ?? 'white');
  const backgroundColor = cssColorToFfmpeg(style?.backgroundColor ?? 'black');
  const backgroundOpacity = formatOpacity(style?.backgroundOpacity ?? 0);
  const fontSize = buildTextFontSizeExpression(clip, Math.max(1, Math.round(style?.fontSize ?? 48)));
  const x = buildDrawtextPositionExpression(clip, 'x', style?.x ?? clip.transform.x);
  const y = buildDrawtextPositionExpression(clip, 'y', style?.y ?? clip.transform.y);
  const layerDuration = Math.max(0.001, clip.start + clip.duration);
  const opacityFilters = buildOpacityFilters(clip, textLayerLabel);
  return {
    artifacts: [artifact],
    filter: [
      `color=c=black@0:s=${settings.width}x${settings.height}:r=${settings.fps}:d=${formatFfmpegSeconds(layerDuration)},format=rgba[${textSourceLabel}]`,
      `[${textSourceLabel}]drawtext=textfile=${placeholder}${fontPath}${openType}:fontsize=${fontSize}:fontcolor=${fontColor}:x='${x}':y='${y}':alpha=1:box=1:boxcolor=${backgroundColor}@${backgroundOpacity}:boxborderw=${Math.max(
        0,
        Math.round((style?.fontSize ?? 48) * 0.25),
      )}:enable='between(t,${formatFfmpegSeconds(clip.start)},${formatFfmpegSeconds(clip.start + clip.duration)})'[${textDrawLabel}]`,
      `[${textDrawLabel}]${opacityFilters.join(',')}`,
      `[${inputLabel}][${textLayerLabel}]overlay=x=0:y=0:eval=frame:enable='between(t,${formatFfmpegSeconds(clip.start)},${formatFfmpegSeconds(clip.start + clip.duration)})'[${outputLabel}]`,
    ].join(';'),
  };
}

export function buildAdvancedTextFilter(
  inputLabel: string,
  outputLabel: string,
  clip: ExportClip,
  settings: ExportSettings,
  style: NonNullable<ExportClip['textStyle']>,
  textSourceLabel: string,
  textLayerLabel: string,
): { filter: string; artifacts: TextArtifact[] } {
  const safeId = safeLabel(clip.id);
  const layout = calculateTextAutoLayout({
    richText: style.richText ?? undefined,
    plainText: style.text,
    baseStyle: exportTextStyleToTextStyle(style),
    layout: style.textLayout ?? undefined,
  });
  const normalizedLayout = normalizeTextLayout(style.textLayout ?? undefined);
  const segments = buildRichTextDrawSegments({
    richText: style.richText ?? undefined,
    plainText: style.text,
    baseStyle: exportTextStyleToTextStyle(style),
    layout: normalizedLayout,
  });
  const artifacts: TextArtifact[] = [];
  const layerDuration = Math.max(0.001, clip.start + clip.duration);
  const backgroundColor = cssColorToFfmpeg(style.backgroundColor);
  const backgroundOpacity = formatOpacity(style.backgroundOpacity);
  const fontPath = style.fontPath ? `:fontfile=${escapeDrawtextValue(style.fontPath)}` : '';
  const openType = buildOpenTypeDrawtextOptions(style);
  const filters: string[] = [
    `color=c=black@0:s=${settings.width}x${settings.height}:r=${settings.fps}:d=${formatFfmpegSeconds(layerDuration)},format=rgba[${textSourceLabel}]`,
  ];
  let previousLabel = textSourceLabel;

  segments.forEach((segment, index) => {
    const placeholder = `__TEXTFILE_${safeId}_${segment.paragraphIndex}_${segment.runIndex}__`;
    const nextLabel = `textdraw_${safeId}_${index}`;
    const fontSize = buildTextFontSizeExpression(clip, Math.max(1, Math.round(segment.style.fontSize * layout.scale)));
    const baseX = buildDrawtextPositionExpression(clip, 'x', style.x);
    const baseY = buildDrawtextPositionExpression(clip, 'y', style.y);
    const x = `${baseX}${formatSigned(segment.xOffset - layout.width / 2)}`;
    const y = `${baseY}${formatSigned(segment.yOffset - layout.height / 2)}`;
    artifacts.push({
      clipId: `${clip.id}:text-${segment.paragraphIndex}-${segment.runIndex}`,
      text: segment.text,
      fileName: `${safeId}-${segment.paragraphIndex}-${segment.runIndex}.txt`,
      placeholder,
    });
    filters.push(
      `[${previousLabel}]drawtext=textfile=${placeholder}${fontPath}${openType}:fontsize=${fontSize}:fontcolor=${cssColorToFfmpeg(
        segment.style.color,
      )}:x='${x}':y='${y}':alpha=1:box=1:boxcolor=${backgroundColor}@${backgroundOpacity}:boxborderw=${Math.max(
        0,
        Math.round(segment.style.fontSize * 0.25),
      )}:enable='between(t,${formatFfmpegSeconds(clip.start)},${formatFfmpegSeconds(clip.start + clip.duration)})'[${nextLabel}]`,
    );
    previousLabel = nextLabel;
  });

  const opacityFilters = buildOpacityFilters(clip, textLayerLabel);
  filters.push(`[${previousLabel}]${opacityFilters.join(',')}`);
  filters.push(
    `[${inputLabel}][${textLayerLabel}]overlay=x=0:y=0:eval=frame:enable='between(t,${formatFfmpegSeconds(clip.start)},${formatFfmpegSeconds(clip.start + clip.duration)})'[${outputLabel}]`,
  );
  return { filter: filters.join(';'), artifacts };
}

export function shouldUseAdvancedTextFilters(style: NonNullable<ExportClip['textStyle']>): boolean {
  const richText = style.richText ?? undefined;
  const hasRichStructure = richText
    ? richText.paragraphs.length > 1 ||
      richText.paragraphs.some(
        (paragraph) =>
          paragraph.runs.length > 1 ||
          paragraph.runs.some(
            (run) =>
              run.bold !== undefined ||
              run.italic !== undefined ||
              run.underline !== undefined ||
              run.color !== undefined ||
              run.fontSize !== undefined,
          ),
      )
    : false;
  const layout = normalizeTextLayout(style.textLayout ?? undefined);
  const defaultLayout = normalizeTextLayout(undefined);
  const hasCustomLayout =
    layout.fitMode !== defaultLayout.fitMode ||
    layout.boxWidth !== defaultLayout.boxWidth ||
    layout.boxHeight !== defaultLayout.boxHeight ||
    layout.paragraphSpacing !== defaultLayout.paragraphSpacing ||
    layout.firstLineIndent !== defaultLayout.firstLineIndent;
  return hasRichStructure || hasCustomLayout;
}

export function buildOpenTypeDrawtextOptions(style: NonNullable<ExportClip['textStyle']> | null | undefined): string {
  const features = formatOpenTypeFeatureList(normalizeTextOpenTypeFeatures(style?.openTypeFeatures ?? undefined));
  if (!features) {
    return '';
  }
  const family = (style?.fontFamily ?? 'Sans').split(',')[0]?.replace(/["']/g, '').trim() || 'Sans';
  const fontPattern = `${family}:fontfeatures=${features}`;
  return style?.fontPath
    ? `:text_shaping=1:font='${escapeDrawtextValue(fontPattern)}'`
    : `:font='${escapeDrawtextValue(fontPattern)}':text_shaping=1`;
}

export function exportTextStyleToTextStyle(style: NonNullable<ExportClip['textStyle']>): TextStyle {
  return {
    fontSize: style.fontSize,
    color: style.fontColor,
    backgroundColor: style.backgroundColor,
    backgroundOpacity: style.backgroundOpacity,
    fontFamily: style.fontFamily,
    bold: style.bold,
    italic: style.italic,
  };
}

// ---------------------------------------------------------------------------
// Audio visualization
// ---------------------------------------------------------------------------

export function resolveAudioVisualizationBackground(
  visualization: ExportAudioVisualizationSettings,
): ExportAudioVisualizationBackground {
  const theme = resolveExportAudioVisualizationTheme(visualization);
  if (!theme) {
    return visualization.background;
  }
  if (theme.background.type === 'gradient') {
    return { type: 'gradient', color: theme.background.color, color2: theme.background.color2 };
  }
  return { type: 'solid', color: theme.background.color };
}

// ---------------------------------------------------------------------------
// Credits roll
// ---------------------------------------------------------------------------

export function buildCreditsRollFilter(
  inputLabel: string,
  outputLabel: string,
  clip: ExportClip,
  settings: ExportSettings,
): { filter: string; artifact: TextArtifact } {
  const safeId = safeLabel(clip.id);
  const placeholder = `__CREDITSFILE_${safeId}__`;
  const textSourceLabel = `creditssrc_${safeId}`;
  const textDrawLabel = `creditsdraw_${safeId}`;
  const textLayerLabel = `creditslayer_${safeId}`;
  const style = clip.creditsStyle;
  const artifact: TextArtifact = {
    clipId: clip.id,
    text: style ? formatCreditsRowsForTextfile(style.rows) : '',
    fileName: `${safeId}-credits.txt`,
    placeholder,
  };
  const fontPath = style?.fontPath ? `:fontfile=${escapeDrawtextValue(style.fontPath)}` : '';
  const fontColor = cssColorToFfmpeg(style?.fontColor ?? 'white');
  const backgroundColor = cssColorToFfmpeg(style?.backgroundColor ?? 'black');
  const backgroundOpacity = formatOpacity(style?.backgroundOpacity ?? 0);
  const fontSize = buildTextFontSizeExpression(clip, Math.max(1, Math.round(style?.fontSize ?? 42)));
  const horizontalMargin = Math.max(0, Math.round(style?.horizontalMargin ?? 0));
  const x = `max(${horizontalMargin},(w-text_w)/2)`;
  const y = buildCreditsRollYExpression(style?.rollSpeed ?? 80);
  const lineSpacing = Math.max(0, Math.round(style?.lineSpacing ?? 0));
  const layerDuration = Math.max(0.001, clip.start + clip.duration);
  const opacityFilters = buildOpacityFilters(clip, textLayerLabel);
  return {
    artifact,
    filter: [
      `color=c=${backgroundColor}@${backgroundOpacity}:s=${settings.width}x${settings.height}:r=${settings.fps}:d=${formatFfmpegSeconds(layerDuration)},format=rgba[${textSourceLabel}]`,
      `[${textSourceLabel}]drawtext=textfile=${placeholder}${fontPath}:fontsize=${fontSize}:fontcolor=${fontColor}:x='${x}':y='${y}':line_spacing=${lineSpacing}:alpha=1:enable='between(t,${formatFfmpegSeconds(
        clip.start,
      )},${formatFfmpegSeconds(clip.start + clip.duration)})'[${textDrawLabel}]`,
      `[${textDrawLabel}]${opacityFilters.join(',')}`,
      `[${inputLabel}][${textLayerLabel}]overlay=x=0:y=0:eval=frame:enable='between(t,${formatFfmpegSeconds(clip.start)},${formatFfmpegSeconds(clip.start + clip.duration)})'[${outputLabel}]`,
    ].join(';'),
  };
}

// ---------------------------------------------------------------------------
// Path text sequence overlay
// ---------------------------------------------------------------------------

export function buildPathTextSequenceOverlayFilter(
  inputLabel: string,
  outputLabel: string,
  inputIndex: number,
  clip: ExportClip,
): string {
  const safeId = safeLabel(clip.id);
  const sourceLabel = `pathtextsrc_${safeId}`;
  const layerLabel = `pathtextlayer_${safeId}`;
  const opacityFilters = buildOpacityFilters(clip, layerLabel);
  return [
    `[${inputIndex}:v]trim=duration=${formatFfmpegSeconds(clip.duration)},setpts=PTS-STARTPTS+${formatFfmpegSeconds(clip.start)}/TB,format=rgba[${sourceLabel}]`,
    `[${sourceLabel}]${opacityFilters.join(',')}`,
    `[${inputLabel}][${layerLabel}]overlay=x=0:y=0:eval=frame:enable='between(t,${formatFfmpegSeconds(clip.start)},${formatFfmpegSeconds(clip.start + clip.duration)})'[${outputLabel}]`,
  ].join(';');
}

// ---------------------------------------------------------------------------
// Text position / font size expressions
// ---------------------------------------------------------------------------

export function buildTextFontSizeExpression(clip: ExportClip, baseFontSize: number): string {
  const frames = getAnimatedFrames(clip, 'scaleX');
  if (frames.length >= 2) {
    return `'${baseFontSize}*(${buildTimelineExpression(frames, clip.start, clip.transform.scaleX ?? clip.transform.scale, 'T')})'`;
  }
  const scale = frames.length === 1 ? frames[0].value : (clip.transform.scaleX ?? clip.transform.scale);
  return String(Math.max(1, Math.round(baseFontSize * scale)));
}

export function buildDrawtextPositionExpression(clip: ExportClip, axis: 'x' | 'y', staticValue: number): string {
  const frames = getAnimatedFrames(clip, axis);
  const dimension = axis === 'x' ? 'w' : 'h';
  const textDimension = axis === 'x' ? 'text_w' : 'text_h';
  const fallback = Number.isFinite(staticValue) ? staticValue : 0;
  if (frames.length >= 2) {
    return `(${dimension}-${textDimension})/2+(${dimension}/2)*(${buildTimelineExpression(frames, clip.start, fallback, 'T')})`;
  }
  if (frames.length === 1) {
    return `(${dimension}-${textDimension})/2+(${dimension}/2)*${formatFfmpegNumber(frames[0].value)}`;
  }
  return `(${dimension}-${textDimension})/2+${formatSigned(fallback)}`;
}

// ---------------------------------------------------------------------------
// Subtitle filter / artifact builders
// ---------------------------------------------------------------------------

export function buildSubtitleBurnInFilter(
  inputLabel: string,
  outputLabel: string,
  clips: ExportClip[],
  format: ExportSubtitleFormat,
  options: SubtitleArtifactOptions = {},
): { filter: string; artifact: TextArtifact } {
  const artifact = buildSubtitleArtifact(clips, 'filter', format, options);
  const style = clips.find((clip) => clip.subtitleStyle)?.subtitleStyle;
  const forceStyle = [
    `FontSize=${Math.max(1, Math.round(style?.fontSize ?? 42))}`,
    `PrimaryColour=${cssColorToAssColor(style?.fontColor ?? '#ffffff')}`,
    `OutlineColour=${cssColorToAssColor(style?.outlineColor ?? '#000000')}`,
    `BackColour=${cssColorToAssColor((style?.backgroundOpacity ?? 0) > 0 ? (style?.backgroundColor ?? '#000000') : (style?.shadowColor ?? style?.backgroundColor ?? '#000000'), style?.backgroundOpacity ?? 0)}`,
    `BorderStyle=${(style?.backgroundOpacity ?? 0) > 0 ? 3 : 1}`,
    `Outline=${Math.max(0, Math.round(style?.outlineWidth ?? 0))}`,
    `Shadow=${Math.max(0, Math.round(style?.shadowOffset ?? 0))}`,
    'Alignment=2',
    `MarginV=${Math.max(0, Math.round(style?.yOffset ?? 72))}`,
  ].join(',');
  return {
    artifact,
    filter: `[${inputLabel}]subtitles=filename=${artifact.placeholder}:force_style='${forceStyle}'[${outputLabel}]`,
  };
}

export interface SubtitleArtifactOptions {
  language?: string;
  includeLanguageInFileName?: boolean;
}

export function buildSubtitleArtifact(
  clips: ExportClip[],
  pathMode: TextArtifact['pathMode'],
  format: ExportSubtitleFormat,
  options: SubtitleArtifactOptions = {},
): TextArtifact {
  const cues = buildSubtitleCueInputs(clips);
  const language = options.language ? normalizeSubtitleLanguage(options.language) : undefined;
  const suffix = language && options.includeLanguageInFileName ? `.${language}` : '';
  const placeholderSuffix = language && options.includeLanguageInFileName ? `_${language}` : '';
  const sidecarSuffix = pathMode === 'sidecar' ? '_sidecar' : '';
  return {
    clipId: language && options.includeLanguageInFileName ? `subtitles-${language}` : 'subtitles',
    text: serializeSubtitleCueInputs(cues, format),
    fileName: `subtitles${suffix}.${format}`,
    placeholder: `__SUBTITLEFILE_export_subtitles${placeholderSuffix}${sidecarSuffix}__`,
    pathMode,
  };
}

export function buildSubtitleLanguageGroups(
  timeline: ExportTimeline,
  clips: ExportClip[],
  selectedLanguages: string[] | undefined,
): SubtitleLanguageGroup[] {
  if (clips.length === 0) {
    return [];
  }
  const selected = selectedLanguages ? new Set(selectedLanguages.map(normalizeSubtitleLanguage)) : undefined;
  const groups = new Map<string, ExportClip[]>();
  for (const clip of clips) {
    const language = normalizeSubtitleLanguage(timeline.tracks[clip.trackIndex]?.language);
    if (selected && !selected.has(language)) {
      continue;
    }
    const current = groups.get(language) ?? [];
    current.push(clip);
    groups.set(language, current);
  }
  return Array.from(groups.entries()).map(([language, groupClips]) => ({
    language,
    clips: groupClips.sort((left, right) => left.start - right.start || left.id.localeCompare(right.id)),
  }));
}

export function selectSubtitleBurnInGroup(
  groups: SubtitleLanguageGroup[],
  language: string | null | undefined,
): SubtitleLanguageGroup | undefined {
  if (groups.length === 0) {
    return undefined;
  }
  if (!language) {
    return groups[0];
  }
  const normalized = normalizeSubtitleLanguage(language);
  return groups.find((group) => group.language === normalized) ?? groups[0];
}

export function subtitleLanguageToFfmpegMetadata(language: string): string {
  const normalized = normalizeSubtitleLanguage(language);
  const map: Record<string, string> = {
    ar: 'ara',
    de: 'deu',
    en: 'eng',
    es: 'spa',
    fr: 'fra',
    it: 'ita',
    ja: 'jpn',
    ko: 'kor',
    pt: 'por',
    ru: 'rus',
    zh: 'zho',
  };
  return map[normalized] ?? normalized;
}

export function buildSubtitleCueInputs(clips: ExportClip[]): SubtitleCueInput[] {
  return clips.flatMap((clip) => {
    const source = normalizeDataSubtitleSource(clip.dataSubtitle);
    if (!source) {
      return [buildSubtitleCueInput(clip, clip.start, clip.duration, clip.subtitleStyle?.text ?? '', clip.id)];
    }
    const clipEnd = round(clip.start + clip.duration);
    const cueStarts = [
      clip.start,
      ...source.rows.map((row) => row.time).filter((time) => time > clip.start && time < clipEnd),
    ].sort((left, right) => left - right);
    return cueStarts.flatMap((start, index) => {
      const end = cueStarts[index + 1] ?? clipEnd;
      const text = resolveDataSubtitleText(source, start, { fps: projectFrameRateFromClip(clip) });
      return text && end > start
        ? [buildSubtitleCueInput(clip, start, round(end - start), text, `${clip.id}-data-${index + 1}`)]
        : [];
    });
  });
}

export function buildSubtitleCueInput(
  clip: ExportClip,
  start: number,
  duration: number,
  text: string,
  id: string,
): SubtitleCueInput {
  return {
    id,
    start,
    duration,
    text,
    subtitleType: clip.subtitleType ?? undefined,
    speaker: clip.speaker ?? undefined,
    soundDesc: clip.soundDesc ?? undefined,
    style: clip.subtitleStyle
      ? {
          fontFamily: clip.subtitleStyle.fontFamily,
          fontSize: clip.subtitleStyle.fontSize,
          color: clip.subtitleStyle.fontColor,
          backgroundColor: clip.subtitleStyle.backgroundColor,
          backgroundOpacity: clip.subtitleStyle.backgroundOpacity,
          outlineColor: clip.subtitleStyle.outlineColor,
          outlineWidth: clip.subtitleStyle.outlineWidth,
          shadowColor: clip.subtitleStyle.shadowColor,
          shadowOffset: clip.subtitleStyle.shadowOffset,
          bold: clip.subtitleStyle.bold,
          italic: clip.subtitleStyle.italic,
          yOffset: clip.subtitleStyle.yOffset,
          x: clip.subtitleStyle.x,
          y: clip.subtitleStyle.y,
        }
      : undefined,
  };
}

export function projectFrameRateFromClip(clip: ExportClip): number {
  return clip.sequenceFrameRate ?? 30;
}

export function serializeSubtitleCueInputs(cues: SubtitleCueInput[], format: ExportSubtitleFormat): string {
  if (format === 'vtt') {
    return serializeSubtitleCueInputsToVtt(cues);
  }
  if (format === 'ass' || format === 'ssa') {
    return serializeSubtitleCueInputsToAss(cues, format);
  }
  return serializeSubtitleCueInputsToSrt(cues);
}

export function buildSubtitleInputArgs(format: ExportSubtitleFormat): string[] {
  if (format === 'vtt') {
    return ['-f', 'webvtt'];
  }
  if (format === 'ass') {
    return ['-f', 'ass'];
  }
  if (format === 'ssa') {
    return ['-f', 'ssa'];
  }
  return ['-f', 'srt'];
}

export function buildSoftSubtitleCodec(format: ExportSubtitleFormat, settings: ExportSettings): string {
  if (format === 'ass' || format === 'ssa') {
    return 'ass';
  }
  if (format === 'vtt' && settings.format === 'webm') {
    return 'webvtt';
  }
  return 'mov_text';
}

export function normalizeSubtitleFormat(format: ExportSettings['subtitleFormat']): ExportSubtitleFormat {
  return format === 'vtt' || format === 'ass' || format === 'ssa' ? format : 'srt';
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

export interface SubtitleLanguageGroup {
  language: string;
  clips: ExportClip[];
}

export function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

export function formatOpacity(value: number): string {
  return formatFfmpegSeconds(Math.min(1, Math.max(0, value)));
}

export function formatSigned(value: number): string {
  if (!Number.isFinite(value) || Math.abs(value) < 1e-9) {
    return '';
  }
  const formatted = formatFfmpegNumber(value);
  return value > 0 ? `+${formatted}` : formatted;
}

export function cssColorToAssColor(hex: string, opacity?: number): string {
  const trimmed = hex.trim().replace(/^#/, '');
  const r = parseInt(trimmed.slice(0, 2), 16) || 0;
  const g = parseInt(trimmed.slice(2, 4), 16) || 0;
  const b = parseInt(trimmed.slice(4, 6), 16) || 0;
  const alpha = opacity !== undefined ? Math.round(Math.min(1, Math.max(0, opacity)) * 255) : 0;
  const toHex = (v: number) => v.toString(16).padStart(2, '0');
  return `&H${toHex(alpha)}${toHex(b)}${toHex(g)}${toHex(r)}`.toUpperCase();
}
