/**
 * Diff detector for render regions
 */

import type { RenderRegion, RenderDiff } from './types';

export class DiffDetector {
  private previousRegions: Map<string, RenderRegion> = new Map();
  private previousFrame: number = -1;

  /**
   * Detect diff between current and previous regions
   */
  detectDiff(
    currentFrame: number,
    currentRegions: RenderRegion[],
    reason: string
  ): RenderDiff {
    const diff: RenderDiff = {
      regions: [],
      reason,
      affectedFrames: [currentFrame],
      priority: 'normal',
    };

    // If frame changed, render all regions
    if (currentFrame !== this.previousFrame) {
      diff.regions = currentRegions;
      diff.priority = 'high';
    } else {
      // Compare regions
      for (const region of currentRegions) {
        const key = this.regionToKey(region);
        const previous = this.previousRegions.get(key);

        if (!previous || this.regionsDifferent(previous, region)) {
          diff.regions.push(region);
        }
      }
    }

    // Update previous state
    this.previousRegions.clear();
    for (const region of currentRegions) {
      const key = this.regionToKey(region);
      this.previousRegions.set(key, { ...region });
    }
    this.previousFrame = currentFrame;

    return diff;
  }

  /**
   * Mark region as dirty
   */
  markDirty(region: RenderRegion, reason: string): RenderDiff {
    return {
      regions: [region],
      reason,
      affectedFrames: [],
      priority: 'normal',
    };
  }

  /**
   * Reset
   */
  reset(): void {
    this.previousRegions.clear();
    this.previousFrame = -1;
  }

  private regionToKey(region: RenderRegion): string {
    return `${region.x}_${region.y}_${region.width}_${region.height}`;
  }

  private regionsDifferent(a: RenderRegion, b: RenderRegion): boolean {
    return a.x !== b.x || a.y !== b.y || a.width !== b.width || a.height !== b.height;
  }
}
