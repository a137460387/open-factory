import {normalizeTransitionDuration} from '../../model';
import {round} from '../../time';
import {formatFfmpegSeconds} from '../ffmpeg-escape';
import {formatFfmpegNumber} from './utils';
import type {ExportClip, ExportTransition, ExportTimeline, ExportTrack, ExportSettings} from '../export-types';

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
