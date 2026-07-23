export * from './time';
export * from './model';
export { formatTime, formatTimeShort, formatDuration, formatDurationMs } from './utils/time';
export { clamp01, lerp } from './utils/math';
export * from './blend-modes';

// Disambiguation: normalizeHexColor is exported by both ./model and ./export/ffmpeg.
// The model version (clip-normalize) is authoritative for general use.
export { normalizeHexColor } from './model';
export * from './color-log-luts';
export * from './content-analysis';
export * from './cover-frames';
export * from './color-pipeline';
export * from './color-grading';
export * from './color-node-graph';
export * from './color-match';
export * from './color-analysis';
export * from './effects';
export * from './effect-presets';
export * from './audio-visualization-themes';
export * from './motion-blur';
export * from './motion-graphics';
export * from './thumbnail-scoring';
export * from './lut-creator';
export * from './timeline';
export * from './timeline-scripting';
export * from './timeline-heatmap';
export * from './timeline-minimap';
export * from './audio-pitch';
export * from './rhythm-analysis';
export * from './spatial-audio';
export * from './timeline-color-labels';
export * from './clip-groups';
export * from './timeline-compare';
export * from './media-filter';
export * from './media-folders';
export * from './media-versions';
export * from './media-fingerprint';
export * from './media-organizer';
export * from './media-batch';
export * from './keyframes';
export * from './easing-presets';
export * from './timeline-thumbnails';
export * from './timeline-protection';
export * from './render-cache';
export * from './timeline-snapping';
export * from './timeline-grid';
export * from './timeline-gap-fill';
export * from './timeline-gaps';
export * from './track-batch';
export * from './timeline-selection';
export * from './timeline-zoom';
export * from './timeline-ruler';
export * from './timeline-bookmarks';
export * from './timeline-bookmark-enhancements';
export * from './timeline-notes';
export * from './collaboration-notes';
export * from './collaboration';
export * from './collaboration/color-collaboration';
export * from './collaboration-permissions';
export * from './timeline-virtualization';
export * from './sync-compare';
export * from './sync/project-sync';
export * from './color/gpu-color-processing';
export * from './timeline-search';
export * from './timeline-feedback';
export * from './timeline-templates';
export * from './style-transfer';
export * from './smart-recommendations';
export * from './media-grouping';
export * from './touch-interaction';
export * from './operation-recording';
export * from './profiler';
export * from './audio-restoration';
export * from './complexity-score';
export * from './export-optimization-suggestions';
export * from './frame-search';
export * from './match-frame';
export * from './selection-prerender';
export * from './broadcast-compliance';
export * from './media-favorites';
export * from './scene-reorder';
export * from './vfr';
export * from './beats';
export * from './scene-cuts';
export * from './smart-rough-cut-v2';
export * from './smart-rough-cut-orchestrator';
export * from './smart-stutter-detection';
export * from './ai-scene-tagger';
export * from './storyboard';
export * from './canvas-transform';
export * from './masks/path-mask';
export * from './reframe';
export * from './title-templates';
export * from './video-stitching';
export * from './text-animation';
export * from './text-layout';
export * from './text-path';
export * from './credits-roll';
export * from './motion-tracking';
export * from './privacy-blur';
export * from './privacy-redaction';
export * from './ai-look-match';
export * from './ai-beat-snap';
export * from './ai-media-organize';
export * from './ai-scene-detector';
export * from './ai-emotion-analyzer';
export * from './ai-speech-understanding';
export * from './ai-narrative-analyzer';
export * from './ai-narrative-generator';
export * from './ai-smart-recommender';
export * from './ai-smart-creation-orchestrator';
export * from './multicam';
export * from './multicam-sync';
export * from './multicam-ai-cut';
export * from './multi-camera';
export * from './shake-analysis';
export * from './pip-avoidance';
export * from './platform-fit';
export * from './pip-layout';
export * from './split-layout';
export * from './commands/command';
export * from './commands/command-manager';
export * from './commands/timeline-commands';
export * from './export/ffmpeg';
export * from './export/transitions';
export * from './export/frame-interpolation';
export * from './export/frame-interpolation-preview';
export * from './color-management';
export * from './export/export-ranges';
export * from './export/quality';
export * from './export/preflight';
export * from './export/sequence-batch';
export * from './export/timeline-export';
export * from './export/timeline-import';
export * from './export/fcpxml-import';
export * from './export/render-farm';
export * from './export/cost-estimate';
export * from './export/progressive';
export * from './export/scheduling';
export * from './export/export-scheduler';
export * from './export/vmaf-monitoring';
export * from './export/resource-dashboard';
export * from './export/post-export-quality';
export * from './export/export-recovery';
export * from './export/pipeline';
export * from './export/publish-pipeline';
export * from './export/versioned-batch';
export * from './project/project-types';
export * from './project/project-migration';
export * from './project/documentation';
export * from './project/relative-paths';
export * from './project/relink-score';
export * from './project/batch-relink';
export * from './project/conform-media';
export * from './project/project-health-check';
export * from './project/project-health-repair';
export * from './project/media-health-dashboard';
export * from './project/duplicate-media';
export * from './project/media-report';
export * from './project/clip-report';
export * from './project/review-report';
export * from './project/release-workflow';
export * from './project/report-i18n';
export * from './project/media-precheck';
export * from './project/media-import-conflict';
export * from './project/project-templates';
export * from './project/project-speakers';
export * from './project/project-utils';
export * from './utils/file-utils';
export * from './cache/cache-types';
export * from './cache/cache-key';
export * from './proxy/proxy-types';
export * from './proxy/proxy-planner';
export * from './proxy/proxy-management';
export * from './audio/waveform';
export * from './audio/vu-meter';
export * from './audio/silence-detection';
export * from './audio/dialogue-detection';
export * from './audio/speaker-diarization';
export * from './audio/auto-audio-sync';
export * from './audio/ducking';
export * from './audio-envelope';
export * from './scopes/color-scopes';
export * from './subtitles/srt';
export * from './subtitles/line-break';
export * from './data-subtitle';
export * from './subtitles/translation';
export * from './subtitles/retiming';
export * from './subtitles/proofreading';
export * from './subtitles/data-import';
export * from './subtitles/style-templates';
export * from './media-file-sniff';
export * from './subtitles/spell-check';
export * from './export/export-notification';
export * from './export/export-preset-recommendations';
export * from './timeline-prerender';
export * from './audio-fade-curves';
export * from './media-tags';
export * from './batch-crop';
export * from './naming-template';
export * from './quick-actions';
export * from './duplicate-media-merge';
export * from './batch-media-replace';
export * from './subtitles/subtitle-style-quickbar';
export * from './subtitles/editor';
export * from './subtitles/style-presets';
export * from './subtitles/multi-language-export';
export * from './subtitles/canvas-renderer';
export * from './export/export-retry-strategy';
export * from './export/error-knowledge';
export * from './timeline-sequence-compare';
export * from './subtitles/sync-monitor';
export * from './proxy/proxy-batch-verify';

