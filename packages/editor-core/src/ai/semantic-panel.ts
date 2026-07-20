/**
 * AI Semantic Analysis Panel
 *
 * Data layer for the "AI Material Analysis" UI panel.
 * Manages extraction state, progress tracking, and result presentation.
 *
 * Designed to be consumed by any frontend framework (React, Vue, Svelte, etc.)
 */

import type { MaterialMetadata, ExtractionConfig, ExtractionProgressEvent, KeyFrame, ASRSegment } from '../ai/semantic-extractor';
import { createDefaultExtractionConfig, validateExtractionConfig } from '../ai/semantic-extractor';

// ─── Panel State ────────────────────────────────────────────────

export type SemanticPanelPhase =
  | 'idle'
  | 'configuring'
  | 'extracting'
  | 'complete'
  | 'error';

export interface SemanticPanelState {
  /** Current phase */
  phase: SemanticPanelPhase;
  /** Extraction config */
  config: Required<ExtractionConfig>;
  /** Current progress event */
  progress?: ExtractionProgressEvent;
  /** Extraction result metadata */
  metadata?: MaterialMetadata;
  /** Extraction warnings */
  warnings: string[];
  /** Error message if phase is error */
  error?: string;
  /** Selected key frame index for preview */
  selectedKeyFrameIndex?: number;
  /** Search/filter query for ASR segments */
  transcriptFilter: string;
  /** Visible tag set (for overflow) */
  expandedTags: boolean;
}

export function createInitialPanelState(): SemanticPanelState {
  return {
    phase: 'idle',
    config: createDefaultExtractionConfig(),
    warnings: [],
    transcriptFilter: '',
    expandedTags: false,
  };
}

// ─── Panel Actions ──────────────────────────────────────────────

export type SemanticPanelAction =
  | { type: 'START_EXTRACTION' }
  | { type: 'UPDATE_PROGRESS'; event: ExtractionProgressEvent }
  | { type: 'EXTRACTION_COMPLETE'; metadata: MaterialMetadata; warnings: string[] }
  | { type: 'EXTRACTION_ERROR'; error: string }
  | { type: 'UPDATE_CONFIG'; config: Partial<ExtractionConfig> }
  | { type: 'SELECT_KEY_FRAME'; index: number | undefined }
  | { type: 'SET_TRANSCRIPT_FILTER'; query: string }
  | { type: 'TOGGLE_TAGS_EXPANDED' }
  | { type: 'RESET' };

/**
 * Pure state reducer for the semantic analysis panel.
 * Follows immutable update patterns.
 */
export function semanticPanelReducer(
  state: SemanticPanelState,
  action: SemanticPanelAction
): SemanticPanelState {
  switch (action.type) {
    case 'START_EXTRACTION': {
      const errors = validateExtractionConfig(state.config);
      if (errors.length > 0) {
        return { ...state, phase: 'error', error: errors.map(e => e.message).join('; ') };
      }
      return { ...state, phase: 'extracting', progress: undefined, metadata: undefined, warnings: [], error: undefined };
    }

    case 'UPDATE_PROGRESS':
      return { ...state, progress: action.event };

    case 'EXTRACTION_COMPLETE':
      return { ...state, phase: 'complete', metadata: action.metadata, warnings: action.warnings, progress: undefined };

    case 'EXTRACTION_ERROR':
      return { ...state, phase: 'error', error: action.error, progress: undefined };

    case 'UPDATE_CONFIG':
      return { ...state, config: { ...state.config, ...action.config } };

    case 'SELECT_KEY_FRAME':
      return { ...state, selectedKeyFrameIndex: action.index };

    case 'SET_TRANSCRIPT_FILTER':
      return { ...state, transcriptFilter: action.query };

    case 'TOGGLE_TAGS_EXPANDED':
      return { ...state, expandedTags: !state.expandedTags };

    case 'RESET':
      return createInitialPanelState();

    default:
      return state;
  }
}

// ─── Selectors ──────────────────────────────────────────────────

/** Get filtered ASR segments based on transcript filter */
export function getFilteredSegments(state: SemanticPanelState): ASRSegment[] {
  if (!state.metadata) return [];
  if (!state.transcriptFilter) return state.metadata.asrSegments;

  const query = state.transcriptFilter.toLowerCase();
  return state.metadata.asrSegments.filter(seg =>
    seg.text.toLowerCase().includes(query)
  );
}

/** Get the currently selected key frame */
export function getSelectedKeyFrame(state: SemanticPanelState): KeyFrame | undefined {
  if (!state.metadata || state.selectedKeyFrameIndex === undefined) return undefined;
  return state.metadata.keyFrames[state.selectedKeyFrameIndex];
}

/** Get display-friendly progress percentage */
export function getProgressPercent(state: SemanticPanelState): number {
  if (state.phase === 'complete') return 100;
  if (state.phase === 'idle' || state.phase === 'configuring') return 0;
  return state.progress?.progress ?? 0;
}

/** Get progress phase display label */
export function getProgressLabel(state: SemanticPanelState): string {
  if (state.phase === 'idle') return 'Ready';
  if (state.phase === 'configuring') return 'Configure';
  if (state.phase === 'complete') return 'Complete';
  if (state.phase === 'error') return 'Error';

  switch (state.progress?.phase) {
    case 'keyframes': return 'Extracting key frames...';
    case 'preview': return 'Generating previews...';
    case 'asr': return 'Transcribing audio...';
    case 'visual': return 'Analyzing visuals...';
    case 'aggregation': return 'Building metadata...';
    default: return 'Processing...';
  }
}

/** Get metadata summary stats for display */
export function getMetadataStats(metadata: MaterialMetadata): {
  keyFrameCount: number;
  segmentCount: number;
  wordCount: number;
  tagCount: number;
  duration: string;
  uploadSize: string;
} {
  const wordCount = metadata.transcriptText
    .split(/\s+/)
    .filter(Boolean).length;

  const durationMin = Math.floor(metadata.source.durationSec / 60);
  const durationSec = Math.floor(metadata.source.durationSec % 60);
  const duration = `${durationMin}:${durationSec.toString().padStart(2, '0')}`;

  // Rough upload size estimate
  const jsonSize = JSON.stringify(metadata).length;
  const uploadKB = Math.round(jsonSize / 1024);
  const uploadSize = uploadKB > 1024 ? `${(uploadKB / 1024).toFixed(1)}MB` : `${uploadKB}KB`;

  return {
    keyFrameCount: metadata.keyFrames.length,
    segmentCount: metadata.asrSegments.length,
    wordCount,
    tagCount: metadata.tags.length,
    duration,
    uploadSize,
  };
}
