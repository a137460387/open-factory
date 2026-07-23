/**
 * AI Style Engine
 *
 * Personal style learning and application system for video editing.
 * Analyzes user's editing patterns and color preferences to provide
 * intelligent recommendations.
 */

// Editing rhythm analysis
export {
  analyzeEditingStyle,
  compareEditingStyles,
  parseEDLEntries,
  calculateShotDurationStats,
  calculateTransitionDistribution,
  analyzeRhythmPattern,
  calculateEditingPace,
  calculateRhythmConsistency,
  generateStyleVector,
  type EditDecisionEntry,
  type EditingRhythmProfile,
  type RhythmPattern,
  type EditingStyleVector,
  type EDLAnalysisResult,
} from './edit-rhythm-analyzer';

// Color preference learning
export {
  analyzeColorPreferences,
  compareColorProfiles,
  extractColorParams,
  extractPresetParams,
  calculateLutDistribution,
  calculateColorTemperatureStats,
  calculateContrastStats,
  calculateSaturationStats,
  clusterColorStyles,
  generatePreferenceVector,
  type ColorGradingParams,
  type ColorStyleCluster,
  type ColorPreferenceProfile,
  type ColorAnalysisResult,
} from './color-preference-learner';

// Style model management
export {
  createStyleModel,
  applyStyleToProject,
  compareStyleModels,
  findMatchingCluster,
  generateStyleNodeData,
  LocalStyleModelStorage,
  createDefaultStorage,
  type PersonalStyleModel,
  type StyleSummary,
  type EditPointRecommendation,
  type ColorGradingRecommendation,
  type StyleApplicationResult,
  type StyleModelStorage,
} from './style-model-manager';
