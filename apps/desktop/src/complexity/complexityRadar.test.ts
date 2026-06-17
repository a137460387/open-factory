import { describe, expect, it } from 'vitest';
import { calculateComplexityRadarPoints, buildComplexityRadarPolygon } from './complexityRadar';
import type { ComplexityDimensionScore } from '@open-factory/editor-core';

describe('complexity radar geometry', () => {
  it('maps dimension scores to radar points around the canvas center', () => {
    const dimensions = ['timelineDensity', 'effectComplexity', 'colorDepth', 'audioComplexity', 'keyframeDensity'].map(
      (id, index) =>
        ({
          id,
          score: (index + 1) * 20,
          weight: 0.2,
          rawValue: 0,
          detail: ''
        }) as ComplexityDimensionScore
    );

    const points = calculateComplexityRadarPoints(dimensions, 200, 200, 20);

    expect(points).toHaveLength(5);
    expect(points[0]).toMatchObject({ id: 'timelineDensity', x: 100, y: 84, value: 0.2 });
    expect(points[4].value).toBe(1);
    expect(buildComplexityRadarPolygon(points)).toContain('100,84');
  });
});
