/**
 * Macro Recording & Playback Types
 *
 * Defines the type system for macro operations, including
 * operation types, macro file format, and parameterized macros.
 */

// ─── Macro Operation Types ─────────────────────────────────────────────────

/** Supported macro operation types */
export type MacroOperationType =
  | 'clip.trim'
  | 'clip.split'
  | 'clip.delete'
  | 'clip.move'
  | 'clip.duplicate'
  | 'clip.speed'
  | 'clip.color.correct'
  | 'clip.color.wheel'
  | 'clip.color.curves'
  | 'clip.color.lut'
  | 'clip.effect.add'
  | 'clip.effect.remove'
  | 'clip.effect.param'
  | 'clip.transform'
  | 'clip.audio.volume'
  | 'clip.audio.fade'
  | 'clip.audio.denoise'
  | 'track.add'
  | 'track.delete'
  | 'track.rename'
  | 'transition.add'
  | 'transition.remove'
  | 'marker.add'
  | 'marker.remove'
  | 'subtitle.add'
  | 'subtitle.edit';

// ─── Macro Operation ───────────────────────────────────────────────────────

/** Single macro operation with parameters */
export interface MacroOperation {
  id: string;
  type: MacroOperationType;
  timestamp: number;
  /** Target entity ID (clip, track, etc.) */
  targetId: string;
  /** Operation parameters - type varies by operation type */
  params: Record<string, unknown>;
  /** Previous state for undo support */
  previousState?: Record<string, unknown>;
}

// ─── Parameterized Macro ───────────────────────────────────────────────────

/** Parameter definition for parameterized macros */
export interface MacroParameter {
  id: string;
  name: string;
  type: 'number' | 'string' | 'boolean' | 'color' | 'select';
  defaultValue: unknown;
  min?: number;
  max?: number;
  step?: number;
  options?: Array<{ label: string; value: unknown }>;
  description?: string;
}

/** Macro file format */
export interface MacroDefinition {
  id: string;
  name: string;
  description: string;
  version: string;
  createdAt: string;
  updatedAt: string;
  author?: string;
  tags: string[];
  /** Parameters that can be adjusted before playback */
  parameters: MacroParameter[];
  /** Recorded operations */
  operations: MacroOperation[];
  /** Duration in milliseconds */
  duration: number;
  /** Number of times this macro has been executed */
  executionCount: number;
}

// ─── Macro Execution ───────────────────────────────────────────────────────

/** Macro execution status */
export type MacroExecutionStatus = 'idle' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';

/** Macro execution progress */
export interface MacroExecutionProgress {
  status: MacroExecutionStatus;
  currentOperationIndex: number;
  totalOperations: number;
  currentOperationType?: MacroOperationType;
  startedAt?: number;
  estimatedTimeRemaining?: number;
  error?: string;
}

/** Macro execution options */
export interface MacroExecutionOptions {
  /** Override parameter values */
  parameterOverrides?: Record<string, unknown>;
  /** Target clip IDs to apply macro to */
  targetClipIds?: string[];
  /** Execute in dry-run mode (no actual changes) */
  dryRun?: boolean;
  /** Playback speed multiplier */
  speed?: number;
}

// ─── Macro Recording State ─────────────────────────────────────────────────

/** Macro recording state */
export type MacroRecordingState = 'idle' | 'recording' | 'paused';

/** Macro recorder configuration */
export interface MacroRecorderConfig {
  /** Maximum number of operations to record */
  maxOperations?: number;
  /** Debounce time in milliseconds for rapid operations */
  debounceMs?: number;
  /** Operations to ignore during recording */
  ignoreOperations?: MacroOperationType[];
  /** Auto-stop recording after inactivity (ms) */
  inactivityTimeout?: number;
}

// ─── Macro Storage ─────────────────────────────────────────────────────────

/** Macro library for storage */
export interface MacroLibrary {
  macros: MacroDefinition[];
  categories: MacroCategory[];
  lastModified: string;
}

/** Macro category */
export interface MacroCategory {
  id: string;
  name: string;
  description?: string;
  macroIds: string[];
}

// ─── Operation Parameter Schemas ────────────────────────────────────────────

/** Trim operation parameters */
export interface ClipTrimParams {
  trimStart?: number;
  trimEnd?: number;
}

/** Split operation parameters */
export interface ClipSplitParams {
  splitTime: number;
}

/** Color correction parameters */
export interface ColorCorrectParams {
  brightness?: number;
  contrast?: number;
  saturation?: number;
  hue?: number;
}

/** Speed change parameters */
export interface SpeedChangeParams {
  speed: number;
  keepPitch?: boolean;
}

/** Volume adjustment parameters */
export interface VolumeAdjustParams {
  volume: number;
  fadeIn?: number;
  fadeOut?: number;
}

/** Effect parameters */
export interface EffectParams {
  effectId: string;
  effectName: string;
  parameters: Record<string, unknown>;
}
