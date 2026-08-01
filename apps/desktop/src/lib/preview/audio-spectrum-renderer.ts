import type { AudioSpectrumParams, Timeline } from '@open-factory/editor-core';
import {
  getActiveClipsAtTime,
  normalizeAudioSpectrumParams,
  expandAudioVisualizationTheme,
  MANUAL_AUDIO_VISUALIZATION_THEME_ID,
} from '@open-factory/editor-core';

export function drawAudioSpectrumToCanvas(
  timeline: Timeline,
  playheadTime: number,
  width: number,
  height: number,
  readAnalysisFrame: (kind: 'frequency' | 'waveform') => Uint8Array | undefined,
): HTMLCanvasElement | undefined {
  const activeParams = getActiveAudioSpectrumParams(timeline, playheadTime);
  if (activeParams.length === 0) {
    return undefined;
  }
  const overlay = document.createElement('canvas');
  overlay.width = width;
  overlay.height = height;
  const context = overlay.getContext('2d');
  if (!context) {
    return undefined;
  }
  let drew = false;
  for (const params of activeParams) {
    const data = readAnalysisFrame(params.style === 'waveform' ? 'waveform' : 'frequency');
    if (!data) {
      continue;
    }
    drawAudioSpectrumOverlay(context, width, height, params, data);
    drew = true;
  }
  return drew ? overlay : undefined;
}

function getActiveAudioSpectrumParams(timeline: Timeline, playheadTime: number): AudioSpectrumParams[] {
  return getActiveClipsAtTime(timeline, playheadTime).flatMap((clip) =>
    (clip.effects ?? []).flatMap((effect) => {
      if (!effect.enabled || effect.type !== 'audio-spectrum') {
        return [];
      }
      const params = normalizeAudioSpectrumParams(effect.params);
      return params.height > 0 ? [params] : [];
    }),
  );
}

function drawAudioSpectrumOverlay(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  params: AudioSpectrumParams,
  data: Uint8Array,
): void {
  const overlayHeight = Math.max(2, Math.round(height * (params.height / 100)));
  const y = params.position === 'top' ? 0 : height - overlayHeight;
  const theme =
    params.themeId && params.themeId !== MANUAL_AUDIO_VISUALIZATION_THEME_ID
      ? expandAudioVisualizationTheme({
          themeId: params.themeId,
          color: params.color,
          colorStart: params.colorStart,
          colorEnd: params.colorEnd,
        })
      : undefined;
  const paint = context.createLinearGradient(0, y, 0, y + overlayHeight);
  paint.addColorStop(0, params.colorStart);
  paint.addColorStop(1, params.colorEnd);
  context.save();
  context.globalAlpha = 0.9;
  if (theme?.background.type === 'solid') {
    context.fillStyle = theme.background.color;
    context.globalAlpha = 0.28;
    context.fillRect(0, y, width, overlayHeight);
    context.globalAlpha = 0.9;
  } else if (theme?.background.type === 'gradient') {
    const background = context.createLinearGradient(0, y, 0, y + overlayHeight);
    background.addColorStop(0, theme.background.color);
    background.addColorStop(1, theme.background.color2);
    context.fillStyle = background;
    context.globalAlpha = 0.28;
    context.fillRect(0, y, width, overlayHeight);
    context.globalAlpha = 0.9;
  }
  if (theme?.glow && theme.glowStrength > 0) {
    context.shadowColor = theme.glowColor;
    context.shadowBlur = 4 + theme.glowStrength * 16;
  }
  context.strokeStyle = paint;
  context.fillStyle = paint;
  context.lineWidth = 2;
  if (params.style === 'waveform') {
    drawWaveformSpectrum(context, width, overlayHeight, y, params.sensitivity, data, params.mirror);
  } else if (params.style === 'circular') {
    drawCircleSpectrum(context, width, overlayHeight, y, params.sensitivity, data);
  } else {
    drawBarSpectrum(context, width, overlayHeight, y, params.sensitivity, data, params.mirror);
  }
  if (theme?.border && theme.borderWidth > 0) {
    context.shadowBlur = 0;
    context.globalAlpha = 0.85;
    context.strokeStyle = theme.borderColor;
    context.lineWidth = theme.borderWidth;
    context.strokeRect(
      theme.borderWidth / 2,
      y + theme.borderWidth / 2,
      width - theme.borderWidth,
      overlayHeight - theme.borderWidth,
    );
  }
  context.restore();
}

function drawBarSpectrum(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  y: number,
  sensitivity: number,
  data: Uint8Array,
  mirror: boolean,
): void {
  const bars = Math.min(96, Math.max(16, Math.floor(width / 12)));
  const barWidth = width / bars;
  const centerY = y + height / 2;
  for (let index = 0; index < bars; index += 1) {
    const sample = data[Math.min(data.length - 1, Math.floor((index / bars) * data.length))] ?? 0;
    const level = Math.min(1, (sample / 255) * sensitivity);
    const barHeight = Math.max(1, level * (mirror ? height / 2 : height));
    const x = index * barWidth + 1;
    const drawWidth = Math.max(1, barWidth - 2);
    if (mirror) {
      context.fillRect(x, centerY - barHeight, drawWidth, barHeight * 2);
    } else {
      context.fillRect(x, y + height - barHeight, drawWidth, barHeight);
    }
  }
}

function drawWaveformSpectrum(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  y: number,
  sensitivity: number,
  data: Uint8Array,
  mirror: boolean,
): void {
  const centerY = y + height / 2;
  for (const direction of mirror ? [1, -1] : [1]) {
    context.beginPath();
    for (let index = 0; index < data.length; index += 1) {
      const x = (index / Math.max(1, data.length - 1)) * width;
      const normalized = ((data[index] ?? 128) - 128) / 128;
      const nextY = centerY + normalized * direction * sensitivity * (height / 2);
      if (index === 0) {
        context.moveTo(x, nextY);
      } else {
        context.lineTo(x, nextY);
      }
    }
    context.stroke();
  }
}

function drawCircleSpectrum(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  y: number,
  sensitivity: number,
  data: Uint8Array,
): void {
  const centerX = width / 2;
  const centerY = y + height / 2;
  const radius = Math.max(8, height * 0.28);
  const bars = 96;
  context.beginPath();
  context.arc(centerX, centerY, radius, 0, Math.PI * 2);
  context.stroke();
  for (let index = 0; index < bars; index += 1) {
    const angle = (index / bars) * Math.PI * 2 - Math.PI / 2;
    const sample = data[Math.min(data.length - 1, Math.floor((index / bars) * data.length))] ?? 0;
    const level = Math.min(1, (sample / 255) * sensitivity);
    const inner = radius;
    const outer = radius + level * height * 0.32;
    context.beginPath();
    context.moveTo(centerX + Math.cos(angle) * inner, centerY + Math.sin(angle) * inner);
    context.lineTo(centerX + Math.cos(angle) * outer, centerY + Math.sin(angle) * outer);
    context.stroke();
  }
}
