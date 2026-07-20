/**
 * 转场预览缩略图参数生成。
 * @module transitions/preview-args
 */

import type { TransitionType } from '../../model-types';
import { normalizeTransitionDuration } from '../../model/track-timeline';
import { formatFfmpegSeconds } from '../ffmpeg-escape';
import { getTransitionDefinition, isCustomTransition } from './transition-registry';
import { getXfadeName } from './xfade-params';
import { buildShapeGeqExpressionForPreview } from './custom-filters';

/** 预览参数选项 */
export interface TransitionThumbnailOptions {
  width?: number;
  height?: number;
  fps?: number;
  duration?: number;
}

/**
 * 为指定转场类型生成 FFmpeg 预览缩略图参数。
 * 输出为单帧 image2pipe 格式。
 * 注意：此函数不与 ffmpeg-builder 中的 buildTransitionPreviewArgs 冲突。
 */
export function buildTransitionThumbnailArgs(type: TransitionType, options: TransitionThumbnailOptions = {}): string[] {
  const width = Math.max(16, Math.round(options.width ?? 160));
  const height = Math.max(16, Math.round(options.height ?? 90));
  const fps = Math.max(1, Math.round(options.fps ?? 30));
  const duration = formatFfmpegSeconds(normalizeTransitionDuration(options.duration));
  const offset = '0';

  const def = getTransitionDefinition(type);
  let baseFilter: string;

  if (def?.customBuilder === 'shape') {
    const geqExpr = buildShapeGeqExpressionForPreview(type);
    baseFilter = `[1:v]format=rgba,geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='${geqExpr}'[shape];[0:v][shape]overlay=format=auto,scale=${width}:${height}`;
  } else if (def?.customBuilder === 'flip-h') {
    baseFilter = `[0:v]hflip[from_f];[from_f][1:v]xfade=transition=fade:duration=${duration}:offset=${offset},scale=${width}:${height}`;
  } else if (def?.customBuilder === 'flip-v') {
    baseFilter = `[0:v]vflip[from_f];[from_f][1:v]xfade=transition=fade:duration=${duration}:offset=${offset},scale=${width}:${height}`;
  } else if (def?.customBuilder === 'rotate' || def?.customBuilder === 'cube-rotate') {
    baseFilter = `[0:v]rotate='PI/10*t/${duration}':ow=iw:oh=ih:c=black@0,format=rgba[from_r];[from_r][1:v]xfade=transition=fade:duration=${duration}:offset=${offset},scale=${width}:${height}`;
  } else if (def?.customBuilder === 'glitch') {
    baseFilter = `[0:v][1:v]xfade=transition=pixelize:duration=${duration}:offset=${offset},rgbashift=rh=-5:bh=5:gh=0,eq=contrast=1.3,scale=${width}:${height}`;
  } else if (def?.customBuilder === 'light-leak') {
    baseFilter = `[0:v][1:v]xfade=transition=dissolve:duration=${duration}:offset=${offset},scale=${width}:${height}`;
  } else {
    const xfadeName = getXfadeName(type) ?? 'dissolve';
    baseFilter = `[0:v][1:v]xfade=transition=${xfadeName}:duration=${duration}:offset=${offset},scale=${width}:${height}`;
  }

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

/**
 * 为 canvas 2D 预览生成模拟参数（用于浏览器端缩略图渲染）。
 * 返回一个描述转场视觉特征的对象，供 canvas 绘制使用。
 */
export interface CanvasPreviewParams {
  type: TransitionType;
  /** 擦除方向 */
  direction?: 'left' | 'right' | 'up' | 'down';
  /** 是否使用淡入淡出 */
  fade: boolean;
  /** 是否使用缩放 */
  zoom: boolean;
  /** 是否使用旋转 */
  rotate: boolean;
  /** 是否使用像素化 */
  pixelate: boolean;
  /** 是否使用形状遮罩 */
  shapeMask?: 'heart' | 'star';
  /** 是否使用闪光 */
  flash?: 'white' | 'black';
  /** 是否使用故障效果 */
  glitch: boolean;
}

export function getCanvasPreviewParams(type: TransitionType): CanvasPreviewParams {
  const base: CanvasPreviewParams = { type, fade: false, zoom: false, rotate: false, pixelate: false, glitch: false };

  switch (type) {
    case 'dissolve':
      return { ...base, fade: true };
    case 'fade-black':
      return { ...base, fade: true, flash: 'black' };
    case 'flash-white':
      return { ...base, fade: true, flash: 'white' };
    case 'flash-black':
      return { ...base, fade: true, flash: 'black' };
    case 'wipe-left':
      return { ...base, direction: 'left' };
    case 'wipe-right':
      return { ...base, direction: 'right' };
    case 'wipe-up':
      return { ...base, direction: 'up' };
    case 'wipe-down':
      return { ...base, direction: 'down' };
    case 'push-left':
      return { ...base, direction: 'left', fade: false };
    case 'push-right':
      return { ...base, direction: 'right', fade: false };
    case 'push-up':
      return { ...base, direction: 'up', fade: false };
    case 'push-down':
      return { ...base, direction: 'down', fade: false };
    case 'zoom-dissolve':
      return { ...base, fade: true, zoom: true };
    case 'block':
      return { ...base, pixelate: true };
    case 'rotate':
      return { ...base, rotate: true, fade: true };
    case 'film-roll-open':
      return { ...base, direction: 'up' };
    case 'film-roll-close':
      return { ...base, direction: 'down' };
    case 'shape-heart':
      return { ...base, shapeMask: 'heart', fade: true };
    case 'shape-star':
      return { ...base, shapeMask: 'star', fade: true };
    case 'motion-blur-wipe':
      return { ...base, direction: 'left', fade: true };
    case 'light-leak':
      return { ...base, fade: true };
    case 'glitch':
      return { ...base, glitch: true, pixelate: true };
    case 'flip-horizontal':
      return { ...base, fade: true };
    case 'flip-vertical':
      return { ...base, fade: true };
    case 'cube-rotate':
      return { ...base, rotate: true, zoom: true, fade: true };
    case 'portal':
      return { ...base, zoom: true, fade: true };
    default:
      return { ...base, fade: true };
  }
}
