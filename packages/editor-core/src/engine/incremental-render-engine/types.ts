/**
 * Type definitions for the incremental render engine
 */

/** Render task status */
export type RenderTaskStatus = 'pending' | 'queued' | 'rendering' | 'completed' | 'failed' | 'cancelled';

/** Render priority */
export type RenderPriority = 'low' | 'normal' | 'high' | 'critical';

/** Render task type */
export type RenderTaskType = 'frame' | 'effect' | 'transition' | 'export' | 'thumbnail';

/** Render region */
export interface RenderRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Render task */
export interface RenderTask {
  id: string;
  type: RenderTaskType;
  priority: RenderPriority;
  status: RenderTaskStatus;
  region: RenderRegion;
  frame: number;
  timestamp: number;
  estimatedDurationMs: number;
  actualDurationMs: number;
  progress: number; // 0-1
  dependencies: string[]; // task IDs
  result?: RenderResult;
  error?: Error;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
}

/** Render result */
export interface RenderResult {
  taskId: string;
  frame: number;
  region: RenderRegion;
  texture?: GPUTexture;
  bitmap?: ImageBitmap;
  renderTimeMs: number;
  fromCache: boolean;
  cacheKey?: string;
}

/** Render diff */
export interface RenderDiff {
  regions: RenderRegion[];
  reason: string;
  affectedFrames: number[];
  priority: RenderPriority;
}

/** Render stats */
export interface IncrementalRenderStats {
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  cancelledTasks: number;
  averageRenderTimeMs: number;
  cacheHitRate: number;
  queueLength: number;
  activeRenderers: number;
  framesRendered: number;
  regionsRendered: number;
}

/** Renderer config */
export interface IncrementalRenderConfig {
  /** Max concurrent renders */
  maxConcurrentRenders: number;
  /** Max queue length */
  maxQueueLength: number;
  /** Enable diff rendering */
  enableDiffRendering: boolean;
  /** Enable render cache */
  enableRenderCache: boolean;
  /** Render cache size (MB) */
  renderCacheSizeMB: number;
  /** Render timeout (ms) */
  renderTimeoutMs: number;
  /** Enable background rendering */
  enableBackgroundRendering: boolean;
  /** Background render FPS */
  backgroundRenderFPS: number;
  /** Render quality */
  renderQuality: 'low' | 'medium' | 'high' | 'ultra';
}

/** Default config */
export const DEFAULT_INCREMENTAL_CONFIG: IncrementalRenderConfig = {
  maxConcurrentRenders: 4,
  maxQueueLength: 100,
  enableDiffRendering: true,
  enableRenderCache: true,
  renderCacheSizeMB: 512,
  renderTimeoutMs: 30000,
  enableBackgroundRendering: true,
  backgroundRenderFPS: 30,
  renderQuality: 'high',
};
