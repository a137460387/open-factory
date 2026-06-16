import { describe, expect, it, vi } from 'vitest';
import { buildAudioVisualizationThemePreviewFrame, drawAudioVisualizationThemePreviewFrame } from './audioVisualizationThemePreview';

describe('audio visualization theme preview', () => {
  it('builds canvas operations for themed spectrum previews', () => {
    const operations = buildAudioVisualizationThemePreviewFrame({ themeId: 'neon-cyberpunk' }, 'spectrum-bars', 160, 90);

    expect(operations[0]).toEqual({ kind: 'background', color: '#120026', color2: '#020617' });
    expect(operations.some((operation) => operation.kind === 'glow')).toBe(true);
    expect(operations.filter((operation) => operation.kind === 'bar')).toHaveLength(12);
    expect(operations.some((operation) => operation.kind === 'particle')).toBe(true);
    expect(operations.at(-1)).toEqual({ kind: 'border', color: '#38bdf8', width: 2 });
  });

  it('renders a theme preview frame to a canvas context', () => {
    const gradient = { addColorStop: vi.fn() };
    const context = {
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 1,
      globalAlpha: 1,
      createLinearGradient: vi.fn(() => gradient),
      fillRect: vi.fn(),
      strokeRect: vi.fn(),
      beginPath: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn()
    } as unknown as CanvasRenderingContext2D;

    drawAudioVisualizationThemePreviewFrame(context, { themeId: 'retro-vu' }, 'spectrum-bars', 120, 72);

    expect(context.fillRect).toHaveBeenCalled();
    expect(context.strokeRect).toHaveBeenCalled();
    expect(context.fillRect).toHaveBeenCalledTimes(13);
    expect(context.strokeStyle).toBe('#7ddc63');
  });
});
