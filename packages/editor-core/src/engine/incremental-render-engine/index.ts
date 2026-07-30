/**
 * Incremental render engine
 *
 * Core features:
 * 1. Diff rendering - only re-render modified regions
 * 2. Render task scheduling - background render queue
 * 3. Render progress estimation and completion notification
 * 4. Render priority management
 */

export type {
  RenderTaskStatus,
  RenderPriority,
  RenderTaskType,
  RenderRegion,
  RenderTask,
  RenderResult,
  RenderDiff,
  IncrementalRenderStats,
  IncrementalRenderConfig,
} from './types';

export { DEFAULT_INCREMENTAL_CONFIG } from './types';

export { RenderCacheManager } from './render-cache-manager';
export { DiffDetector } from './diff-detector';
export { RenderTaskScheduler } from './task-scheduler';
export { RenderProgressEstimator } from './progress-estimator';

export {
  IncrementalRenderEngine,
  createIncrementalRenderEngine,
  createRenderProgressEstimator,
} from './incremental-render-engine';
