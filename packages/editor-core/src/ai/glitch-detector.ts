/**
 * Glitch Detection Module
 *
 * Detects visual glitches in video using ffmpeg scene detection.
 * Identifies rapid scene changes, abrupt cuts, and visual anomalies.
 *
 * Uses ffmpeg's scdet filter under the hood via the Tauri bridge.
 */

/** A single detected glitch */
export interface GlitchItem {
  /** Time of the glitch in seconds */
  time: number;
  /** Frame number */
  frame: number;
  /** Type of glitch */
  glitchType: GlitchType;
  /** Severity (0-1) */
  severity: number;
}

/** Glitch type classification */
export type GlitchType = 'scene_cut' | 'rapid_scene_change';

/** Result of glitch detection */
export interface GlitchDetectionResult {
  /** Detected glitches */
  glitches: GlitchItem[];
  /** Duration analyzed in seconds */
  analyzedDuration: number;
  /** Whether analysis was limited to a time range */
  limited: boolean;
}

/** Configuration for glitch detection */
export interface GlitchDetectionConfig {
  /** Path to the video file */
  path: string;
  /** Scene detection threshold (0.1-1.0, default 0.3) */
  threshold?: number;
  /** Start time in seconds */
  startTime?: number;
  /** End time in seconds */
  endTime?: number;
  /** Video frame rate (default 30) */
  frameRate?: number;
  /** Task ID for cancellation */
  taskId?: string;
}

/** Default configuration */
export const DEFAULT_GLITCH_CONFIG: Required<Pick<GlitchDetectionConfig, 'threshold' | 'frameRate'>> = {
  threshold: 0.3,
  frameRate: 30,
};

/**
 * Validate glitch detection configuration.
 * Returns an array of error messages (empty if valid).
 */
export function validateGlitchConfig(config: GlitchDetectionConfig): string[] {
  const errors: string[] = [];

  if (!config.path || config.path.trim().length === 0) {
    errors.push('Video path is required.');
  }

  if (config.threshold !== undefined) {
    if (config.threshold < 0.1 || config.threshold > 1.0) {
      errors.push('Threshold must be between 0.1 and 1.0.');
    }
  }

  if (config.startTime !== undefined && config.startTime < 0) {
    errors.push('Start time must be non-negative.');
  }

  if (config.endTime !== undefined && config.endTime < 0) {
    errors.push('End time must be non-negative.');
  }

  if (config.startTime !== undefined && config.endTime !== undefined && config.endTime <= config.startTime) {
    errors.push('End time must be greater than start time.');
  }

  return errors;
}

/**
 * Merge glitch detection config with defaults.
 */
export function withGlitchDefaults(
  config: GlitchDetectionConfig,
): Required<Pick<GlitchDetectionConfig, 'path' | 'threshold' | 'frameRate'>> & Partial<GlitchDetectionConfig> {
  return {
    ...config,
    threshold: config.threshold ?? DEFAULT_GLITCH_CONFIG.threshold,
    frameRate: config.frameRate ?? DEFAULT_GLITCH_CONFIG.frameRate,
  };
}

/**
 * Group glitches by time proximity for timeline display.
 * Glitches within `windowSeconds` of each other are grouped together.
 */
export function groupGlitchesByProximity(glitches: GlitchItem[], windowSeconds = 2.0): GlitchItem[][] {
  if (glitches.length === 0) return [];

  const sorted = [...glitches].sort((a, b) => a.time - b.time);
  const groups: GlitchItem[][] = [[sorted[0]]];

  for (let i = 1; i < sorted.length; i++) {
    const lastGroup = groups[groups.length - 1];
    const lastTime = lastGroup[lastGroup.length - 1].time;
    if (sorted[i].time - lastTime <= windowSeconds) {
      lastGroup.push(sorted[i]);
    } else {
      groups.push([sorted[i]]);
    }
  }

  return groups;
}

/**
 * Calculate summary statistics for detected glitches.
 */
export function summarizeGlitches(glitches: GlitchItem[]): {
  total: number;
  byType: Record<GlitchType, number>;
  averageSeverity: number;
  maxSeverity: number;
} {
  const byType: Record<GlitchType, number> = {
    scene_cut: 0,
    rapid_scene_change: 0,
  };

  let severitySum = 0;
  let maxSeverity = 0;

  for (const glitch of glitches) {
    byType[glitch.glitchType] = (byType[glitch.glitchType] ?? 0) + 1;
    severitySum += glitch.severity;
    if (glitch.severity > maxSeverity) {
      maxSeverity = glitch.severity;
    }
  }

  return {
    total: glitches.length,
    byType,
    averageSeverity: glitches.length > 0 ? severitySum / glitches.length : 0,
    maxSeverity,
  };
}
