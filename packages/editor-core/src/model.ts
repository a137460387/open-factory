/**
 * Barrel re-export for model submodules.
 *
 * Submodules under ./model/ are organized by concern:
 *   defaults        - DEFAULT_* constants
 *   media-normalize - media normalization + type re-exports
 *   clip-normalize  - clip property normalization
 *   factories       - factory / creation functions
 *   track-timeline  - track, timeline, project-level normalization
 *   annotations     - annotations, collaboration, advanced features
 */

export * from './model/defaults';
export * from './model/media-normalize';
export * from './model/factories';
export * from './model/track-timeline';
export * from './model/clip-normalize';
export * from './model/annotations';

// ---------------------------------------------------------------------------
// Disambiguation: these names are exported by multiple submodules above.
// TypeScript silently excludes ambiguous `export *` names, so we re-export
// each one explicitly from a single authoritative source.
// ---------------------------------------------------------------------------

// factories vs track-timeline (track-timeline is authoritative)
export { normalizeTransform } from './model/track-timeline';
export { normalizeTrackVolume } from './model/track-timeline';
export { normalizeTrackPan } from './model/track-timeline';
export { normalizeSubtitleLanguage } from './model/track-timeline';
export { normalizeSubtitleTrackType } from './model/track-timeline';
export { normalizeTrackEQ } from './model/track-timeline';
export { normalizeTrackCompressor } from './model/track-timeline';
export { normalizeSequenceName } from './model/track-timeline';

// clip-normalize vs track-timeline (track-timeline is authoritative)
export { finiteOrDefault } from './model/track-timeline';
export { normalizeQualityEnhancement } from './model/track-timeline';

// clip-normalize vs annotations (clip-normalize is authoritative)
export { normalizeHexColor } from './model/clip-normalize';
export { normalizeLutLayers } from './lut-normalize';
export { cloneClipKeyframesLocal } from './model/clip-normalize';
export { normalizePrivacyRedactions } from './model/clip-normalize';
export { normalizeAILookMatch } from './model/clip-normalize';
export { normalizeAiPipSuggestion } from './model/clip-normalize';
export { normalizeFlashWarnings } from './model/clip-normalize';
