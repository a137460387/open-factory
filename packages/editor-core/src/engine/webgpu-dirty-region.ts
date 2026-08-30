/**
 * WebGPU 脏区域管理器
 * 批量合并脏区域以减少重绘次数
 */

import type { DirtyRegion } from './webgpu-types.js';

export class WebGPUDirtyRegionManager {
  private dirtyRegions: DirtyRegion[] = [];
  private batchTimeout: ReturnType<typeof setTimeout> | null = null;
  private readonly batchMs: number;

  constructor(batchMs = 8) {
    this.batchMs = batchMs;
  }

  addRegion(region: DirtyRegion): void {
    this.dirtyRegions.push(region);

    if (!this.batchTimeout) {
      this.batchTimeout = setTimeout(() => {
        this.flush();
      }, this.batchMs);
    }
  }

  addClipChange(x: number, y: number, width: number, height: number): void {
    this.addRegion({ x, y, width, height, reason: 'clip-change' });
  }

  addEffectUpdate(x: number, y: number, width: number, height: number): void {
    this.addRegion({ x, y, width, height, reason: 'effect-update' });
  }

  addTransform(x: number, y: number, width: number, height: number): void {
    this.addRegion({ x, y, width, height, reason: 'transform' });
  }

  addScroll(x: number, y: number, width: number, height: number): void {
    this.addRegion({ x, y, width, height, reason: 'scroll' });
  }

  addResize(x: number, y: number, width: number, height: number): void {
    this.addRegion({ x, y, width, height, reason: 'resize' });
  }

  flush(): DirtyRegion[] {
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
      this.batchTimeout = null;
    }

    const regions = this.mergeRegions(this.dirtyRegions);
    this.dirtyRegions = [];
    return regions;
  }

  hasDirtyRegions(): boolean {
    return this.dirtyRegions.length > 0;
  }

  clear(): void {
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
      this.batchTimeout = null;
    }
    this.dirtyRegions = [];
  }

  private mergeRegions(regions: DirtyRegion[]): DirtyRegion[] {
    if (regions.length <= 1) {
      return regions;
    }

    // Simple merge: combine all regions into a single bounding box
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const region of regions) {
      minX = Math.min(minX, region.x);
      minY = Math.min(minY, region.y);
      maxX = Math.max(maxX, region.x + region.width);
      maxY = Math.max(maxY, region.y + region.height);
    }

    return [
      {
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY,
        reason: regions[0].reason,
      },
    ];
  }
}