export * from './audio/multicam-audio-sync';
export * from './audio/mixer-types';
export * from './audio/effect-chain';
export * from './audio/audio-mix-presets';
export * from './audio/automation-evaluator';
export * from './audio/noise-reduction';
export * from './export/export-preset-diff';
export * from './export/preset-compatibility';
export * from './export/social-media-presets';
export * from './export/batch-render-actions';
export * from './annotation-sync';
export * from './audio-detach';
export * from './tag-learning';
export * from './project/template-sharing';
export * from './stress-test';
export * from './batch-export-script';
export * from './archive-encryption';
export * from './performance-monitor';
export * from './format-converter';
export * from './subtitles/emotion-analysis';
export * from './export/export-history-classifier';
export * from './distribution';
export * from './audio-scrub';
export * from './sequence-settings';
export * from './track-height';
export * from './ai-service';
export * from './ai-semantic-search';
export * from './ai-scene-match';
export * from './ai-subtitle-style';
export * from './ai-quality-assessment';
export * from './director-mode';

export * from './music-match';
export * from './highlight-reel';
export * from './contextual-translation';
export * from './ai-video-summary';
export * from './ai-narration';
export * from './ai-chat-editor';
export * from './ai-usage-stats';
export * from './ai-reframe';
export * from './ai-transition-recommend';
export * from './anomaly-detection';
export * from './subtitles/subtitle-speaker-diarization';
export * from './ai-denoise-recommendation';
export * from './ai-broll-suggestion';
export * from './ai-version-diff';
export * from './ai-loudness-suggestion';
export * from './flash-warning';
export * from './continuity-check';
export * from './music-structure';
export * from './subtitle-reading-speed';
export * from './ai-motion-type';
export * from './ai-color-consistency';
export * from './ai-sfx-match';
export * from './ai-pacing-analysis';
export * from './ai-character-timeline';
export * from './ai-preflight-checklist';
export * from './ai-emotion-tone';
export * from './ai-dubbing-adaptation';
export * from './ai-module-types';
export * from './algorithm-pipeline';
export * from './ai/transcription';
export * from './ai/scene-detection';
export * from './ai/smart-cut';
export * from './ai/auto-reframe';
export * from './plugins/plugin-types';
export * from './plugins/plugin-registry';
export * from './plugins/plugin-manager';
export * from './plugins/plugin-market-service';
export * from './ai/assist-editing';
export * from './ai/content-generation';
export * from './ai/quality-assessment';
export * from './ai/ai-worker';
export * from './ai/style-analyzer';
export * from './ai/suggestion-engine';
export * from './ai/style-panel';
export * from './ai/workflow-editor-panel';
export * from './ai/enhanced-dialogue-panel';
export * from './ai/template-adapter';
export * from './ai/rhythm-matcher';
export * from './ai/template-recommender';
export * from './automation';

