import {
  normalizeAudioSpectrumParams,
  type AudioSpectrumParams,
} from '../../effects';
import {
  MANUAL_AUDIO_VISUALIZATION_THEME_ID,
  expandAudioVisualizationTheme,
  type ExpandedAudioVisualizationTheme,
} from '../../audio-visualization-themes';
import type {
  ExportClip,
  ExportAudioVisualizationBackground,
  ExportAudioVisualizationSettings,
  ExportSettings,
} from '../export-types';
import { cssColorToFfmpeg, formatFfmpegSeconds } from '../ffmpeg-escape';
import { formatFfmpegNumber, formatOpacity } from './utils';

export interface AudioSpectrumExportItem {
  clipId: string;
  start: number;
  duration: number;
  params: AudioSpectrumParams;
}

export function collectAudioSpectrumEffects(clips: ExportClip[]): AudioSpectrumExportItem[] {
  return clips.flatMap((clip) => {
    if (clip.type === 'adjustment') {
      return [];
    }
    return clip.effects.flatMap((effect) => {
      if (!effect.enabled || effect.type !== 'audio-spectrum') {
        return [];
      }
      const params = normalizeAudioSpectrumParams(effect.params);
      if (params.height <= 0 || clip.duration <= 0) {
        return [];
      }
      return [
        {
          clipId: clip.id,
          start: clip.start,
          duration: clip.duration,
          params,
        },
      ];
    });
  });
}

export function buildAudioSpectrumFilter(
  inputLabel: string,
  outputLabel: string,
  params: AudioSpectrumParams,
  settings: ExportSettings,
): string {
  const width = Math.max(2, Math.round(settings.width));
  const height = Math.max(2, Math.round(settings.height * (params.height / 100)));
  const audioGain = `volume=${formatFfmpegNumber(params.sensitivity)}`;
  const theme = expandAudioVisualizationTheme({
    themeId: params.themeId,
    color: params.color,
    colorStart: params.colorStart,
    colorEnd: params.colorEnd,
  });
  const colorStart = theme.colorStart;
  const colorEnd = theme.colorEnd;
  const decorationTheme = params.themeId && params.themeId !== MANUAL_AUDIO_VISUALIZATION_THEME_ID ? theme : undefined;
  if (params.style === 'waveform') {
    return buildAudioSpectrumVisualFilter({
      inputLabel,
      outputLabel,
      audioGain,
      visualizerFilter: `showwaves=s=${width}x${height}:mode=line:colors=0xffffff`,
      colorStart,
      colorEnd,
      alpha: 0.9,
      mirror: params.mirror,
      theme: decorationTheme,
    });
  }
  if (params.style === 'circular') {
    const size = Math.max(2, Math.min(width, height));
    return buildAudioSpectrumVisualFilter({
      inputLabel,
      outputLabel,
      audioGain,
      visualizerFilter: `showfreqs=s=${size}x${size}:mode=bar:ascale=log:colors=0xffffff`,
      postVisualizerFilters: [`crop=${size}:${size}`, 'vignette=angle=0.35:x0=w/2:y0=h/2:eval=frame'],
      colorStart,
      colorEnd,
      alpha: 0.9,
      mirror: params.mirror,
      circularMask: true,
      theme: decorationTheme,
    });
  }
  return buildAudioSpectrumVisualFilter({
    inputLabel,
    outputLabel,
    audioGain,
    visualizerFilter: `showfreqs=s=${width}x${height}:mode=bar:ascale=log:colors=0xffffff`,
    colorStart,
    colorEnd,
    alpha: 0.9,
    mirror: params.mirror,
    theme: decorationTheme,
  });
}

export function buildAudioSpectrumOverlayYExpression(params: AudioSpectrumParams): string {
  return params.position === 'top' ? '0' : 'main_h-overlay_h';
}

