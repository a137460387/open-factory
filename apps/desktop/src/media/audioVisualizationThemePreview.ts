import { expandAudioVisualizationTheme, type AudioVisualizationThemeSource, type ExportAudioVisualizationStyle } from '@open-factory/editor-core';

export type AudioVisualizationThemePreviewOperation =
  | { kind: 'background'; color: string; color2?: string }
  | { kind: 'glow'; color: string; strength: number }
  | { kind: 'bar'; x: number; y: number; width: number; height: number; color: string }
  | { kind: 'line'; points: Array<{ x: number; y: number }>; color: string }
  | { kind: 'circleBar'; x1: number; y1: number; x2: number; y2: number; color: string }
  | { kind: 'particle'; x: number; y: number; radius: number; color: string }
  | { kind: 'border'; color: string; width: number };

const PREVIEW_LEVELS = [0.18, 0.42, 0.7, 0.96, 0.54, 0.32, 0.78, 0.46, 0.9, 0.28, 0.62, 0.84];

export function buildAudioVisualizationThemePreviewFrame(
  source: AudioVisualizationThemeSource,
  style: ExportAudioVisualizationStyle,
  width: number,
  height: number
): AudioVisualizationThemePreviewOperation[] {
  const theme = expandAudioVisualizationTheme(source);
  const safeWidth = Math.max(1, Math.round(width));
  const safeHeight = Math.max(1, Math.round(height));
  const operations: AudioVisualizationThemePreviewOperation[] = [
    theme.background.type === 'gradient'
      ? { kind: 'background', color: theme.background.color, color2: theme.background.color2 }
      : { kind: 'background', color: theme.background.color }
  ];
  if (theme.glow && theme.glowStrength > 0) {
    operations.push({ kind: 'glow', color: theme.glowColor, strength: theme.glowStrength });
  }
  if (style === 'waveform-line') {
    operations.push({ kind: 'line', color: theme.colorStart, points: buildWavePoints(safeWidth, safeHeight) });
  } else if (style === 'circular-spectrum') {
    operations.push(...buildCircleBars(safeWidth, safeHeight, theme.colorStart, theme.colorEnd));
  } else {
    operations.push(...buildBars(safeWidth, safeHeight, theme.colorStart, theme.colorEnd));
  }
  if (theme.particles) {
    operations.push(...buildParticles(safeWidth, safeHeight, theme.particleColor));
  }
  if (theme.border && theme.borderWidth > 0) {
    operations.push({ kind: 'border', color: theme.borderColor, width: theme.borderWidth });
  }
  return operations;
}

export function drawAudioVisualizationThemePreviewFrame(
  context: CanvasRenderingContext2D,
  source: AudioVisualizationThemeSource,
  style: ExportAudioVisualizationStyle,
  width: number,
  height: number
): void {
  const operations = buildAudioVisualizationThemePreviewFrame(source, style, width, height);
  for (const operation of operations) {
    if (operation.kind === 'background') {
      context.fillStyle = operation.color2 ? makeLinearGradient(context, width, height, operation.color, operation.color2) : operation.color;
      context.fillRect(0, 0, width, height);
    } else if (operation.kind === 'glow') {
      context.save();
      context.globalAlpha = 0.18 + operation.strength * 0.24;
      context.fillStyle = operation.color;
      context.beginPath();
      context.arc(width * 0.5, height * 0.52, Math.min(width, height) * (0.25 + operation.strength * 0.18), 0, Math.PI * 2);
      context.fill();
      context.restore();
    } else if (operation.kind === 'bar') {
      context.fillStyle = operation.color;
      context.fillRect(operation.x, operation.y, operation.width, operation.height);
    } else if (operation.kind === 'line') {
      context.strokeStyle = operation.color;
      context.lineWidth = Math.max(1, Math.round(height / 28));
      context.beginPath();
      operation.points.forEach((point, index) => {
        if (index === 0) {
          context.moveTo(point.x, point.y);
        } else {
          context.lineTo(point.x, point.y);
        }
      });
      context.stroke();
    } else if (operation.kind === 'circleBar') {
      context.strokeStyle = operation.color;
      context.lineWidth = Math.max(1, Math.round(width / 90));
      context.beginPath();
      context.moveTo(operation.x1, operation.y1);
      context.lineTo(operation.x2, operation.y2);
      context.stroke();
    } else if (operation.kind === 'particle') {
      context.fillStyle = operation.color;
      context.beginPath();
      context.arc(operation.x, operation.y, operation.radius, 0, Math.PI * 2);
      context.fill();
    } else {
      context.strokeStyle = operation.color;
      context.lineWidth = Math.max(1, Math.round(operation.width));
      context.strokeRect(context.lineWidth / 2, context.lineWidth / 2, width - context.lineWidth, height - context.lineWidth);
    }
  }
}

function buildBars(width: number, height: number, colorStart: string, colorEnd: string): AudioVisualizationThemePreviewOperation[] {
  const barCount = PREVIEW_LEVELS.length;
  const gap = Math.max(2, Math.round(width / 90));
  const barWidth = Math.max(2, (width - gap * (barCount + 1)) / barCount);
  return PREVIEW_LEVELS.map((level, index) => {
    const barHeight = Math.max(2, level * height * 0.72);
    return {
      kind: 'bar',
      x: gap + index * (barWidth + gap),
      y: height - barHeight - height * 0.12,
      width: barWidth,
      height: barHeight,
      color: index < barCount * 0.62 ? colorStart : colorEnd
    };
  });
}

function buildWavePoints(width: number, height: number): Array<{ x: number; y: number }> {
  return PREVIEW_LEVELS.map((level, index) => ({
    x: (index / (PREVIEW_LEVELS.length - 1)) * width,
    y: height * (0.5 + (level - 0.55) * 0.55)
  }));
}

function buildCircleBars(width: number, height: number, colorStart: string, colorEnd: string): AudioVisualizationThemePreviewOperation[] {
  const centerX = width / 2;
  const centerY = height / 2;
  const radius = Math.min(width, height) * 0.24;
  return PREVIEW_LEVELS.map((level, index) => {
    const angle = (index / PREVIEW_LEVELS.length) * Math.PI * 2 - Math.PI / 2;
    const outer = radius + level * Math.min(width, height) * 0.22;
    return {
      kind: 'circleBar',
      x1: centerX + Math.cos(angle) * radius,
      y1: centerY + Math.sin(angle) * radius,
      x2: centerX + Math.cos(angle) * outer,
      y2: centerY + Math.sin(angle) * outer,
      color: index < PREVIEW_LEVELS.length * 0.7 ? colorStart : colorEnd
    };
  });
}

function buildParticles(width: number, height: number, color: string): AudioVisualizationThemePreviewOperation[] {
  return [
    { kind: 'particle', x: width * 0.18, y: height * 0.24, radius: 1.8, color },
    { kind: 'particle', x: width * 0.74, y: height * 0.2, radius: 1.4, color },
    { kind: 'particle', x: width * 0.86, y: height * 0.72, radius: 1.6, color }
  ];
}

function makeLinearGradient(context: CanvasRenderingContext2D, width: number, height: number, color: string, color2: string): CanvasGradient {
  const gradient = context.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, color);
  gradient.addColorStop(1, color2);
  return gradient;
}
