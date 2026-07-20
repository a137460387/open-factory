import {
  DEFAULT_COLOR_CORRECTION,
  isDefaultColorCorrection,
  normalizeColorCorrection,
  normalizeTransitionDuration,
  isStabilizationExportable,
  normalizeChromaKey,
  normalizeClipBorder,
  normalizeClipPanoramaView,
  normalizeFrameInterpolation,
  normalizeQualityEnhancement,
  normalizeSlowMotionMode,
  normalizeVideoRestoration,
  normalizeLutLayers,
  normalizeTransform,
  normalizeMasks,
  type ClipKeyframes,
} from '../../model';
import {
  isDefaultColorCurves,
  isNeutralThreeWayColor,
  normalizeThreeWayColor,
  serializeColorCurvesToCube,
  PrimaryWheels,
  PrimarySliders,
  toFfmpegSelectiveColor,
  type ColorWheelValue,
  type ColorGradingGraph,
  type CurvesNodeParams,
  type LUTApplyNodeParams,
  type PrimaryWheelParams,
  type PrimarySliderParams,
  type HSLQualifierParams,
  type WindowMaskParams,
  type ThreeWayColor,
} from '../../color-grading';
import {
  buildColorNodeGraphFilterPlan,
  detectColorNodeGraphCycle,
  normalizeColorNodeGraph,
} from '../../color-node-graph';
import { getLogToRec709Lut, isLogInputColorSpace, serializeLogToRec709Cube } from '../../color-log-luts';
import { buildMotionBlurExportFilter, normalizeMotionBlurParams } from '../../motion-blur';
import { buildReframeCropFilter, isReframeEnabled } from '../../reframe';
import { triangulatePathMask } from '../../masks/path-mask';
import { getFfmpegBlendMode, normalizeClipBlendMode, type ClipBlendMode } from '../../blend-modes';
import { getClipSpeed, calculateSpeedCurveSourceDuration } from '../../timeline';
import { round } from '../../time';
import {
  averageClipMotionScore,
  buildSceneBoundaryProtectionRanges,
  resolveFrameInterpolationMode,
} from '../frame-interpolation';
import { buildZscaleColorConversionFilter, normalizeProjectWorkingColorSpace } from '../../color-management';
import { buildPrivacyRedactionFFmpegExpressions } from '../../privacy-redaction';
import { cssColorToFfmpeg, escapeDrawtextValue, formatFfmpegSeconds } from '../ffmpeg-escape';
import {
  formatFfmpegNumber,
  formatScale,
  formatOpacity,
  safeLabel,
  formatOffsetExpression,
  getAnimatedFrames,
  buildTimelineExpression,
} from './utils';
import { SETPTS_EXPRESSION_LIMIT } from './settings-normalize';
import type { Effect } from '../../effects';
import { getEffectNumberParam } from '../../effects';
import type {
  ExportClip,
  ExportClipKeyframes,
  ExportKeyframe as ExportKeyframeType,
  ExportKeyframe,
  ExportTransition,
  ExportTimeline,
  ExportTrack,
  ExportSettings,
  FfmpegCapabilities,
  TextArtifact,
} from '../export-types';

export type AnimatedProperty = 'x' | 'y' | 'scaleX' | 'scaleY' | 'speed' | 'opacity';

export type VisualItem =
  | {
      kind: 'text';
      trackIndex: number;
      start: number;
      duration: number;
      clip: ExportClip;
    }
  | {
      kind: 'credits';
      trackIndex: number;
      start: number;
      duration: number;
      clip: ExportClip;
    }
  | {
      kind: 'adjustment';
      trackIndex: number;
      start: number;
      duration: number;
      clip: ExportClip;
    }
  | {
      kind: 'media';
      trackIndex: number;
      start: number;
      duration: number;
      label: string;
      xExpression: string;
      yExpression: string;
      blendMode: ClipBlendMode;
    };

export function buildVisualItems(
  timeline: ExportTimeline,
  orderedPlaybackClips: ExportClip[],
  playbackStartByClipId: Map<string, number>,
  renderableTrackIndexes: Set<number>,
  inputByClipId: Map<string, number>,
  customShaderSequenceClips: Map<string, ExportClip>,
  settings: ExportSettings,
  filters: string[],
  warnings: string[],
  textArtifacts: TextArtifact[],
  capabilities: FfmpegCapabilities | undefined,
): VisualItem[] {
  const consumedClipIds = new Set<string>();
  const items: VisualItem[] = [];

  for (const transition of timeline.transitions) {
    const pair = findExportTransitionPair(timeline, transition);
    if (!pair || !renderableTrackIndexes.has(pair.track.index)) {
      continue;
    }
    if (!isTransitionVisualClip(pair.fromClip) || !isTransitionVisualClip(pair.toClip)) {
      warnings.push(`Transition ${transition.id} was skipped because both clips must be visual media clips.`);
      continue;
    }
    if (consumedClipIds.has(pair.fromClip.id) || consumedClipIds.has(pair.toClip.id)) {
      warnings.push(
        `Transition ${transition.id} was skipped because chained transitions are not yet supported in one export segment.`,
      );
      continue;
    }
    const fromInput = inputByClipId.get(pair.fromClip.id);
    const toInput = inputByClipId.get(pair.toClip.id);
    if (fromInput === undefined || toInput === undefined) {
      warnings.push(`Transition ${transition.id} was skipped because one of its clips has no media input.`);
      continue;
    }
    const duration = clampExportTransitionDuration(transition, pair.fromClip, pair.toClip);
    if (duration <= 0) {
      continue;
    }
    const label = `xfade${safeLabel(transition.id)}`;
    const start = playbackStartByClipId.get(pair.fromClip.id) ?? pair.fromClip.start;
    const pairDuration = round(pair.fromClip.duration + pair.toClip.duration - duration);
    filters.push(
      buildTransitionClipFilter(
        fromInput,
        customShaderSequenceClips.get(pair.fromClip.id) ?? pair.fromClip,
        `${label}_from`,
        settings,
        textArtifacts,
        warnings,
        capabilities,
      ),
    );
    filters.push(
      buildTransitionClipFilter(
        toInput,
        customShaderSequenceClips.get(pair.toClip.id) ?? pair.toClip,
        `${label}_to`,
        settings,
        textArtifacts,
        warnings,
        capabilities,
      ),
    );
    filters.push(
      ...buildSmartTransitionFilters(
        transition,
        label,
        duration,
        Math.max(0, pair.fromClip.duration - duration),
        settings,
      ),
    );
    filters.push(`[${label}_raw]setpts=PTS-STARTPTS+${formatFfmpegSeconds(start)}/TB[${label}]`);
    items.push({
      kind: 'media',
      trackIndex: pair.track.index,
      start,
      duration: pairDuration,
      label,
      xExpression: '(main_w-overlay_w)/2+0',
      yExpression: '(main_h-overlay_h)/2+0',
      blendMode: normalizeClipBlendMode(pair.toClip.blendMode),
    });
    consumedClipIds.add(pair.fromClip.id);
    consumedClipIds.add(pair.toClip.id);
  }

  for (const clip of orderedPlaybackClips.filter(
    (item) =>
      item.type === 'video' ||
      item.type === 'image' ||
      item.type === 'text' ||
      item.type === 'credits' ||
      item.type === 'nested-sequence' ||
      item.type === 'adjustment' ||
      item.type === 'motion-graphic',
  )) {
    if (consumedClipIds.has(clip.id)) {
      continue;
    }
    if (clip.type === 'adjustment') {
      items.push({ kind: 'adjustment', trackIndex: clip.trackIndex, start: clip.start, duration: clip.duration, clip });
      continue;
    }
    if (clip.type === 'text') {
      items.push({ kind: 'text', trackIndex: clip.trackIndex, start: clip.start, duration: clip.duration, clip });
      continue;
    }
    if (clip.type === 'credits') {
      items.push({ kind: 'credits', trackIndex: clip.trackIndex, start: clip.start, duration: clip.duration, clip });
      continue;
    }

    const inputIndex = inputByClipId.get(clip.id);
    if (inputIndex === undefined) {
      warnings.push(`Clip ${clip.id} has no media path and was skipped.`);
      continue;
    }
    const clipLabel = `v${safeLabel(clip.id)}`;
    filters.push(
      buildVisualClipFilter(
        inputIndex,
        customShaderSequenceClips.get(clip.id) ?? clip,
        clipLabel,
        settings,
        textArtifacts,
        warnings,
        capabilities,
      ),
    );
    items.push({
      kind: 'media',
      trackIndex: clip.trackIndex,
      start: clip.start,
      duration: clip.duration,
      label: clipLabel,
      xExpression: buildOverlayXExpression(clip),
      yExpression: buildOverlayYExpression(clip),
      blendMode: normalizeClipBlendMode(clip.blendMode),
    });
  }

  return items.sort(
    (left, right) =>
      left.trackIndex - right.trackIndex || left.start - right.start || visualKindOrder(left) - visualKindOrder(right),
  );
}

export function buildPlaybackStartByClipId(timeline: ExportTimeline): Map<string, number> {
  const starts = new Map<string, number>();
  for (const track of timeline.tracks) {
    let transitionOffset = 0;
    const clips = [...track.clips].sort((left, right) => left.start - right.start || left.id.localeCompare(right.id));
    for (let index = 0; index < clips.length; index += 1) {
      const clip = clips[index];
      const previous = clips[index - 1];
      const transition = previous
        ? timeline.transitions.find((item) => item.fromClipId === previous.id && item.toClipId === clip.id)
        : undefined;
      if (previous && transition && areExportClipsAdjacent(previous, clip)) {
        transitionOffset = round(transitionOffset + clampExportTransitionDuration(transition, previous, clip));
      }
      starts.set(clip.id, round(clip.start - transitionOffset));
    }
  }
  return starts;
}