export function buildAudioVisualizationBackgroundFilters(
  background: ExportAudioVisualizationBackground,
  settings: ExportSettings,
  duration: number,
  imageInputIndex?: number,
): string[] {
  const width = Math.max(2, Math.round(settings.width));
  const height = Math.max(2, Math.round(settings.height));
  const fps = Math.max(1, Math.round(settings.fps));
  if (background.type === 'image' && imageInputIndex !== undefined) {
    return [
      `[${imageInputIndex}:v]scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},fps=${fps},format=rgba[base0]`,
    ];
  }
  if (background.type === 'gradient') {
    const start = parseHexColor(background.color, '#050816');
    const end = parseHexColor(background.color2, '#1d4ed8');
    return [
      `color=c=${cssColorToFfmpeg(background.color)}:s=${width}x${height}:r=${fps}:d=${formatFfmpegSeconds(
        duration,
      )},format=rgba,geq=r='${buildGradientChannelExpression(start.r, end.r)}':g='${buildGradientChannelExpression(
        start.g,
        end.g,
      )}':b='${buildGradientChannelExpression(start.b, end.b)}':a='255'[base0]`,
    ];
  }
  const solidColor = background.type === 'image' ? '#050816' : background.color;
  return [
    `color=c=${cssColorToFfmpeg(solidColor)}:s=${width}x${height}:r=${fps}:d=${formatFfmpegSeconds(duration)},format=rgba[base0]`,
  ];
}

export function buildAudioVisualizationFilter(
  inputLabel: string,
  outputLabel: string,
  visualization: ExportAudioVisualizationSettings,
  settings: ExportSettings,
): string {
  const width = Math.max(2, Math.round(settings.width));
  const height = Math.max(2, Math.round(settings.height));
  const theme = resolveExportAudioVisualizationTheme(visualization);
  const colorStart = theme?.colorStart ?? visualization.color;
  const colorEnd = theme?.colorEnd ?? colorStart;
  if (visualization.style === 'waveform-line') {
    return buildAudioSpectrumVisualFilter({
      inputLabel,
      outputLabel,
      visualizerFilter: `showwaves=s=${width}x${height}:mode=line:colors=0xffffff`,
      colorStart,
      colorEnd,
      alpha: 0.95,
      mirror: false,
      theme,
    });
  }
  if (visualization.style === 'circular-spectrum') {
    const size = Math.max(2, Math.round(Math.min(width, height) * 0.72));
    return buildAudioSpectrumVisualFilter({
      inputLabel,
      outputLabel,
      visualizerFilter: `showfreqs=s=${size}x${size}:mode=bar:ascale=log:colors=0xffffff`,
      postVisualizerFilters: [`crop=${size}:${size}`, 'vignette=angle=0.35:x0=w/2:y0=h/2:eval=frame'],
      colorStart,
      colorEnd,
      alpha: 0.95,
      mirror: false,
      circularMask: true,
      theme,
    });
  }
  return buildAudioSpectrumVisualFilter({
    inputLabel,
    outputLabel,
    visualizerFilter: `showfreqs=s=${width}x${height}:mode=bar:ascale=log:colors=0xffffff`,
    colorStart,
    colorEnd,
    alpha: 0.95,
    mirror: false,
    theme,
  });
}

export interface AudioSpectrumVisualFilterInput {
  inputLabel: string;
  outputLabel: string;
  visualizerFilter: string;
  colorStart: string;
  colorEnd: string;
  alpha: number;
  audioGain?: string;
  postVisualizerFilters?: string[];
  mirror: boolean;
  circularMask?: boolean;
  theme?: ExpandedAudioVisualizationTheme;
}

