/**
 * Result type for SDK operations
 */
export type Result<T, E = Error> =
  | { ok: true; value: T }
  | { ok: false; error: E };

/**
 * Project configuration
 */
export interface ProjectConfig {
  name: string;
  width: number;
  height: number;
  fps: number;
  duration?: number;
}

/**
 * Timeline clip
 */
export interface TimelineClip {
  id: string;
  trackId: string;
  startTime: number;
  endTime: number;
  sourceId: string;
  metadata?: Record<string, unknown>;
}

/**
 * Track definition
 */
export interface Track {
  id: string;
  name: string;
  type: 'video' | 'audio' | 'subtitle';
  clips: TimelineClip[];
}

/**
 * Effect definition
 */
export interface Effect {
  id: string;
  name: string;
  type: string;
  params: Record<string, unknown>;
  startTime?: number;
  endTime?: number;
}

/**
 * Export configuration
 */
export interface ExportConfig {
  format: 'mp4' | 'webm' | 'mov' | 'avi';
  quality: 'low' | 'medium' | 'high' | 'ultra';
  resolution?: { width: number; height: number };
  fps?: number;
  outputPath: string;
}

/**
 * Export progress
 */
export interface ExportProgress {
  percent: number;
  currentFrame: number;
  totalFrames: number;
  eta: number;
}

/**
 * Plugin info
 */
export interface PluginInfo {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  enabled: boolean;
}

/**
 * SDK event types
 */
export type SDKEventType =
  | 'project:loaded'
  | 'project:saved'
  | 'timeline:changed'
  | 'effect:applied'
  | 'export:started'
  | 'export:progress'
  | 'export:completed'
  | 'export:error';

/**
 * SDK event
 */
export interface SDKEvent {
  type: SDKEventType;
  payload: unknown;
  timestamp: number;
}

/**
 * Event listener
 */
export type EventListener = (event: SDKEvent) => void;