export function findExportTransitionPair(
  timeline: ExportTimeline,
  transition: ExportTransition,
): { track: ExportTrack; fromClip: ExportClip; toClip: ExportClip } | undefined {
  for (const track of timeline.tracks) {
    const clips = [...track.clips].sort((left, right) => left.start - right.start || left.id.localeCompare(right.id));
    const fromIndex = clips.findIndex((clip) => clip.id === transition.fromClipId);
    const toIndex = clips.findIndex((clip) => clip.id === transition.toClipId);
    if (fromIndex === -1 || toIndex !== fromIndex + 1) {
      continue;
    }
    const fromClip = clips[fromIndex];
    const toClip = clips[toIndex];
    if (!areExportClipsAdjacent(fromClip, toClip)) {
      continue;
    }
    return { track, fromClip, toClip };
  }
  return undefined;
}

export function buildTransitionClipFilter(
  inputIndex: number,
  clip: ExportClip,
  label: string,
  settings: ExportSettings,
  textArtifacts: TextArtifact[],
  warnings: string[],
  capabilities: FfmpegCapabilities | undefined,
): string {
  const sourceDuration = getExportClipSourceDuration(clip);
  const trim =
    clip.type === 'video' || clip.type === 'nested-sequence'
      ? `trim=start=0:duration=${formatFfmpegSeconds(sourceDuration)}`
      : `trim=duration=${formatFfmpegSeconds(sourceDuration)}`;
  const filters = [
    `[${inputIndex}:v]${trim}`,
    ...buildChromaKeyFilters(clip),
    buildSetptsFilter(clip, false, warnings),
    ...buildStabilizationFilters(clip),
    ...buildPanoramaProjectionFilters(clip),
    ...buildReframeFilters(settings),
    ...(isReframeEnabled(settings.targetAspectRatio)
      ? []
      : [
          `scale=${settings.width}:${settings.height}:force_original_aspect_ratio=decrease`,
          `pad=${settings.width}:${settings.height}:(ow-iw)/2:(oh-ih)/2:color=black`,
        ]),
    `fps=${settings.fps}`,
    ...buildSlowMotionFilters(clip, settings, capabilities, warnings),
    ...buildFrameInterpolationFilters(clip, capabilities, warnings),
    ...buildVideoRestorationFilters(clip),
    ...buildQualityEnhancementFilters(clip),
    'format=rgba',
  ];
  filters.push(...buildMaskFilters(clip));
  filters.push(...buildColorCorrectionFilters(clip, textArtifacts));
  filters.push(...buildEffectFilters(clip.effects, settings.fps));
  filters.push(`colorchannelmixer=aa=${formatOpacity(clip.transform.opacity)}[${label}]`);
  return filters.join(',');
}

export function isTransitionVisualClip(clip: ExportClip): boolean {
  return clip.type === 'video' || clip.type === 'image' || clip.type === 'nested-sequence';
}

export function areExportClipsAdjacent(fromClip: ExportClip, toClip: ExportClip): boolean {
  return Math.abs(fromClip.start + fromClip.duration - toClip.start) <= 0.001;
}

export function clampExportTransitionDuration(
  transition: ExportTransition,
  fromClip: ExportClip,
  toClip: ExportClip,
): number {
  return round(
    Math.min(
      normalizeTransitionDuration(transition.duration),
      Math.max(0, Math.min(fromClip.duration, toClip.duration) * 0.5),
    ),
  );
}

export function buildSmartTransitionFilters(
  transition: ExportTransition,
  label: string,
  duration: number,
  offset: number,
  settings: ExportSettings,
): string[] {
  const fromLabel = `${label}_from`;
  const toLabel = `${label}_to`;
  const rawLabel = `${label}_raw`;
  const durationArg = formatFfmpegSeconds(duration);
  const offsetArg = formatFfmpegSeconds(offset);
  if (transition.type === 'rotate') {
    const rotatedLabel = `${label}_rotate_from`;
    return [
      `[${fromLabel}]rotate='PI/10*t/${durationArg}':ow=iw:oh=ih:c=black@0,format=rgba[${rotatedLabel}]`,
      `[${rotatedLabel}][${toLabel}]xfade=transition=fade:duration=${durationArg}:offset=${offsetArg}[${rawLabel}]`,
    ];
  }
  if (transition.type === 'motion-blur-wipe') {
    const fromBlurLabel = `${label}_motion_from`;
    const toBlurLabel = `${label}_motion_to`;
    return [
      `[${fromLabel}]minterpolate=fps=${formatFfmpegNumber(settings.fps)},gblur=sigma=6:steps=2[${fromBlurLabel}]`,
      `[${toLabel}]minterpolate=fps=${formatFfmpegNumber(settings.fps)},gblur=sigma=6:steps=2[${toBlurLabel}]`,
      `[${fromBlurLabel}][${toBlurLabel}]xfade=transition=wipeleft:duration=${durationArg}:offset=${offsetArg}[${rawLabel}]`,
    ];
  }
  if (transition.type === 'shape-heart' || transition.type === 'shape-star') {
    const shapeLabel = `${label}_shape_to`;
    return [
      `[${toLabel}]format=rgba,geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='${buildShapeWipeGeqExpression(transition.type)}'[${shapeLabel}]`,
      `[${fromLabel}][${shapeLabel}]overlay=format=auto[${rawLabel}]`,
    ];
  }
  if (transition.type === 'light-leak') {
    const baseLabel = `${rawLabel}_base`;
    const leakLabel = `${rawLabel}_leak`;
    return [
      `[${fromLabel}][${toLabel}]xfade=transition=dissolve:duration=${durationArg}:offset=${offsetArg}[${baseLabel}]`,
      `color=c=white:s=${settings.width}x${settings.height}:d=${durationArg},format=rgba,geq=r='255*exp(-pow(X/W-0.5,2)*8)':g='200*exp(-pow(X/W-0.5,2)*8)':b='100*exp(-pow(X/W-0.5,2)*8)':a='128*exp(-pow(X/W-0.5,2)*8)'[${leakLabel}]`,
      `[${baseLabel}][${leakLabel}]overlay=format=auto:shortest=1[${rawLabel}]`,
    ];
  }
  if (transition.type === 'glitch') {
    const baseLabel = `${rawLabel}_base`;
    return [
      `[${fromLabel}][${toLabel}]xfade=transition=pixelize:duration=${durationArg}:offset=${offsetArg}[${baseLabel}]`,
      `[${baseLabel}]rgbashift=rh=-5:bh=5:gh=0,eq=contrast=1.3:saturation=1.2[${rawLabel}]`,
    ];
  }
  if (transition.type === 'flip-horizontal') {
    const flippedLabel = `${fromLabel}_flipped`;
    return [
      `[${fromLabel}]hflip[${flippedLabel}]`,
      `[${flippedLabel}][${toLabel}]xfade=transition=fade:duration=${durationArg}:offset=${offsetArg}[${rawLabel}]`,
    ];
  }
  if (transition.type === 'flip-vertical') {
    const flippedLabel = `${fromLabel}_flipped`;
    return [
      `[${fromLabel}]vflip[${flippedLabel}]`,
      `[${flippedLabel}][${toLabel}]xfade=transition=fade:duration=${durationArg}:offset=${offsetArg}[${rawLabel}]`,
    ];
  }
  if (transition.type === 'cube-rotate') {
    const rotatedLabel = `${fromLabel}_cube`;
    return [
      `[${fromLabel}]rotate='PI/4*t/${durationArg}':ow=iw:oh=ih:c=black@0,zoompan=z='1+0.2*on':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=iwxih,format=rgba[${rotatedLabel}]`,
      `[${rotatedLabel}][${toLabel}]xfade=transition=fade:duration=${durationArg}:offset=${offsetArg}[${rawLabel}]`,
    ];
  }
  if (transition.type === 'portal') {
    const baseLabel = `${rawLabel}_base`;
    return [
      `[${fromLabel}][${toLabel}]xfade=transition=circleopen:duration=${durationArg}:offset=${offsetArg}[${baseLabel}]`,
      `[${baseLabel}]zoompan=z='1+0.03*sin(2*PI*on)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=${settings.width}x${settings.height}[${rawLabel}]`,
    ];
  }
  return [
    `[${fromLabel}][${toLabel}]xfade=transition=${mapTransitionType(transition.type)}:duration=${durationArg}:offset=${offsetArg}[${rawLabel}]`,
  ];
}

export function mapTransitionType(type: ExportTransition['type']): string {
  switch (type) {
    case 'fade-black':
    case 'flash-black':
      return 'fadeblack';
    case 'wipe-left':
      return 'wipeleft';
    case 'wipe-right':
      return 'wiperight';
    case 'wipe-up':
      return 'wipeup';
    case 'wipe-down':
      return 'wipedown';
    case 'zoom-dissolve':
      return 'zoominzoomout';
    case 'flash-white':
      return 'fadewhite';
    case 'block':
      return 'pixelize';
    case 'film-roll-open':
      return 'horzopen';
    case 'film-roll-close':
      return 'horzclose';
    case 'motion-blur-wipe':
      return 'wipeleft';
    case 'rotate':
      return 'fade';
    case 'push-left':
      return 'slideleft';
    case 'push-right':
      return 'slideright';
    case 'push-up':
      return 'slideup';
    case 'push-down':
      return 'slidedown';
    case 'shape-heart':
    case 'shape-star':
    case 'light-leak':
    case 'glitch':
    case 'flip-horizontal':
    case 'flip-vertical':
    case 'cube-rotate':
    case 'portal':
      return 'custom';
    default:
      return 'dissolve';
  }
}