export function buildAudioSpectrumVisualFilter(input: AudioSpectrumVisualFilterInput): string {
  const rawLabel = `${input.outputLabel}_raw`;
  const gradientLabel = `${input.outputLabel}_gradient`;
  const needsDecoration = hasAudioVisualizationThemeDecorations(input.theme);
  const alphaLabel = input.mirror || needsDecoration ? `${input.outputLabel}_alpha` : input.outputLabel;
  const visualFilters = [input.audioGain, input.visualizerFilter, ...(input.postVisualizerFilters ?? []), 'format=rgba']
    .filter(Boolean)
    .join(',');
  const filters = [
    `[${input.inputLabel}]${visualFilters}[${rawLabel}]`,
    ...buildAudioSpectrumGradientFilters(rawLabel, gradientLabel, input.colorStart, input.colorEnd),
  ];
  const alphaFilters = [
    'colorkey=0x000000:0.08:0.12',
    `colorchannelmixer=aa=${formatOpacity(input.alpha)}`,
    ...(input.circularMask ? [buildCircularAlphaMaskFilter()] : []),
  ];
  filters.push(`[${gradientLabel}]${alphaFilters.join(',')}[${alphaLabel}]`);
  let decoratedLabel = alphaLabel;
  if (needsDecoration && input.theme) {
    decoratedLabel = appendAudioVisualizationThemeDecorationFilters(
      filters,
      alphaLabel,
      input.outputLabel,
      input.theme,
    );
  }
  if (input.mirror) {
    const normalLabel = `${input.outputLabel}_normal`;
    const flipSourceLabel = `${input.outputLabel}_flip_src`;
    const flippedLabel = `${input.outputLabel}_flipped`;
    filters.push(
      `[${decoratedLabel}]split=2[${normalLabel}][${flipSourceLabel}]`,
      `[${flipSourceLabel}]vflip[${flippedLabel}]`,
      `[${normalLabel}][${flippedLabel}]overlay=x=0:y=0:format=auto[${input.outputLabel}]`,
    );
  } else if (decoratedLabel !== input.outputLabel) {
    filters.push(`[${decoratedLabel}]copy[${input.outputLabel}]`);
  }
  return filters.join(';');
}

export function hasAudioVisualizationThemeDecorations(theme: ExpandedAudioVisualizationTheme | undefined): boolean {
  return Boolean(
    theme && ((theme.glow && theme.glowStrength > 0) || theme.particles || (theme.border && theme.borderWidth > 0)),
  );
}

export function appendAudioVisualizationThemeDecorationFilters(
  filters: string[],
  inputLabel: string,
  outputLabel: string,
  theme: ExpandedAudioVisualizationTheme,
): string {
  let currentLabel = inputLabel;
  if (theme.glow && theme.glowStrength > 0) {
    const baseLabel = `${outputLabel}_glow_base`;
    const glowSourceLabel = `${outputLabel}_glow_src`;
    const glowLabel = `${outputLabel}_glow`;
    const combinedLabel = `${outputLabel}_with_glow`;
    filters.push(
      `[${currentLabel}]split=2[${baseLabel}][${glowSourceLabel}]`,
      `[${glowSourceLabel}]gblur=sigma=${formatFfmpegNumber(2 + theme.glowStrength * 8)},colorchannelmixer=${buildColorChannelMixerForHex(
        theme.glowColor,
      )}:aa=${formatOpacity(Math.min(0.9, 0.25 + theme.glowStrength * 0.65))}[${glowLabel}]`,
      `[${glowLabel}][${baseLabel}]overlay=format=auto[${combinedLabel}]`,
    );
    currentLabel = combinedLabel;
  }
  if (theme.particles) {
    const particleLabel = `${outputLabel}_particles`;
    filters.push(
      `[${currentLabel}]noise=alls=8:allf=t+u,colorchannelmixer=${buildColorChannelMixerForHex(theme.particleColor)}[${particleLabel}]`,
    );
    currentLabel = particleLabel;
  }
  if (theme.border && theme.borderWidth > 0) {
    const borderLabel = `${outputLabel}_border`;
    filters.push(
      `[${currentLabel}]drawbox=x=0:y=0:w=iw:h=ih:color=${cssColorToFfmpeg(theme.borderColor)}@0.85:t=${Math.max(1, Math.round(theme.borderWidth))}[${borderLabel}]`,
    );
    currentLabel = borderLabel;
  }
  return currentLabel;
}

