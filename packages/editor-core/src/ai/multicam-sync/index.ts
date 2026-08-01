/**
 * AI Multicam Intelligent Sync Module
 *
 * Features:
 * 1. Audio fingerprint sync - precise alignment based on audio fingerprints
 * 2. Visual feature sync - frame-level alignment based on visual features
 * 3. Content-aware switch suggestions - auto-generate switch points based on scene content
 * 4. Hybrid sync strategy - optimal sync combining multiple signals
 *
 * Deep integration with v4.37.0 multicam system
 * Local-first: all analysis runs locally, no cloud API dependency
 */

// Types
export type {
  AngleContentAnalysis,
  AudioFingerprint,
  ContentAnalysis,
  DriftInfo,
  ImageData,
  IntelligentSyncConfig,
  IntelligentSyncResult,
  MulticamSyncIntegration,
  SwitchReason,
  SwitchSuggestion,
  SyncMethod,
  SyncQuality,
  VisualFeature,
} from './types';

// Config
export { createDefaultIntelligentSyncConfig, validateIntelligentSyncConfig } from './config';

// Audio fingerprint
export { generateAudioFingerprint, syncByAudioFingerprint } from './audio-fingerprint';

// Visual sync
export { computeVisualSimilarity, extractVisualFeature, syncByVisualFeature } from './visual-sync';

// Hybrid sync
export { intelligentSync } from './hybrid-sync';

// Content analysis and switch suggestions
export { analyzeWindowContent, generateSwitchSuggestions } from './content-analysis';

// Integration
export { toIntegrationFormat } from './integration';
