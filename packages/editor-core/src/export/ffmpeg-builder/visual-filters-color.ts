import {DEFAULT_COLOR_CORRECTION, isDefaultColorCorrection, normalizeColorCorrection, normalizeLutLayers} from '../../model';
import {isDefaultColorCurves, isNeutralThreeWayColor, normalizeThreeWayColor, serializeColorCurvesToCube, PrimaryWheels, PrimarySliders, toFfmpegSelectiveColor, type ColorWheelValue, type ColorGradingGraph, type CurvesNodeParams, type LUTApplyNodeParams, type PrimaryWheelParams, type PrimarySliderParams, type HSLQualifierParams, type WindowMaskParams, type ThreeWayColor} from '../../color-grading';
import {getLogToRec709Lut, isLogInputColorSpace, serializeLogToRec709Cube} from '../../color-log-luts';
import {buildMotionBlurExportFilter, normalizeMotionBlurParams} from '../../motion-blur';
import {buildZscaleColorConversionFilter, normalizeProjectWorkingColorSpace} from '../../color-management';
import {escapeDrawtextValue} from '../ffmpeg-escape';
import {formatFfmpegNumber, safeLabel} from './utils';
import type {Effect} from '../../effects';
import {getEffectNumberParam} from '../../effects';
import type {ExportClip, ExportSettings, TextArtifact} from '../export-types';

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
 * Build FFmpeg filter chain for color grading graph
 */
export function buildColorGradingFilters(graph: ColorGradingGraph | undefined): string[] {
  if (!graph || graph.nodes.length === 0) return [];

  const filters: string[] = [];

  const wheelNodes = graph.nodes.filter((n) => n.type === 'primary-wheel' && n.enabled);
  const sliderNodes = graph.nodes.filter((n) => n.type === 'primary-slider' && n.enabled);
  const curvesNodes = graph.nodes.filter((n) => n.type === 'curves' && n.enabled);
  const hslNodes = graph.nodes.filter((n) => n.type === 'hsl-qualifier' && n.enabled);
  const windowMaskNodes = graph.nodes.filter((n) => n.type === 'window-mask' && n.enabled);
  const lutNodes = graph.nodes.filter((n) => n.type === 'lut-apply' && n.enabled);

  for (const node of wheelNodes) {
    const filter = PrimaryWheels.toFfmpegFilter(node.params as PrimaryWheelParams);
    if (filter) filters.push(filter);
  }

  for (const node of sliderNodes) {
    const filter = PrimarySliders.toFfmpegFilter(node.params as PrimarySliderParams);
    if (filter) filters.push(filter);
  }

  for (const node of curvesNodes) {
    const p = node.params as CurvesNodeParams;
    const rStr = p.red.map((pt) => `${pt.x}/${pt.y}`).join(' ');
    const gStr = p.green.map((pt) => `${pt.x}/${pt.y}`).join(' ');
    const bStr = p.blue.map((pt) => `${pt.x}/${pt.y}`).join(' ');
    filters.push(`curves=r='${rStr}':g='${gStr}':b='${bStr}'`);
  }

  for (const node of hslNodes) {
    const hslFilter = toFfmpegSelectiveColor(node.params as HSLQualifierParams);
    if (hslFilter) filters.push(hslFilter);
  }

  for (const node of windowMaskNodes) {
    const maskFilter = buildWindowMaskFfmpegFilter(node.params as WindowMaskParams);
    if (maskFilter) filters.push(maskFilter);
  }

  for (const node of lutNodes) {
    const p = node.params as LUTApplyNodeParams;
    if (p.lutId) {
      filters.push(`lut3d=file='${escapeDrawtextValue(p.lutId)}'`);
    }
  }

  return filters;
}

/**
 * Convert window mask params to FFmpeg geq filter
 */
export function buildWindowMaskFfmpegFilter(params: WindowMaskParams): string {
  if (params.shape === 'circle' && params.circle) {
    const cx = formatFfmpegNumber(params.circle.center.x);
    const cy = formatFfmpegNumber(params.circle.center.y);
    const r = formatFfmpegNumber(params.circle.radius);
    const s = formatFfmpegNumber(Math.max(0.001, params.circle.softness));
    const invert = params.invert ? 1 : 0;
    const maskExpr = `if(lte(pow((X/iw-${cx}),2)+pow((Y/ih-${cy}),2),pow(${r},2)),${invert ? 0 : 255},${invert ? 255 : 0})`;
    return `geq=lum='clip(lum_expr,0,255)':cr='cb(X,Y)':cb='cr(X,Y)'`;
  }
  if (params.shape === 'linear-gradient' && params.linearGradient) {
    const sx = formatFfmpegNumber(params.linearGradient.startPoint.x);
    const sy = formatFfmpegNumber(params.linearGradient.startPoint.y);
    const ex = formatFfmpegNumber(params.linearGradient.endPoint.x);
    const ey = formatFfmpegNumber(params.linearGradient.endPoint.y);
    const invert = params.invert ? 1 : 0;
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
