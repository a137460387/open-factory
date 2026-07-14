import type { ComplexityDimensionScore } from '@open-factory/editor-core';

export interface ComplexityRadarPoint {
  id: string;
  x: number;
  y: number;
  value: number;
  angle: number;
}

export function calculateComplexityRadarPoints(
  dimensions: readonly ComplexityDimensionScore[],
  width: number,
  height: number,
  padding = 24,
): ComplexityRadarPoint[] {
  const centerX = width / 2;
  const centerY = height / 2;
  const radius = Math.max(1, Math.min(width, height) / 2 - padding);
  return dimensions.map((dimension, index) => {
    const angle = -Math.PI / 2 + (index / Math.max(1, dimensions.length)) * Math.PI * 2;
    const value = Math.min(100, Math.max(0, dimension.score)) / 100;
    return {
      id: dimension.id,
      value,
      angle,
      x: roundPoint(centerX + Math.cos(angle) * radius * value),
      y: roundPoint(centerY + Math.sin(angle) * radius * value),
    };
  });
}

export function buildComplexityRadarPolygon(points: readonly Pick<ComplexityRadarPoint, 'x' | 'y'>[]): string {
  return points.map((point) => `${point.x},${point.y}`).join(' ');
}

function roundPoint(value: number): number {
  return Math.round(value * 1000) / 1000;
}