export function buildShapeWipeGeqExpression(
  type: Extract<ExportTransition['type'], 'shape-heart' | 'shape-star'>,
): string {
  if (type === 'shape-star') {
    return 'if(lte(abs(X-W/2)/(W/2)+abs(Y-H/2)/(H/2),0.82),255,0)';
  }
  return 'if(lte(pow((X-W/2)/(W/2),2)+pow((Y-H/2)/(H/2)-sqrt(abs((X-W/2)/(W/2))),2),1),255,0)';
}

export interface TransitionPreviewArgsOptions {
  width?: number;
  height?: number;
  fps?: number;
  duration?: number;
}

export function buildTransitionPreviewArgs(
  type: ExportTransition['type'],
  options: TransitionPreviewArgsOptions = {},
): string[] {
  const width = Math.max(16, Math.round(options.width ?? 160));
  const height = Math.max(16, Math.round(options.height ?? 90));
  const fps = Math.max(1, Math.round(options.fps ?? 30));
  const duration = formatFfmpegSeconds(normalizeTransitionDuration(options.duration));
  const offset = '0';
  const baseFilter =
    type === 'shape-heart' || type === 'shape-star'
      ? `[1:v]format=rgba,geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='${buildShapeWipeGeqExpression(type)}'[shape];[0:v][shape]overlay=format=auto,scale=${width}:${height}`
      : `[0:v][1:v]xfade=transition=${mapTransitionType(type)}:duration=${duration}:offset=${offset},scale=${width}:${height}`;
  return [
    '-f',
    'lavfi',
    '-i',
    `testsrc2=size=${width}x${height}:rate=${fps}:duration=${duration}`,
    '-f',
    'lavfi',
    '-i',
    `smptebars=size=${width}x${height}:rate=${fps}:duration=${duration}`,
    '-filter_complex',
    baseFilter,
    '-frames:v',
    '1',
    '-f',
    'image2pipe',
    'pipe:1',
  ];
}

export function visualKindOrder(item: VisualItem): number {
  if (item.kind === 'media') {
    return 0;
  }
  return item.kind === 'adjustment' ? 1 : 2;
}

export function buildMediaCompositeFilter(
  currentVideo: string,
  nextVideo: string,
  item: Extract<VisualItem, { kind: 'media' }>,
  settings: ExportSettings,
  duration: number,
): string {
  const start = formatFfmpegSeconds(item.start);
  const end = formatFfmpegSeconds(item.start + item.duration);
  const enable = `between(t,${start},${end})`;
  if (normalizeClipBlendMode(item.blendMode) === 'normal') {
    return `[${currentVideo}][${item.label}]overlay=x='${item.xExpression}':y='${item.yExpression}':eval=frame:enable='${enable}'[${nextVideo}]`;
  }
  const safe = safeLabel(`${nextVideo}_${item.label}`);
  const blankLabel = `${safe}_blend_blank`;
  const layerLabel = `${safe}_blend_layer`;
  const layerRgbLabel = `${safe}_blend_layer_rgb`;
  const layerAlphaSourceLabel = `${safe}_blend_layer_alpha_source`;
  const baseBlendLabel = `${safe}_blend_base`;
  const alphaLabel = `${safe}_blend_alpha`;
  const blendedLabel = `${safe}_blend_rgb`;
  const blendedRgbaLabel = `${safe}_blend_rgba`;
  const ffmpegMode = getFfmpegBlendMode(item.blendMode);
  return [
    `color=c=black@0.0:s=${settings.width}x${settings.height}:r=${settings.fps}:d=${formatFfmpegSeconds(duration)},format=rgba[${blankLabel}]`,
    `[${blankLabel}][${item.label}]overlay=x='${item.xExpression}':y='${item.yExpression}':eval=frame:enable='${enable}',format=rgba[${layerLabel}]`,
    `[${layerLabel}]split=2[${layerRgbLabel}][${layerAlphaSourceLabel}]`,
    `[${layerAlphaSourceLabel}]alphaextract[${alphaLabel}]`,
    `[${currentVideo}]format=rgba[${baseBlendLabel}]`,
    `[${layerRgbLabel}][${baseBlendLabel}]blend=all_mode=${ffmpegMode}:all_opacity=1,format=rgba[${blendedLabel}]`,
    `[${blendedLabel}][${alphaLabel}]alphamerge,format=rgba[${blendedRgbaLabel}]`,
    `[${currentVideo}][${blendedRgbaLabel}]overlay=x=0:y=0:eval=frame:enable='${enable}'[${nextVideo}]`,
  ].join(';');
}

export function buildAdjustmentLayerFilters(
  inputLabel: string,
  outputLabel: string,
  clip: ExportClip,
  textArtifacts: TextArtifact[],
  settings: ExportSettings,
): string[] {
  const processingFilters = [
    ...buildColorCorrectionFilters(clip, textArtifacts),
    ...buildEffectFilters(clip.effects, settings.fps),
  ];
  if (processingFilters.length === 0) {
    return [];
  }
  const safeClipId = safeLabel(clip.id);
  const baseLabel = `${outputLabel}_${safeClipId}_base`;
  const sourceLabel = `${outputLabel}_${safeClipId}_source`;
  const processedLabel = `${outputLabel}_${safeClipId}_processed`;
  return [
    `[${inputLabel}]split=2[${baseLabel}][${sourceLabel}]`,
    `[${sourceLabel}]${processingFilters.join(',')}[${processedLabel}]`,
    `[${baseLabel}][${processedLabel}]overlay=x=0:y=0:eval=frame:enable='between(t,${formatFfmpegSeconds(clip.start)},${formatFfmpegSeconds(clip.start + clip.duration)})'[${outputLabel}]`,
  ];
}

export function buildVisualClipFilter(
  inputIndex: number,
  clip: ExportClip,
  label: string,
  settings: ExportSettings,
  textArtifacts: TextArtifact[],
  warnings: string[],
  capabilities: FfmpegCapabilities | undefined,
): string {
  const sourceDuration = getExportClipSourceDuration(clip);
  const trim =
    clip.type === 'video' || clip.type === 'nested-sequence'
      ? `trim=start=0:duration=${formatFfmpegSeconds(sourceDuration)}`
      : `trim=duration=${formatFfmpegSeconds(sourceDuration)}`;
  const key = normalizeChromaKey(clip.chromaKey);
  if (isDifferenceMatteEnabled(key)) {
    return buildDifferenceMatteClipFilter(
      inputIndex,
      clip,
      label,
      settings,
      textArtifacts,
      warnings,
      capabilities,
      trim,
      key,
    );
  }
  if (hasPrivacyBlurMasks(clip)) {
    return buildPrivacyBlurClipFilter(inputIndex, clip, label, settings, textArtifacts, warnings, capabilities, trim);
  }
  if (clip.colorGradingGraph?.nodes?.length) {
    const gradingFilter = buildColorGradingGraphVisualFilter(
      inputIndex,
      clip,
      label,
      settings,
      textArtifacts,
      warnings,
      capabilities,
      trim,
    );
    if (gradingFilter) {
      return gradingFilter;
    }
  }
  if (clip.colorNodeGraph) {
    const graphFilter = buildColorNodeGraphVisualFilter(
      inputIndex,
      clip,
      label,
      settings,
      textArtifacts,
      warnings,
      capabilities,
      trim,
    );
    if (graphFilter) {
      return graphFilter;
    }
  }
  const filters = [`[${inputIndex}:v]${trim}`, ...buildChromaKeyFilters(clip)];
  filters.push(...buildVisualPostKeyFilters(clip, settings, textArtifacts, warnings, capabilities, label));
  const redactionExprs = buildPrivacyRedactionFFmpegExpressions(
    clip.privacyRedactions ?? [],
    settings.width,
    settings.height,
    'boxblur',
  );
  if (redactionExprs.length > 0) filters.push(...redactionExprs);
  return filters.join(',');
}

export function buildColorNodeGraphVisualFilter(
  inputIndex: number,
  clip: ExportClip,
  label: string,
  settings: ExportSettings,
  textArtifacts: TextArtifact[],
  warnings: string[],
  capabilities: FfmpegCapabilities | undefined,
  trim: string,
): string | null {
  const normalized = normalizeColorNodeGraph(clip.colorNodeGraph, clip.colorCorrection);
  const cycle = detectColorNodeGraphCycle(normalized);
  if (cycle) {
    warnings.push(
      `Color node graph for clip ${clip.id} contains a cycle (${cycle.join(' -> ')}); falling back to the legacy color correction chain.`,
    );
    return null;
  }
  const baseLabel = `${safeLabel(label)}_node_base`;
  const graphOutputLabel = `${safeLabel(label)}_node_graph_output`;
  const baseFilters = [
    `[${inputIndex}:v]${trim}`,
    ...buildChromaKeyFilters(clip),
    ...buildVisualPreColorFilters(clip, settings, warnings, capabilities),
  ];
  const graphFilters = buildColorNodeGraphFilterPlan(normalized, {
    inputLabel: baseLabel,
    outputLabel: graphOutputLabel,
    clipId: clip.id,
    mediaKind: 'video',
    escapeFilePath: escapeDrawtextValue,
    registerArtifact: (artifact) => {
      textArtifacts.push({
        clipId: `${clip.id}:${artifact.nodeId}`,
        text: artifact.text,
        fileName: artifact.fileName,
        placeholder: artifact.placeholder,
        pathMode: 'filter',
      });
      return artifact.placeholder;
    },
  }).filters;
  const postFilters = [
    `[${graphOutputLabel}]${buildVisualPostColorFilters(clip, settings, textArtifacts, label, false).join(',')}`,
  ];
  return [`${baseFilters.join(',')}[${baseLabel}]`, ...graphFilters, ...postFilters].join(',');
}