// Sprint Z: AI Quality Inspector, Resource Manager, Performance Monitor
export * from './quality';
export * from './resources';
export * from './performance';

// Sprint AR: Immersive Creation Experience
export * from './engine/webgpu-render-engine';
export * from './engine/smart-proxy-manager';
export * from './engine/incremental-render-engine';
export * from './ui/zen-mode-manager';
export * from './ui/shortcut-manager';
export * from './ui/theme-engine';

// Sprint AS: Predictive AI Creation
export * from './visual-highlight-engine';
export {
  AudioRhythmConfig,
  DEFAULT_AUDIO_RHYTHM_CONFIG,
  SpectrumFrame,
  OnsetEvent,
  TempoEstimate,
  RhythmPattern,
  AudioRhythmResult,
  computeMagnitudes,
  applyHanningWindow,
  calculateBandEnergies,
  detectOnsets,
  estimateTempo,
  generateBeatTimes,
  classifyRhythmPattern,
  analyzeAudioRhythm,
  alignHighlightsWithRhythm,
} from './audio-rhythm-analysis';
export * from './natural-language-commands';
export {
  RoughCutConfig,
  DEFAULT_ROUGH_CUT_CONFIG,
  CutPoint,
  RoughCutSegment,
  RoughCutProposal,
  RoughCutResult,
  generateCutPoints,
  selectSegments,
  calculatePacingScore,
  calculateHighlightCoverage,
  generateRoughCutProposals,
} from './smart-rough-cut';
export * from './gesture-control';
export {
  SuggestionPriority,
  ContextualSuggestion,
  SuggestionConfig,
  DEFAULT_SUGGESTION_CONFIG,
  suggestTransition,
  suggestPacingFix,
  suggestAudioFix,
  suggestContentImprovement,
  suggestHighlightMark,
  generateContextualSuggestions,
  getSuggestionIcon,
} from './contextual-suggestions';
