import { round } from './time';
import type { Transform } from './model';

export type PiPLayoutPosition = 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';

export interface PiPLayoutDimensions {
  canvasWidth: number;
  canvasHeight: number;
  sourceWidth: number;
  sourceHeight: number;
  scale?: number;
  margin?: number;
}

export interface PiPLayoutInput extends PiPLayoutDimensions {
  position: PiPLayoutPosition;
}

export const DEFAULT_PIP_SCALE = 0.25;
export const DEFAULT_PIP_MARGIN = 32;

export function calculatePiPTransform(input: PiPLayoutInput): Transform {
  const canvasWidth = positiveDimension(input.canvasWidth);
  const canvasHeight = positiveDimension(input.canvasHeight);
  const sourceWidth = positiveDimension(input.sourceWidth);
  const sourceHeight = positiveDimension(input.sourceHeight);
  const scale = clampScale(input.scale ?? DEFAULT_PIP_SCALE);
  const margin = Math.max(0, Number.isFinite(input.margin) ? input.margin! : DEFAULT_PIP_MARGIN);
  const pipWidth = sourceWidth * scale;
  const pipHeight = sourceHeight * scale;
  const leftCenter = margin + pipWidth / 2;
  const rightCenter = canvasWidth - margin - pipWidth / 2;
  const topCenter = margin + pipHeight / 2;
  const bottomCenter = canvasHeight - margin - pipHeight / 2;
  const centerX = input.position.endsWith('right') ? rightCenter : leftCenter;
  const centerY = input.position.startsWith('bottom') ? bottomCenter : topCenter;
  return {
    x: round(centerX - canvasWidth / 2),
    y: round(centerY - canvasHeight / 2),
    scale,
    scaleX: scale,
    scaleY: scale,
    rotation: 0,
    opacity: 1,
  };
}

export function createFullFrameTransform(): Transform {
  return {
    x: 0,
    y: 0,
    scale: 1,
    scaleX: 1,
    scaleY: 1,
    rotation: 0,
    opacity: 1,
  };
}

function positiveDimension(value: number): number {
  return Math.max(1, Number.isFinite(value) ? value : 1);
}

function clampScale(value: number): number {
  return round(Math.min(1, Math.max(0.01, Number.isFinite(value) ? value : DEFAULT_PIP_SCALE)));
}