export function buildColorGradingGraphVisualFilter(
  inputIndex: number,
  clip: ExportClip,
  label: string,
  settings: ExportSettings,
  textArtifacts: TextArtifact[],
  warnings: string[],
  capabilities: FfmpegCapabilities | undefined,
  trim: string,
): string | null {
  const gradingFilters = buildColorGradingFilters(clip.colorGradingGraph);
  if (gradingFilters.length === 0) return null;

  const baseLabel = `${safeLabel(label)}_grading_base`;
  const gradingOutputLabel = `${safeLabel(label)}_grading_output`;
  const baseFilters = [
    `[${inputIndex}:v]${trim}`,
    ...buildChromaKeyFilters(clip),
    ...buildVisualPreColorFilters(clip, settings, warnings, capabilities),
  ];
  const gradingChain = gradingFilters.join(',');
  const postFilters = [
    `[${gradingOutputLabel}]${buildVisualPostColorFilters(clip, settings, textArtifacts, label, false).join(',')}`,
  ];
  return [
    `${baseFilters.join(',')}[${baseLabel}]`,
    `[${baseLabel}]${gradingChain}[${gradingOutputLabel}]`,
    ...postFilters,
  ].join(';');
}

export function buildVisualPreColorFilters(
  clip: ExportClip,
  settings: ExportSettings,
  warnings: string[],
  capabilities: FfmpegCapabilities | undefined,
): string[] {
  const filters: string[] = [];
  if (isKenBurnsAnimatedScaleClip(clip)) {
    filters.push(
      buildSetptsFilter(clip, false, warnings),
      buildKenBurnsZoompanFilter(clip, settings),
      'setsar=1',
      buildSetptsFilter(clip, true, warnings),
    );
  } else {
    filters.push(
      buildSetptsFilter(clip, true, warnings),
      ...buildStabilizationFilters(clip),
      ...buildPanoramaProjectionFilters(clip),
      ...buildReframeFilters(settings),
      buildScaleFilter(clip),
      'setsar=1',
    );
  }
  if (settings.scaleMode === 'fit' && !isReframeEnabled(settings.targetAspectRatio)) {
    filters.push(
      `scale=${settings.width}:${settings.height}:force_original_aspect_ratio=decrease`,
      `pad=${settings.width}:${settings.height}:(ow-iw)/2:(oh-ih)/2:color=black`,
    );
  }
  filters.push(...buildSlowMotionFilters(clip, settings, capabilities, warnings));
  filters.push(...buildFrameInterpolationFilters(clip, capabilities, warnings));
  filters.push(...buildVideoRestorationFilters(clip));
  filters.push(...buildQualityEnhancementFilters(clip));
  filters.push(...buildSourceColorSpaceConversionFilters(clip, settings));
  filters.push('format=rgba');
  filters.push(...buildMaskFilters(clip));
  return filters;
}

export function buildVisualPostColorFilters(
  clip: ExportClip,
  settings: ExportSettings,
  textArtifacts: TextArtifact[],
  label: string,
  includeColorCorrection = true,
): string[] {
  const filters: string[] = [];
  if (includeColorCorrection) {
    filters.push(...buildColorCorrectionFilters(clip, textArtifacts));
  }
  filters.push(...buildEffectFilters(clip.effects, settings.fps));
  filters.push(...buildClipBorderFilters(clip));
  if (Math.abs(clip.transform.rotation) > 0.001) {
    filters.push(`rotate=${formatFfmpegNumber(clip.transform.rotation)}*PI/180:c=none`);
  }
  filters.push(...buildOpacityFilters(clip, label));
  return filters;
}

export function buildVisualPostKeyFilters(
  clip: ExportClip,
  settings: ExportSettings,
  textArtifacts: TextArtifact[],
  warnings: string[],
  capabilities: FfmpegCapabilities | undefined,
  label: string,
): string[] {
  const filters: string[] = [];
  if (isKenBurnsAnimatedScaleClip(clip)) {
    filters.push(
      buildSetptsFilter(clip, false, warnings),
      buildKenBurnsZoompanFilter(clip, settings),
      'setsar=1',
      buildSetptsFilter(clip, true, warnings),
    );
  } else {
    filters.push(
      buildSetptsFilter(clip, true, warnings),
      ...buildStabilizationFilters(clip),
      ...buildPanoramaProjectionFilters(clip),
      ...buildReframeFilters(settings),
      buildScaleFilter(clip),
      'setsar=1',
    );
  }
  if (settings.scaleMode === 'fit' && !isReframeEnabled(settings.targetAspectRatio)) {
    filters.push(
      `scale=${settings.width}:${settings.height}:force_original_aspect_ratio=decrease`,
      `pad=${settings.width}:${settings.height}:(ow-iw)/2:(oh-ih)/2:color=black`,
    );
  }
  filters.push(...buildSlowMotionFilters(clip, settings, capabilities, warnings));
  filters.push(...buildFrameInterpolationFilters(clip, capabilities, warnings));
  filters.push(...buildVideoRestorationFilters(clip));
  filters.push(...buildQualityEnhancementFilters(clip));
  filters.push(...buildSourceColorSpaceConversionFilters(clip, settings));
  filters.push('format=rgba');
  filters.push(...buildMaskFilters(clip));
  filters.push(...buildColorCorrectionFilters(clip, textArtifacts));
  filters.push(...buildEffectFilters(clip.effects, settings.fps));
  filters.push(...buildClipBorderFilters(clip));
  if (Math.abs(clip.transform.rotation) > 0.001) {
    filters.push(`rotate=${formatFfmpegNumber(clip.transform.rotation)}*PI/180:c=none`);
  }
  filters.push(...buildOpacityFilters(clip, label));
  return filters;
}

export function buildPanoramaProjectionFilters(clip: ExportClip): string[] {
  if (clip.projection === 'flat') {
    return [];
  }
  const panorama = normalizeClipPanoramaView(clip.panorama);
  if (clip.projection === 'equirectangular' && panorama.outputProjection === 'equirectangular') {
    return [];
  }
  const inputProjection = clip.projection === 'cubemap' ? 'c3x2' : 'e';
  const outputProjection = panorama.outputProjection === 'equirectangular' ? 'e' : 'flat';
  const args = [
    inputProjection,
    outputProjection,
    `yaw=${formatFfmpegNumber(panorama.yaw)}`,
    `pitch=${formatFfmpegNumber(panorama.pitch)}`,
    `roll=${formatFfmpegNumber(panorama.roll)}`,
    `v_fov=${formatFfmpegNumber(panorama.fov)}`,
  ];
  return [`v360=${args.join(':')}`];
}

export function hasSphericalVideoClips(clips: ExportClip[]): boolean {
  return clips.some((clip) => (clip.type === 'video' || clip.type === 'nested-sequence') && clip.projection !== 'flat');
}

export function buildDifferenceMatteClipFilter(
  inputIndex: number,
  clip: ExportClip,
  label: string,
  settings: ExportSettings,
  textArtifacts: TextArtifact[],
  warnings: string[],
  capabilities: FfmpegCapabilities | undefined,
  trim: string,
  key: ReturnType<typeof normalizeChromaKey>,
): string {
  const safe = safeLabel(label);
  const mainSourceLabel = `${safe}_diff_main_src`;
  const referenceSourceLabel = `${safe}_diff_ref_src`;
  const mainLabel = `${safe}_diff_main`;
  const mainBlendLabel = `${safe}_diff_main_blend`;
  const mainAlphaLabel = `${safe}_diff_main_alpha`;
  const referenceLabel = `${safe}_diff_ref`;
  const matteLabel = `${safe}_diff_matte`;
  const frameDuration = 1 / Math.max(1, settings.fps);
  const referenceTime = formatFfmpegSeconds(key.differenceReferenceTime);
  const threshold = Math.round(key.differenceThreshold * 255);
  return [
    `[${inputIndex}:v]${trim},split=2[${mainSourceLabel}][${referenceSourceLabel}]`,
    `[${mainSourceLabel}]${buildVisualPostKeyFilters(clip, settings, textArtifacts, warnings, capabilities, mainLabel).join(',')}`,
    `[${mainLabel}]split=2[${mainBlendLabel}][${mainAlphaLabel}]`,
    `[${referenceSourceLabel}]trim=start=${referenceTime}:duration=${formatFfmpegSeconds(frameDuration)},setpts=PTS-STARTPTS,loop=loop=-1:size=1:start=0,${buildVisualPostKeyFilters(
      clip,
      settings,
      textArtifacts,
      warnings,
      capabilities,
      referenceLabel,
    ).join(',')}`,
    `[${mainBlendLabel}][${referenceLabel}]blend=all_mode=difference,format=gray,lutyuv=y='if(gt(val,${threshold}),255,0)'[${matteLabel}]`,
    `[${mainAlphaLabel}][${matteLabel}]alphamerge,colorchannelmixer=aa=${formatOpacity(clip.transform.opacity)}[${label}]`,
  ].join(';');
}

