/**
 * Render progress estimator based on historical data
 */

import type { RenderTaskType, RenderRegion, RenderTask } from './types';

export class RenderProgressEstimator {
  private history: Map<RenderTaskType, number[]> = new Map();
  private readonly maxHistorySize: number = 100;

  /**
   * Record render time
   */
  recordRenderTime(type: RenderTaskType, durationMs: number): void {
    if (!this.history.has(type)) {
      this.history.set(type, []);
    }

    const times = this.history.get(type)!;
    times.push(durationMs);

    if (times.length > this.maxHistorySize) {
      times.shift();
    }
  }

  /**
   * Estimate render time
   */
  estimateRenderTime(type: RenderTaskType, region: RenderRegion): number {
    const times = this.history.get(type);
    if (!times || times.length === 0) {
      return this.getDefaultEstimate(type, region);
    }

    // Calculate average
    const avg = times.reduce((a, b) => a + b, 0) / times.length;

    // Scale by region size
    const pixelCount = region.width * region.height;
    const scaleFactor = pixelCount / (1920 * 1080); // Relative to 1080p

    return avg * scaleFactor;
  }

  /**
   * Estimate remaining time
   */
  estimateRemainingTime(tasks: RenderTask[]): number {
    let totalMs = 0;

    for (const task of tasks) {
      if (task.status === 'completed' || task.status === 'cancelled') {
        continue;
      }

      if (task.status === 'rendering' && task.progress > 0) {
        // Partial progress
        const elapsed = task.actualDurationMs || 0;
        const estimated = this.estimateRenderTime(task.type, task.region);
        totalMs += estimated * (1 - task.progress);
      } else {
        // Not started
        totalMs += this.estimateRenderTime(task.type, task.region);
      }
    }

    return totalMs;
  }

  /**
   * Get default estimate
   */
  private getDefaultEstimate(type: RenderTaskType, region: RenderRegion): number {
    const pixelCount = region.width * region.height;
    const baseMs = pixelCount / 1000000; // 1ms per megapixel

    switch (type) {
      case 'frame':
        return baseMs * 10;
      case 'effect':
        return baseMs * 20;
      case 'transition':
        return baseMs * 30;
      case 'export':
        return baseMs * 50;
      case 'thumbnail':
        return baseMs * 5;
      default:
        return baseMs * 10;
    }
  }

  /**
   * Reset history
   */
  reset(): void {
    this.history.clear();
  }
}