export function buildAudioSpectrumGradientFilters(
  inputLabel: string,
  outputLabel: string,
  colorStart: string,
  colorEnd: string,
): string[] {
  const startSourceLabel = `${outputLabel}_start_src`;
  const endSourceLabel = `${outputLabel}_end_src`;
  const startLabel = `${outputLabel}_start`;
  const endLabel = `${outputLabel}_end`;
  return [
    `[${inputLabel}]split=2[${startSourceLabel}][${endSourceLabel}]`,
    `[${startSourceLabel}]colorchannelmixer=${buildColorChannelMixerForHex(colorStart)}[${startLabel}]`,
    `[${endSourceLabel}]colorchannelmixer=${buildColorChannelMixerForHex(colorEnd)}[${endLabel}]`,
    `[${startLabel}][${endLabel}]blend=all_expr='A*(1-Y/H)+B*(Y/H)'[${outputLabel}]`,
  ];
}

export function buildColorChannelMixerForHex(color: string): string {
  const parsed = parseHexColor(color, '#22d3ee');
  return [
    `rr=${formatFfmpegNumber(parsed.r / 255)}`,
    `gg=${formatFfmpegNumber(parsed.g / 255)}`,
    `bb=${formatFfmpegNumber(parsed.b / 255)}`,
  ].join(':');
}

export function buildCircularAlphaMaskFilter(): string {
  return "geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='alpha(X,Y)*if(lte((X-W/2)*(X-W/2)+(Y-H/2)*(Y-H/2),(min(W,H)/2)*(min(W,H)/2)),1,0)'";
}

export function buildAudioVisualizationOverlayPosition(
  style: ExportAudioVisualizationSettings['style'],
  _settings: ExportSettings,
): { x: string; y: string } {
  if (style === 'circular-spectrum') {
    return { x: '(main_w-overlay_w)/2', y: '(main_h-overlay_h)/2' };
  }
  return { x: '0', y: '0' };
}

export function normalizeHexColor(value: string | undefined, fallback: string): string {
  const parsed = parseHexColor(value ?? '', fallback);
  return `#${toHexChannel(parsed.r)}${toHexChannel(parsed.g)}${toHexChannel(parsed.b)}`;
}

export function parseHexColor(value: string, fallback: string): { r: number; g: number; b: number } {
  const normalized = value.trim().replace(/^#/, '');
  if (/^[0-9a-fA-F]{6}$/.test(normalized)) {
    return {
      r: Number.parseInt(normalized.slice(0, 2), 16),
      g: Number.parseInt(normalized.slice(2, 4), 16),
      b: Number.parseInt(normalized.slice(4, 6), 16),
    };
  }
  if (/^[0-9a-fA-F]{3}$/.test(normalized)) {
    return {
      r: Number.parseInt(normalized[0] + normalized[0], 16),
      g: Number.parseInt(normalized[1] + normalized[1], 16),
      b: Number.parseInt(normalized[2] + normalized[2], 16),
    };
  }
  if (value === fallback) {
    return { r: 5, g: 8, b: 22 };
  }
  return parseHexColor(fallback, '#050816');
}

export function buildGradientChannelExpression(start: number, end: number): string {
  if (start === end) {
    return String(start);
  }
  return `${start}+(${end - start})*Y/max(H-1,1)`;
}

export function toHexChannel(value: number): string {
  return Math.round(Math.min(255, Math.max(0, value)))
    .toString(16)
    .padStart(2, '0');
}

export function resolveExportAudioVisualizationTheme(
  visualization: ExportAudioVisualizationSettings,
): ExpandedAudioVisualizationTheme | undefined {
  if (!visualization.themeId && !visualization.theme) {
    return undefined;
  }
  return expandAudioVisualizationTheme({
    themeId: visualization.themeId,
    theme: visualization.theme,
    color: visualization.color,
  });
}