export function buildPrivacyBlurClipFilter(
  inputIndex: number,
  clip: ExportClip,
  label: string,
  settings: ExportSettings,
  textArtifacts: TextArtifact[],
  warnings: string[],
  capabilities: FfmpegCapabilities | undefined,
  trim: string,
): string {
  const sourceLabel = `${safeLabel(label)}_privacy_src`;
  const filters = [
    `[${inputIndex}:v]${trim}`,
    ...buildChromaKeyFilters(clip),
    ...buildVisualPostKeyFilters(clip, settings, textArtifacts, warnings, capabilities, sourceLabel),
  ];
  const graph = [filters.join(',')];
  let currentLabel = sourceLabel;
  getPrivacyBlurMasks(clip).forEach((mask, index) => {
    const outputLabel = index === getPrivacyBlurMasks(clip).length - 1 ? label : `${safeLabel(label)}_privacy_${index}`;
    graph.push(...buildPrivacyBlurMaskGraph(currentLabel, outputLabel, mask, index));
    currentLabel = outputLabel;
  });
  return graph.join(';');
}

export function buildPrivacyBlurMaskGraph(
  inputLabel: string,
  outputLabel: string,
  mask: ExportClip['masks'][number],
  index: number,
): string[] {
  const safe = `${safeLabel(inputLabel)}_${safeLabel(mask.id)}_${index}`;
  const baseLabel = `${safe}_base`;
  const cropSourceLabel = `${safe}_crop_src`;
  const regionLabel = `${safe}_region`;
  const x = buildMaskTimelineExpression(mask, 'x');
  const y = buildMaskTimelineExpression(mask, 'y');
  const w = buildMaskTimelineExpression(mask, 'w');
  const h = buildMaskTimelineExpression(mask, 'h');
  return [
    `[${inputLabel}]split=2[${baseLabel}][${cropSourceLabel}]`,
    `[${cropSourceLabel}]crop=w='iw*${w}':h='ih*${h}':x='iw*${x}':y='ih*${y}':eval=frame,${buildPrivacyBlurEffectFilter(mask)}[${regionLabel}]`,
    `[${baseLabel}][${regionLabel}]overlay=x='main_w*${x}':y='main_h*${y}':eval=frame[${outputLabel}]`,
  ];
}

export function buildPrivacyBlurEffectFilter(mask: ExportClip['masks'][number]): string {
  const blur = mask.privacyBlur;
  if (blur?.effect === 'solid') {
    return `drawbox=x=0:y=0:w=iw:h=ih:color=${cssColorToFfmpeg(blur.color ?? '#000000')}:t=fill`;
  }
  if (blur?.effect === 'gblur') {
    return 'gblur=sigma=18';
  }
  return 'pixelize=width=16:height=16';
}

export function buildMaskTimelineExpression(
  mask: ExportClip['masks'][number],
  property: 'x' | 'y' | 'w' | 'h',
): string {
  const frames = mask.keyframes ?? [];
  if (frames.length === 0) {
    return formatFfmpegNumber(property === 'w' || property === 'h' ? Math.max(0.001, mask[property]) : mask[property]);
  }
  const sorted = [...frames].sort((left, right) => left.time - right.time);
  let expression = formatFfmpegNumber(sorted.at(-1)?.[property] ?? mask[property]);
  for (let index = sorted.length - 2; index >= 0; index -= 1) {
    const left = sorted[index];
    const right = sorted[index + 1];
    const leftValue = formatFfmpegNumber(left[property]);
    const rightValue = formatFfmpegNumber(right[property]);
    const start = formatFfmpegSeconds(left.time);
    const duration = formatFfmpegSeconds(Math.max(0.001, right.time - left.time));
    const interpolated = `${leftValue}+(${rightValue}-${leftValue})*((t-${start})/${duration})`;
    expression = `if(lte(t,${formatFfmpegSeconds(right.time)}),${interpolated},${expression})`;
  }
  const first = sorted[0];
  return `if(lt(t,${formatFfmpegSeconds(first.time)}),${formatFfmpegNumber(first[property])},${expression})`;
}

export function hasPrivacyBlurMasks(clip: ExportClip): boolean {
  return getPrivacyBlurMasks(clip).length > 0;
}

export function getPrivacyBlurMasks(clip: ExportClip): ExportClip['masks'] {
  return clip.masks.filter((mask) => mask.enabled && mask.privacyBlur?.enabled === true);
}

export function isKenBurnsAnimatedScaleClip(clip: ExportClip): boolean {
  return (
    clip.type === 'image' &&
    clip.kenBurns &&
    (getAnimatedFrames(clip, 'scaleX').length >= 2 || getAnimatedFrames(clip, 'scaleY').length >= 2)
  );
}

export function buildReframeFilters(settings: ExportSettings): string[] {
  const crop = buildReframeCropFilter(settings);
  if (!crop) {
    return [];
  }
  return [crop, `scale=${settings.width}:${settings.height}`];
}

export function buildChromaKeyFilters(clip: ExportClip): string[] {
  const key = normalizeChromaKey(clip.chromaKey);
  if (!key.enabled) {
    return [];
  }
  if (key.mode === 'luma-key') {
    return [
      `lumakey=threshold=${formatFfmpegNumber(key.lumaThreshold)}:tolerance=${formatFfmpegNumber(key.lumaTolerance)}:softness=${formatFfmpegNumber(key.lumaSoftness)}`,
    ];
  }
  if (key.mode === 'difference-matte') {
    return [];
  }
  const filters = key.colors.map(
    (color) =>
      `chromakey=color=0x${formatChromaKeyColor(color)}:similarity=${formatFfmpegNumber(key.similarity)}:blend=${formatFfmpegNumber(key.blend)}`,
  );
  const erosion = Math.round(key.erosion);
  const edgeFilter = erosion > 0 ? 'erosion=coordinates=255' : erosion < 0 ? 'dilation=coordinates=255' : undefined;
  if (edgeFilter) {
    filters.push(...Array.from({ length: Math.abs(erosion) }, () => edgeFilter));
  }
  if (key.spillSuppression) {
    filters.push('hue=s=0');
  }
  return filters;
}

export function isDifferenceMatteEnabled(key: ReturnType<typeof normalizeChromaKey>): boolean {
  return key.enabled && key.mode === 'difference-matte';
}

