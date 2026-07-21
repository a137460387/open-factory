/**
 * Headless module barrel export.
 */

export { HeadlessEditorCore, DEFAULT_HEADLESS_CONFIG } from './headless-editor-core';
export type {
  HeadlessConfig,
  HeadlessExportSettings,
  HeadlessRenderRequest,
  HeadlessRenderResult,
  HeadlessProgress,
  HeadlessAnalyzeRequest,
  HeadlessAnalyzeResult,
  QualityReport,
  QualityIssue,
  SemanticReport,
  SceneInfo,
  ComplianceReport,
  ComplianceCheck,
  FullReport,
} from './headless-editor-core';

export { headlessRender, executeFfmpegRender, parseFfmpegProgress } from './headless-renderer';

export {
  headlessAnalyze,
  analyzeQuality,
  analyzeSemantic,
  analyzeCompliance,
  analyzeFull,
  probeVideo,
  measureLoudness,
} from './headless-analyzer';

export { applyTemplate, loadTemplate } from './template-apply';
export type { TemplateApplyRequest, TemplateApplyResult, TemplateDefinition, MediaSlot } from './template-apply';
