import {triangulatePathMask} from '../../masks/path-mask';
import {normalizeClipBorder} from '../../model';
import {cssColorToFfmpeg, formatFfmpegSeconds} from '../ffmpeg-escape';
import {formatFfmpegNumber, safeLabel} from './utils';
import type {ExportClip} from '../export-types';

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