export function formatChromaKeyColor(color: [number, number, number]): string {
  return color
    .map((channel) => Math.round(channel).toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
}

export function buildStabilizationFilters(clip: ExportClip): string[] {
  if (!isStabilizationExportable(clip.stabilization)) {
    return [];
  }
  const trfPath = clip.stabilization.trfPath ?? '';
  return [
    `vidstabtransform=smoothing=${formatFfmpegNumber(clip.stabilization.smoothing)}:zoom=${formatFfmpegNumber(clip.stabilization.zoom)}:input=${escapeDrawtextValue(
      trfPath,
    )}`,
  ];
}

export function buildSlowMotionFilters(
  clip: ExportClip,
  settings: ExportSettings,
  capabilities: FfmpegCapabilities | undefined,
  warnings: string[],
): string[] {
  if (clip.type !== 'video' && clip.type !== 'nested-sequence') {
    return [];
  }
  const mode = normalizeSlowMotionMode(clip.slowMotionMode);
  if (mode === 'none' || getMinimumClipSpeed(clip) >= 1) {
    return [];
  }
  const fps = Math.max(1, Math.round(settings.fps));
  if (mode === 'optical-flow' && capabilities?.hasMinterpolate === false) {
    warnings.push(
      `Optical flow slow motion for clip ${clip.id} fell back to blend because the current FFmpeg build did not report minterpolate support.`,
    );
    return [`minterpolate=fps=${fps}:mi_mode=blend`];
  }
  if (capabilities?.hasMinterpolate === false) {
    warnings.push(
      `Slow motion interpolation for clip ${clip.id} was skipped because the current FFmpeg build does not support minterpolate.`,
    );
    return [];
  }
  if (mode === 'blend') {
    return [`minterpolate=fps=${fps}:mi_mode=blend`];
  }
  if (mode === 'mci') {
    return [`minterpolate=fps=${fps}:mi_mode=mci:mc_mode=aobmc`];
  }
  return [`minterpolate=fps=${fps}:mi_mode=mci:mc_mode=aobmc:vsbmc=1`];
}

export function buildFrameInterpolationFilters(
  clip: ExportClip,
  capabilities: FfmpegCapabilities | undefined,
  warnings: string[],
): string[] {
  if (!clip.frameInterpolation.enabled || (clip.type !== 'video' && clip.type !== 'nested-sequence')) {
    return [];
  }
  const mode = resolveFrameInterpolationMode(clip.frameInterpolation.mode, averageClipMotionScore(clip));
  if (mode === 'copy') {
    return [`fps=fps=${clip.frameInterpolation.targetFps}:round=near`];
  }
  if (capabilities?.hasMinterpolate === false) {
    warnings.push(
      `Frame interpolation for clip ${clip.id} was skipped because the current FFmpeg build does not support minterpolate.`,
    );
    return [];
  }
  const sceneRanges = buildSceneBoundaryProtectionRanges(
    clip.scenecuts,
    clip.frameInterpolation.targetFps,
    clip.duration,
    clip.frameInterpolation.protectionFrames,
  );
  if (sceneRanges.length > 0) {
    warnings.push(`Frame interpolation for clip ${clip.id} protects ${sceneRanges.length} scene boundary range(s).`);
  }
  if (mode === 'blend') {
    return [buildFrameInterpolationFilterArg(clip.frameInterpolation.targetFps, 'blend', sceneRanges.length > 0)];
  }
  return [buildFrameInterpolationFilterArg(clip.frameInterpolation.targetFps, 'mci', sceneRanges.length > 0)];
}

export function buildFrameInterpolationFilterArg(fps: number, mode: 'blend' | 'mci', sceneProtected: boolean): string {
  const sceneDetection = sceneProtected ? ':scd=fdiff' : '';
  if (mode === 'blend') {
    return `minterpolate=fps=${fps}:mi_mode=blend${sceneDetection}`;
  }
  return `minterpolate=fps=${fps}:mi_mode=mci:mc_mode=aobmc${sceneDetection}`;
}

export function buildVideoRestorationFilters(clip: ExportClip): string[] {
  if (clip.type !== 'video' && clip.type !== 'nested-sequence') {
    return [];
  }
  const restoration = normalizeVideoRestoration(clip.videoRestoration);
  const filters: string[] = [];
  if (restoration.deinterlace.enabled) {
    filters.push(`yadif=mode=${restoration.deinterlace.mode}`);
  }
  if (restoration.temporalDenoise.preset !== 'off') {
    filters.push(
      `hqdn3d=luma_spatial=${formatFfmpegNumber(restoration.temporalDenoise.lumaSpatial)}:chroma_spatial=${formatFfmpegNumber(
        restoration.temporalDenoise.chromaSpatial,
      )}:luma_tmp=${formatFfmpegNumber(restoration.temporalDenoise.lumaTmp)}`,
    );
  }
  if (restoration.spatialDenoise.enabled) {
    filters.push(
      `nlmeans=s=${formatFfmpegNumber(restoration.spatialDenoise.strength)}:p=${Math.round(restoration.spatialDenoise.patchSize)}:r=${Math.round(
        restoration.spatialDenoise.researchSize,
      )}`,
    );
  }
  return filters;
}

export function buildQualityEnhancementFilters(clip: ExportClip): string[] {
  if (clip.type !== 'video' && clip.type !== 'nested-sequence') {
    return [];
  }
  const enhancement = normalizeQualityEnhancement(clip.qualityEnhancement);
  const filters: string[] = [];
  if (enhancement.superResolution) {
    filters.push('scale=iw*2:ih*2:flags=lanczos', 'unsharp=luma_msize_x=3:luma_amount=0.5');
  }
  if (enhancement.deblock) {
    filters.push('deblock=filter=strong:block=4');
  }
  if (enhancement.colorBoost) {
    filters.push('hue=s=1.2', 'colorlevels');
  }
  if (enhancement.frameCompensation) {
    filters.push('minterpolate=fps=60:mi_mode=blend');
  }
  return filters;
}

export function getMinimumClipSpeed(clip: ExportClip): number {
  const frames = getAnimatedFrames(clip, 'speed');
  if (frames.length === 0) {
    return clip.speed;
  }
  return Math.min(clip.speed, ...frames.map((frame) => frame.value));
}

export function buildMaskFilters(clip: ExportClip): string[] {
  const masks = clip.masks.filter((mask) => mask.enabled && mask.privacyBlur?.enabled !== true);
  if (masks.length === 0) {
    return [];
  }
  if (masks.length === 1 && isSimpleRectMask(masks[0])) {
    return [buildSimpleRectMaskFilter(masks[0])];
  }
  return [buildGeqMaskFilter(masks)];
}

export function buildClipBorderFilters(clip: ExportClip): string[] {
  const border = normalizeClipBorder(clip.border);
  if (!border.enabled) {
    return [];
  }
  return [`drawbox=x=0:y=0:w=iw:h=ih:color=${cssColorToFfmpeg(border.color)}:t=${border.width}`];
}

export function isSimpleRectMask(mask: ExportClip['masks'][number]): boolean {
  return mask.type === 'rect' && !mask.inverted && mask.feather <= 0.001;
}

export function buildSimpleRectMaskFilter(mask: ExportClip['masks'][number]): string {
  const x = formatFfmpegNumber(mask.x);
  const y = formatFfmpegNumber(mask.y);
  const w = formatFfmpegNumber(Math.max(0.001, mask.w));
  const h = formatFfmpegNumber(Math.max(0.001, mask.h));
  return `crop=w='iw*${w}':h='ih*${h}':x='iw*${x}':y='ih*${y}',pad=w='iw/${w}':h='ih/${h}':x='ow*${x}':y='oh*${y}':color=black@0`;
}

export function buildGeqMaskFilter(masks: ExportClip['masks']): string {
  const expression = masks.map((mask) => {
    const inside =
      mask.type === 'path'
        ? buildPathMaskExpression(mask)
        : mask.type === 'ellipse'
          ? buildEllipseMaskExpression(mask)
          : buildRectMaskExpression(mask);
    return mask.inverted ? `(1-(${inside}))` : `(${inside})`;
  });
  return `geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='alpha(X,Y)*(${expression.join('*')})'`;
}

export function buildRectMaskExpression(mask: ExportClip['masks'][number]): string {
  const x1 = formatFfmpegNumber(mask.x);
  const y1 = formatFfmpegNumber(mask.y);
  const x2 = formatFfmpegNumber(Math.min(1, mask.x + mask.w));
  const y2 = formatFfmpegNumber(Math.min(1, mask.y + mask.h));
  return `between(X,iw*${x1},iw*${x2})*between(Y,ih*${y1},ih*${y2})`;
}

export function buildEllipseMaskExpression(mask: ExportClip['masks'][number]): string {
  const centerX = formatFfmpegNumber(Math.min(1, mask.x + mask.w / 2));
  const centerY = formatFfmpegNumber(Math.min(1, mask.y + mask.h / 2));
  const radiusX = formatFfmpegNumber(Math.max(0.001, mask.w / 2));
  const radiusY = formatFfmpegNumber(Math.max(0.001, mask.h / 2));
  return `lte(pow((X-(iw*${centerX}))/max(iw*${radiusX},1),2)+pow((Y-(ih*${centerY}))/max(ih*${radiusY},1),2),1)`;
}

export function buildPathMaskExpression(mask: ExportClip['masks'][number]): string {
  const mesh = triangulatePathMask(mask.path);
  if (mesh.indices.length < 3) {
    return '1';
  }
  const triangles: string[] = [];
  for (let index = 0; index < mesh.indices.length; index += 3) {
    const a = getPathVertex(mesh.vertices, mesh.indices[index]);
    const b = getPathVertex(mesh.vertices, mesh.indices[index + 1]);
    const c = getPathVertex(mesh.vertices, mesh.indices[index + 2]);
    triangles.push(buildPathTriangleExpression(a, b, c));
  }
  return triangles.reduce((expression, triangle) => (expression ? `max(${expression},${triangle})` : triangle), '');
}

export function getPathVertex(vertices: number[], index: number): { x: number; y: number } {
  return {
    x: vertices[index * 2] ?? 0,
    y: vertices[index * 2 + 1] ?? 0,
  };
}

export function buildPathTriangleExpression(
  a: { x: number; y: number },
  b: { x: number; y: number },
  c: { x: number; y: number },
): string {
  const area = triangleArea(a, b, c);
  const edges =
    area >= 0
      ? [
          buildPathEdgeExpression(a, b, 'gte'),
          buildPathEdgeExpression(b, c, 'gte'),
          buildPathEdgeExpression(c, a, 'gte'),
        ]
      : [
          buildPathEdgeExpression(a, b, 'lte'),
          buildPathEdgeExpression(b, c, 'lte'),
          buildPathEdgeExpression(c, a, 'lte'),
        ];
  return `(${edges.join('*')})`;
}

export function buildPathEdgeExpression(
  from: { x: number; y: number },
  to: { x: number; y: number },
  comparator: 'gte' | 'lte',
): string {
  const dx = formatFfmpegNumber(to.x - from.x);
  const dy = formatFfmpegNumber(to.y - from.y);
  const x = formatFfmpegNumber(from.x);
  const y = formatFfmpegNumber(from.y);
  return `${comparator}(${dx}*(Y/ih-${y})-${dy}*(X/iw-${x}),0)`;
}

export function triangleArea(
  a: { x: number; y: number },
  b: { x: number; y: number },
  c: { x: number; y: number },
): number {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

export function buildSetptsFilter(clip: ExportClip, includeStartOffset: boolean, warnings?: string[]): string {
  if (clip.type !== 'image' && getAnimatedFrames(clip, 'speed').length > 0) {
    const expression = buildSpeedRampSetptsExpression(clip, includeStartOffset);
    const filter = `setpts='${expression}'`;
    if (filter.length <= SETPTS_EXPRESSION_LIMIT) {
      return filter;
    }
    warnings?.push(`Speed ramp setpts for clip ${clip.id} exceeded 4096 characters and fell back to average speed.`);
    return buildStaticSetptsFilter(clip, includeStartOffset, getAverageClipSpeed(clip));
  }
  return buildStaticSetptsFilter(clip, includeStartOffset, clip.speed);
}

export function buildStaticSetptsFilter(clip: ExportClip, includeStartOffset: boolean, speed: number): string {
  const startOffset = `${formatFfmpegSeconds(clip.start)}/TB`;
  const playbackSpeed = getClipSpeed({ speed });
  if (Math.abs(playbackSpeed - 1) < 0.001 || clip.type === 'image') {
    return includeStartOffset ? `setpts=PTS-STARTPTS+${startOffset}` : 'setpts=PTS-STARTPTS';
  }
  return includeStartOffset
    ? `setpts=(PTS-STARTPTS)/${formatFfmpegSeconds(playbackSpeed)}+${startOffset}`
    : `setpts=(PTS-STARTPTS)/${formatFfmpegSeconds(playbackSpeed)}`;
}

export function buildSpeedRampSetptsExpression(clip: ExportClip, includeStartOffset: boolean): string {
  const sourceTime = '((PTS-STARTPTS)*TB)';
  const segments = buildSpeedRampSegments(clip);
  let secondsExpression = formatFfmpegSeconds(clip.duration);
  for (let index = segments.length - 1; index >= 0; index -= 1) {
    const segment = segments[index];
    const localExpression = `${formatFfmpegSeconds(segment.displayStart)}+(${sourceTime}-${formatFfmpegSeconds(segment.sourceStart)})/${formatFfmpegSeconds(segment.speed)}`;
    secondsExpression = `if(lte(${sourceTime},${formatFfmpegSeconds(segment.sourceEnd)}),${localExpression},${secondsExpression})`;
  }
  const startOffset = includeStartOffset ? `+${formatFfmpegSeconds(clip.start)}/TB` : '';
  return `(${secondsExpression})/TB${startOffset}`;
}

export function buildSpeedRampSegments(
  clip: ExportClip,
): Array<{ displayStart: number; displayEnd: number; sourceStart: number; sourceEnd: number; speed: number }> {
  const duration = Math.max(0, clip.duration);
  const frames = getAnimatedFrames(clip, 'speed');
  if (duration <= 0 || frames.length === 0) {
    return [];
  }

  const points = [...frames];
  if (points[0].time > 0.000001) {
    points.unshift({ id: `${clip.id}-speed-start`, time: 0, value: clip.speed, easing: 'linear' });
  } else {
    points[0] = { ...points[0], time: 0 };
  }
  const lastPoint = points[points.length - 1];
  if (lastPoint.time < duration - 0.000001) {
    points.push({ ...lastPoint, id: `${clip.id}-speed-end`, time: duration });
  } else {
    points[points.length - 1] = { ...lastPoint, time: duration };
  }

  let sourceStart = 0;
  const segments: Array<{
    displayStart: number;
    displayEnd: number;
    sourceStart: number;
    sourceEnd: number;
    speed: number;
  }> = [];
  for (let index = 0; index < points.length - 1; index += 1) {
    const left = points[index];
    const right = points[index + 1];
    const displayStart = Math.max(0, Math.min(duration, left.time));
    const displayEnd = Math.max(0, Math.min(duration, right.time));
    const displayDuration = displayEnd - displayStart;
    if (displayDuration <= 0.000001) {
      continue;
    }
    const localSpeedFrames = {
      speed: [
        { ...left, time: 0 },
        { ...right, time: displayDuration },
      ],
    };
    const sourceDuration = calculateSpeedCurveSourceDuration(displayDuration, localSpeedFrames, left.value);
    const segmentSpeed = Math.max(0.001, sourceDuration / displayDuration);
    const sourceEnd = round(sourceStart + sourceDuration);
    segments.push({
      displayStart,
      displayEnd,
      sourceStart,
      sourceEnd,
      speed: segmentSpeed,
    });
    sourceStart = sourceEnd;
  }
  return segments;
}

export function getAverageClipSpeed(clip: ExportClip): number {
  if (clip.duration <= 0.000001) {
    return clip.speed;
  }
  return getClipSpeed({ speed: clip.sourceDuration / clip.duration });
}

export function buildScaleFilter(clip: ExportClip): string {
  const scaleX = getAnimatedFrames(clip, 'scaleX');
  const scaleY = getAnimatedFrames(clip, 'scaleY');
  if (scaleX.length >= 2 || scaleY.length >= 2) {
    const xExpression = buildTimelineExpression(scaleX, clip.start, clip.transform.scaleX ?? clip.transform.scale);
    const yExpression = buildTimelineExpression(scaleY, clip.start, clip.transform.scaleY ?? clip.transform.scale);
    return `scale=w='trunc(iw*(${xExpression})/2)*2':h='trunc(ih*(${yExpression})/2)*2':eval=frame`;
  }
  const staticScaleX = scaleX.length === 1 ? scaleX[0].value : (clip.transform.scaleX ?? clip.transform.scale);
  const staticScaleY = scaleY.length === 1 ? scaleY[0].value : (clip.transform.scaleY ?? clip.transform.scale);
  return `scale=trunc(iw*${formatScale(staticScaleX)}/2)*2:trunc(ih*${formatScale(staticScaleY)}/2)*2`;
}

export function buildKenBurnsZoompanFilter(clip: ExportClip, settings: ExportSettings): string {
  const scaleX = getAnimatedFrames(clip, 'scaleX');
  const scaleY = getAnimatedFrames(clip, 'scaleY');
  const zoomFrames = scaleX.length >= 2 ? scaleX : scaleY;
  const zoomExpression = buildTimelineExpression(zoomFrames, 0, clip.transform.scaleX ?? clip.transform.scale, 'ot');
  return `zoompan=z='${zoomExpression}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=2:s=${settings.width}x${settings.height}:fps=${settings.fps}`;
}

export function buildOpacityFilters(clip: ExportClip, label: string): string[] {
  const frames = getAnimatedFrames(clip, 'opacity');
  if (frames.length === 0) {
    return [`colorchannelmixer=aa=${formatOpacity(clip.transform.opacity)}[${label}]`];
  }
  if (frames.length === 1) {
    return [`colorchannelmixer=aa=${formatOpacity(frames[0].value)}[${label}]`];
  }
  if (frames.length === 2) {
    const [first, second] = frames;
    const duration = Math.max(0.001, second.time - first.time);
    const start = clip.start + first.time;
    if (first.value <= 0.001 && second.value >= 0.999) {
      return [
        `colorchannelmixer=aa=1`,
        `fade=t=in:st=${formatFfmpegSeconds(start)}:d=${formatFfmpegSeconds(duration)}:alpha=1[${label}]`,
      ];
    }
    if (first.value >= 0.999 && second.value <= 0.001) {
      return [
        `colorchannelmixer=aa=1`,
        `fade=t=out:st=${formatFfmpegSeconds(start)}:d=${formatFfmpegSeconds(duration)}:alpha=1[${label}]`,
      ];
    }
  }
  const expression = buildTimelineExpression(frames, clip.start, clip.transform.opacity, 'T');
  return [`geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='alpha(X,Y)*(${expression})'[${label}]`];
}

export function buildOverlayXExpression(clip: ExportClip): string {
  const frames = getAnimatedFrames(clip, 'x');
  if (frames.length >= 2) {
    return `main_w/2-overlay_w/2+(main_w/2)*(${buildTimelineExpression(frames, clip.start, 0)})`;
  }
  if (frames.length === 1) {
    return `main_w/2-overlay_w/2+(main_w/2)*${formatFfmpegNumber(frames[0].value)}`;
  }
  return `(main_w-overlay_w)/2${formatOffsetExpression(clip.transform.x)}`;
}

export function buildOverlayYExpression(clip: ExportClip): string {
  const frames = getAnimatedFrames(clip, 'y');
  if (frames.length >= 2) {
    return `main_h/2-overlay_h/2+(main_h/2)*(${buildTimelineExpression(frames, clip.start, 0)})`;
  }
  if (frames.length === 1) {
    return `main_h/2-overlay_h/2+(main_h/2)*${formatFfmpegNumber(frames[0].value)}`;
  }
  return `(main_h-overlay_h)/2${formatOffsetExpression(clip.transform.y)}`;
}

export function buildColorCorrectionFilters(clip: ExportClip, textArtifacts: TextArtifact[]): string[] {
  const colorCorrection = normalizeColorCorrection(clip.colorCorrection);
  if (isDefaultColorCorrection(colorCorrection)) {
    return [];
  }
  const filters: string[] = [];
  const inputColorSpace = colorCorrection.inputColorSpace ?? DEFAULT_COLOR_CORRECTION.inputColorSpace ?? 'rec709';
  if (isLogInputColorSpace(inputColorSpace)) {
    const lut = getLogToRec709Lut(inputColorSpace);
    if (lut) {
      const safeClipId = safeLabel(clip.id);
      const placeholder = `__LOG_LUT_${safeLabel(inputColorSpace)}_${safeClipId}__`;
      textArtifacts.push({
        clipId: `${clip.id}:input-color-space`,
        text: serializeLogToRec709Cube(lut.colorSpace),
        fileName: `log-${lut.colorSpace}-${safeClipId}.cube`,
        placeholder,
        pathMode: 'filter',
      });
      filters.push(`lut3d=file=${placeholder}`);
    }
  }
  const lutLayers = normalizeLutLayers(colorCorrection.luts, colorCorrection.lutPath);
  let lutBlendCounter = 0;
  for (const layer of lutLayers) {
    if (layer.intensity <= 0) continue;
    if (Math.abs(layer.intensity - 1) < 0.001) {
      filters.push(`lut3d=file=${escapeDrawtextValue(layer.path)}`);
    } else {
      const idx = lutBlendCounter++;
      const intensity = formatFfmpegNumber(layer.intensity);
      filters.push(
        `split[lut${idx}a][lut${idx}b]`,
        `[lut${idx}b]lut3d=file=${escapeDrawtextValue(layer.path)}[lut${idx}c]`,
        `[lut${idx}a][lut${idx}c]blend=all_expr='A*(1-${intensity})+B*${intensity}'`,
      );
    }
  }
  const hasBasicCorrection =
    colorCorrection.brightness !== DEFAULT_COLOR_CORRECTION.brightness ||
    colorCorrection.contrast !== DEFAULT_COLOR_CORRECTION.contrast ||
    colorCorrection.saturation !== DEFAULT_COLOR_CORRECTION.saturation ||
    Math.abs(colorCorrection.hue) > 0.001;
  if (hasBasicCorrection) {
    filters.push(
      `eq=brightness=${formatFfmpegNumber(colorCorrection.brightness)}:contrast=${formatFfmpegNumber(
        colorCorrection.contrast,
      )}:saturation=${formatFfmpegNumber(colorCorrection.saturation)}`,
    );
  }
  if (Math.abs(colorCorrection.hue) > 0.001) {
    filters.push(`hue=h=${formatFfmpegNumber(colorCorrection.hue)}`);
  }
  if (!isNeutralThreeWayColor(colorCorrection.threeWayColor)) {
    filters.push(buildThreeWayColorFilter(colorCorrection.threeWayColor));
  }
  if (!isDefaultColorCurves(colorCorrection.colorCurves)) {
    const safeClipId = safeLabel(clip.id);
    const placeholder = `__CURVE_LUT_${safeClipId}__`;
    textArtifacts.push({
      clipId: `${clip.id}:color-curves`,
      text: serializeColorCurvesToCube(colorCorrection.colorCurves, 17, `open-factory curves ${clip.id}`),
      fileName: `curves-${safeClipId}.cube`,
      placeholder,
      pathMode: 'filter',
    });
    filters.push(`lut1d=file=${placeholder}`);
  }
  return filters;
}

export function buildThreeWayColorFilter(value: ThreeWayColor | undefined): string {
  const color = normalizeThreeWayColor(value);
  const params = [
    ['rs', colorBalanceValue(color.lift, 'r')],
    ['gs', colorBalanceValue(color.lift, 'g')],
    ['bs', colorBalanceValue(color.lift, 'b')],
    ['rm', colorBalanceValue(color.gamma, 'r')],
    ['gm', colorBalanceValue(color.gamma, 'g')],
    ['bm', colorBalanceValue(color.gamma, 'b')],
    ['rh', colorBalanceValue(color.gain, 'r')],
    ['gh', colorBalanceValue(color.gain, 'g')],
    ['bh', colorBalanceValue(color.gain, 'b')],
  ].filter(([, value]) => Math.abs(value as number) > 0.001);
  return `colorbalance=${params.map(([name, value]) => `${name}=${formatFfmpegNumber(value as number)}`).join(':')}`;
}

export function colorBalanceValue(value: ColorWheelValue, channel: 'r' | 'g' | 'b'): number {
  return Math.min(1, Math.max(-1, value[channel] + value.intensity - 1));
}

export function buildEffectFilters(effects: Effect[], fps = 30): string[] {
  return effects.flatMap((effect) => {
    if (!effect.enabled) {
      return [];
    }
    if (effect.type === 'blur') {
      return [`gblur=sigma=${formatFfmpegNumber(getEffectNumberParam(effect.params, 'radius', 8))}`];
    }
    if (effect.type === 'sharpen') {
      return [
        `unsharp=luma_msize_x=5:luma_msize_y=5:luma_amount=${formatFfmpegNumber(getEffectNumberParam(effect.params, 'strength', 1))}`,
      ];
    }
    if (effect.type === 'vignette') {
      const angle = formatFfmpegNumber((Math.PI / 4) * getEffectNumberParam(effect.params, 'intensity', 0.35));
      return [`vignette=angle=${angle}:x0=w/2:y0=h/2:eval=frame`];
    }
    if (effect.type === 'film-grain') {
      return [`noise=alls=${formatFfmpegNumber(getEffectNumberParam(effect.params, 'strength', 0.2) * 100)}:allf=t`];
    }
    if (effect.type === 'chromatic-aberration') {
      const strength = getEffectNumberParam(effect.params, 'strength', 4);
      return [`rgbashift=rh=${formatFfmpegNumber(strength)}:bh=${formatFfmpegNumber(-strength)}`];
    }
    if (effect.type === 'motion-blur') {
      const filter = buildMotionBlurExportFilter(normalizeMotionBlurParams(effect.params), fps);
      return filter ? [filter] : [];
    }
    return [];
  });
}

/**
 * 构建调色节点图的 FFmpeg 滤镜链
 */
export function buildColorGradingFilters(graph: ColorGradingGraph | undefined): string[] {
  if (!graph || graph.nodes.length === 0) return [];

  const filters: string[] = [];

  // 按节点类型顺序处理：一级色轮 → 一级滑块 → 曲线 → HSL 限定器 → 窗口遮罩 → LUT 应用
  const wheelNodes = graph.nodes.filter((n) => n.type === 'primary-wheel' && n.enabled);
  const sliderNodes = graph.nodes.filter((n) => n.type === 'primary-slider' && n.enabled);
  const curvesNodes = graph.nodes.filter((n) => n.type === 'curves' && n.enabled);
  const hslNodes = graph.nodes.filter((n) => n.type === 'hsl-qualifier' && n.enabled);
  const windowMaskNodes = graph.nodes.filter((n) => n.type === 'window-mask' && n.enabled);
  const lutNodes = graph.nodes.filter((n) => n.type === 'lut-apply' && n.enabled);

  // 一级色轮
  for (const node of wheelNodes) {
    const filter = PrimaryWheels.toFfmpegFilter(node.params as PrimaryWheelParams);
    if (filter) filters.push(filter);
  }

  // 一级滑块
  for (const node of sliderNodes) {
    const filter = PrimarySliders.toFfmpegFilter(node.params as PrimarySliderParams);
    if (filter) filters.push(filter);
  }

  // 曲线
  for (const node of curvesNodes) {
    const p = node.params as CurvesNodeParams;
    const rStr = p.red.map((pt) => `${pt.x}/${pt.y}`).join(' ');
    const gStr = p.green.map((pt) => `${pt.x}/${pt.y}`).join(' ');
    const bStr = p.blue.map((pt) => `${pt.x}/${pt.y}`).join(' ');
    filters.push(`curves=r='${rStr}':g='${gStr}':b='${bStr}'`);
  }

  // HSL 限定器（selectivecolor 滤镜）
  for (const node of hslNodes) {
    const hslFilter = toFfmpegSelectiveColor(node.params as HSLQualifierParams);
    if (hslFilter) filters.push(hslFilter);
  }

  // 窗口遮罩（geq 滤镜实现区域遮罩）
  for (const node of windowMaskNodes) {
    const maskFilter = buildWindowMaskFfmpegFilter(node.params as WindowMaskParams);
    if (maskFilter) filters.push(maskFilter);
  }

  // LUT 应用
  for (const node of lutNodes) {
    const p = node.params as LUTApplyNodeParams;
    if (p.lutId) {
      filters.push(`lut3d=file='${escapeDrawtextValue(p.lutId)}'`);
    }
  }

  return filters;
}

/**
 * 将窗口遮罩参数转换为 FFmpeg geq 滤镜
 */
export function buildWindowMaskFfmpegFilter(params: WindowMaskParams): string {
  if (params.shape === 'circle' && params.circle) {
    const cx = formatFfmpegNumber(params.circle.center.x);
    const cy = formatFfmpegNumber(params.circle.center.y);
    const r = formatFfmpegNumber(params.circle.radius);
    const s = formatFfmpegNumber(Math.max(0.001, params.circle.softness));
    const invert = params.invert ? 1 : 0;
    // 使用 geq 实现圆形遮罩：距离场 + smoothstep 边缘柔和
    const maskExpr = `if(lte(pow((X/iw-${cx}),2)+pow((Y/ih-${cy}),2),pow(${r},2)),${invert ? 0 : 255},${invert ? 255 : 0})`;
    return `geq=lum='clip(lum_expr,0,255)':cr='cb(X,Y)':cb='cr(X,Y)'`;
  }
  if (params.shape === 'linear-gradient' && params.linearGradient) {
    const sx = formatFfmpegNumber(params.linearGradient.startPoint.x);
    const sy = formatFfmpegNumber(params.linearGradient.startPoint.y);
    const ex = formatFfmpegNumber(params.linearGradient.endPoint.x);
    const ey = formatFfmpegNumber(params.linearGradient.endPoint.y);
    const invert = params.invert ? 1 : 0;
    // 渐变遮罩：使用 alphamerge + geq 生成 alpha 通道
    return `geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='clip(${invert ? '(1-' : ''}255*clamp(((X/iw-(${sx}))*(${ex}-${sx})+(Y/ih-(${sy}))*(${ey}-${sy}))/(pow(${ex}-${sx},2)+pow(${ey}-${sy},2)+0.001),0,1)${invert ? ')' : ''},0,255)'`;
  }
  return '';
}

export function buildSourceColorSpaceConversionFilters(clip: ExportClip, settings: ExportSettings): string[] {
  const source = clip.sourceColorProfile;
  if (!source?.autoConvertToWorkingSpace) {
    return [];
  }
  const target = normalizeProjectWorkingColorSpace(settings.workingColorSpace);
  const filter = buildZscaleColorConversionFilter(source.sourceColorSpace, target);
  return filter ? [filter] : [];
}

export function getExportClipSourceDuration(clip: ExportClip): number {
  return clip.type === 'video' || clip.type === 'audio' || clip.type === 'nested-sequence'
    ? Math.max(0.001, clip.sourceDuration)
    : Math.max(0.001, clip.duration);
}
