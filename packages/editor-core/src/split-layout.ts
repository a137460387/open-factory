import type { Transform } from './model';
import { round } from './time';

export type SplitLayoutPresetId = 'side-by-side' | 'stacked' | 'quad' | 'three-columns' | 'main-side';

export interface SplitLayoutCell {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SplitLayoutDefinition {
  id: string;
  name: string;
  cells: SplitLayoutCell[];
}

export interface SplitLayoutClipSource {
  clipId: string;
  sourceWidth?: number;
  sourceHeight?: number;
}

export interface SplitLayoutTransform {
  clipId: string;
  cell: SplitLayoutCell;
  transform: Transform;
}

export const BUILT_IN_SPLIT_LAYOUTS: Record<SplitLayoutPresetId, SplitLayoutDefinition> = {
  'side-by-side': {
    id: 'side-by-side',
    name: 'Side by side',
    cells: [
      { x: 0, y: 0, width: 0.5, height: 1 },
      { x: 0.5, y: 0, width: 0.5, height: 1 }
    ]
  },
  stacked: {
    id: 'stacked',
    name: 'Stacked',
    cells: [
      { x: 0, y: 0, width: 1, height: 0.5 },
      { x: 0, y: 0.5, width: 1, height: 0.5 }
    ]
  },
  quad: {
    id: 'quad',
    name: 'Quad',
    cells: [
      { x: 0, y: 0, width: 0.5, height: 0.5 },
      { x: 0.5, y: 0, width: 0.5, height: 0.5 },
      { x: 0, y: 0.5, width: 0.5, height: 0.5 },
      { x: 0.5, y: 0.5, width: 0.5, height: 0.5 }
    ]
  },
  'three-columns': {
    id: 'three-columns',
    name: 'Three columns',
    cells: [
      { x: 0, y: 0, width: 1 / 3, height: 1 },
      { x: 1 / 3, y: 0, width: 1 / 3, height: 1 },
      { x: 2 / 3, y: 0, width: 1 / 3, height: 1 }
    ]
  },
  'main-side': {
    id: 'main-side',
    name: 'Main with side',
    cells: [
      { x: 0, y: 0, width: 2 / 3, height: 1 },
      { x: 2 / 3, y: 0, width: 1 / 3, height: 0.5 },
      { x: 2 / 3, y: 0.5, width: 1 / 3, height: 0.5 }
    ]
  }
};

export const SPLIT_LAYOUT_PRESET_IDS: SplitLayoutPresetId[] = ['side-by-side', 'stacked', 'quad', 'three-columns', 'main-side'];

export function getSplitLayoutDefinition(layoutId: SplitLayoutPresetId | string, customLayouts: SplitLayoutDefinition[] = []): SplitLayoutDefinition | undefined {
  return BUILT_IN_SPLIT_LAYOUTS[layoutId as SplitLayoutPresetId] ?? customLayouts.find((layout) => layout.id === layoutId);
}

export function calculateSplitLayoutTransforms(input: {
  layout: SplitLayoutDefinition;
  clips: SplitLayoutClipSource[];
  canvasWidth: number;
  canvasHeight: number;
}): SplitLayoutTransform[] {
  const canvasWidth = positiveDimension(input.canvasWidth);
  const canvasHeight = positiveDimension(input.canvasHeight);
  const cells = normalizeSplitLayoutCells(input.layout.cells);
  return input.clips.slice(0, cells.length).map((clip, index) => {
    const cell = cells[index];
    const sourceWidth = positiveDimension(clip.sourceWidth ?? canvasWidth);
    const sourceHeight = positiveDimension(clip.sourceHeight ?? canvasHeight);
    const scaleX = roundScale((cell.width * canvasWidth) / sourceWidth);
    const scaleY = roundScale((cell.height * canvasHeight) / sourceHeight);
    return {
      clipId: clip.clipId,
      cell,
      transform: {
        x: roundPixelOffset((cell.x + cell.width / 2) * canvasWidth - canvasWidth / 2),
        y: roundPixelOffset((cell.y + cell.height / 2) * canvasHeight - canvasHeight / 2),
        scale: roundScale((scaleX + scaleY) / 2),
        scaleX,
        scaleY,
        rotation: 0,
        opacity: 1
      }
    };
  });
}

export function createMainSideSplitLayout(id: string, name: string, mainRatio: number): SplitLayoutDefinition {
  const ratio = round(Math.min(0.8, Math.max(0.2, Number.isFinite(mainRatio) ? mainRatio : 2 / 3)));
  const sideRatio = round(1 - ratio);
  return {
    id: id.trim() || 'custom-main-side',
    name: name.trim() || 'Custom split',
    cells: [
      { x: 0, y: 0, width: ratio, height: 1 },
      { x: ratio, y: 0, width: sideRatio, height: 0.5 },
      { x: ratio, y: 0.5, width: sideRatio, height: 0.5 }
    ]
  };
}

export function normalizeSplitLayoutDefinition(layout: unknown, fallbackId = 'custom-split'): SplitLayoutDefinition | undefined {
  if (!layout || typeof layout !== 'object') {
    return undefined;
  }
  const input = layout as Partial<SplitLayoutDefinition>;
  const cells = normalizeSplitLayoutCells(input.cells);
  if (cells.length < 2) {
    return undefined;
  }
  return {
    id: typeof input.id === 'string' && input.id.trim() ? input.id.trim() : fallbackId,
    name: typeof input.name === 'string' && input.name.trim() ? input.name.trim() : 'Custom split',
    cells
  };
}

export function normalizeSplitLayoutCells(cells: unknown): SplitLayoutCell[] {
  if (!Array.isArray(cells)) {
    return [];
  }
  return cells.slice(0, 4).flatMap((cell): SplitLayoutCell[] => {
    if (!cell || typeof cell !== 'object') {
      return [];
    }
    const input = cell as Partial<SplitLayoutCell>;
    const x = clamp01(input.x);
    const y = clamp01(input.y);
    const width = round(Math.min(1 - x, Math.max(0.01, finiteOr(input.width, 0))));
    const height = round(Math.min(1 - y, Math.max(0.01, finiteOr(input.height, 0))));
    return width > 0 && height > 0 ? [{ x: round(x), y: round(y), width, height }] : [];
  });
}

function positiveDimension(value: number): number {
  return Math.max(1, Number.isFinite(value) ? value : 1);
}

function clamp01(value: unknown): number {
  return Math.min(1, Math.max(0, finiteOr(value, 0)));
}

function finiteOr(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function roundPixelOffset(value: number): number {
  const rounded = round(value, 3);
  return Math.abs(rounded) <= 0.001 ? 0 : rounded;
}

function roundScale(value: number): number {
  return round(value, 3);
}
