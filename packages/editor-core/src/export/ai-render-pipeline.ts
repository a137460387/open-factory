/**
 * AI Render Pipeline
 *
 * Integrates AI enhancement operations with the FFmpeg export pipeline.
 * Supports non-destructive processing, preset management, and real-time preview.
 */

import type { ExportSettings, ExportClip, FfmpegExportPlan } from './export-types';
import type { AiModuleResult } from '../ai-module-types';

// AI Enhancement Types
export type AIEnhancementType =
  | 'super-resolution'
  | 'denoise'
  | 'color-grade'
  | 'stabilization'
  | 'frame-interpolation'
  | 'style-transfer'
  | 'background-removal'
  | 'object-detection';

export interface AIEnhancementConfig {
  type: AIEnhancementType;
  enabled: boolean;
  strength: number; // 0-1
  model?: string;
  params?: Record<string, unknown>;
}

export interface AIPreset {
  id: string;
  name: string;
  description: string;
  enhancements: AIEnhancementConfig[];
  createdAt: number;
  updatedAt: number;
}

export interface AIRenderProgress {
  phase: 'preprocessing' | 'ai-processing' | 'postprocessing' | 'encoding';
  percent: number;
  currentFrame: number;
  totalFrames: number;
  estimatedTimeRemaining: number; // milliseconds
  enhancementType?: AIEnhancementType;
}

export interface AIRenderResult {
  success: boolean;
  outputPath: string;
  originalPath: string;
  processingTime: number;
  enhancementsApplied: AIEnhancementType[];
  error?: string;
}

// Pipeline Integration Types
export interface AIRenderPipelineConfig {
  enhancements: AIEnhancementConfig[];
  outputFormat: 'intermediate' | 'final';
  preserveOriginal: boolean;
  gpuAcceleration: boolean;
  maxConcurrency: number;
}

export interface AIRenderPipelineState {
  status: 'idle' | 'preparing' | 'processing' | 'completed' | 'error';
  progress: AIRenderProgress;
  intermediateFiles: string[];
  result?: AIRenderResult;
}

// Default configurations
const DEFAULT_ENHANCEMENT_CONFIG: AIEnhancementConfig = {
  type: 'denoise',
  enabled: false,
  strength: 0.5,
};

const DEFAULT_PIPELINE_CONFIG: AIRenderPipelineConfig = {
  enhancements: [],
  outputFormat: 'intermediate',
  preserveOriginal: true,
  gpuAcceleration: true,
  maxConcurrency: 2,
};

// Preset Management
const PRESET_STORAGE_KEY = 'ai-render-presets';

export function createAIPreset(
  name: string,
  description: string,
  enhancements: AIEnhancementConfig[],
): AIPreset {
  return {
    id: generatePresetId(),
    name,
    description,
    enhancements: enhancements.map((e) => ({ ...e })),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

export function saveAIPreset(preset: AIPreset): AiModuleResult<AIPreset> {
  try {
    const presets = loadAllAIPresets();
    const existingIndex = presets.findIndex((p) => p.id === preset.id);

    const updatedPreset = { ...preset, updatedAt: Date.now() };

    if (existingIndex >= 0) {
      presets[existingIndex] = updatedPreset;
    } else {
      presets.push(updatedPreset);
    }

    localStorage.setItem(PRESET_STORAGE_KEY, JSON.stringify(presets));

    return { data: updatedPreset, error: null };
  } catch (error) {
    return {
      data: preset,
      error: error instanceof Error ? error.message : 'Failed to save preset',
    };
  }
}

export function loadAIPreset(presetId: string): AiModuleResult<AIPreset | null> {
  try {
    const presets = loadAllAIPresets();
    const preset = presets.find((p) => p.id === presetId) ?? null;

    return { data: preset, error: null };
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error.message : 'Failed to load preset',
    };
  }
}

export function loadAllAIPresets(): AIPreset[] {
  try {
    const stored = localStorage.getItem(PRESET_STORAGE_KEY);
    if (!stored) return [];

    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];

    return parsed.filter(isValidPreset);
  } catch {
    return [];
  }
}

export function deleteAIPreset(presetId: string): AiModuleResult<boolean> {
  try {
    const presets = loadAllAIPresets();
    const filtered = presets.filter((p) => p.id !== presetId);

    localStorage.setItem(PRESET_STORAGE_KEY, JSON.stringify(filtered));

    return { data: true, error: null };
  } catch (error) {
    return {
      data: false,
      error: error instanceof Error ? error.message : 'Failed to delete preset',
    };
  }
}

// Pipeline Construction
export function buildAIRenderPipeline(
  settings: ExportSettings,
  clips: ExportClip[],
  config: Partial<AIRenderPipelineConfig> = {},
): AIRenderPipelineConfig {
  const mergedConfig = { ...DEFAULT_PIPELINE_CONFIG, ...config };

  // Filter clips that can benefit from AI enhancement
  const enhancableClips = clips.filter((clip) => canEnhanceClip(clip, mergedConfig.enhancements));

  if (enhancableClips.length === 0) {
    return { ...mergedConfig, enhancements: [] };
  }

  return mergedConfig;
}

export function integrateAIWithFFmpegPlan(
  basePlan: FfmpegExportPlan,
  aiConfig: AIRenderPipelineConfig,
  clips: ExportClip[],
): FfmpegExportPlan {
  if (aiConfig.enhancements.length === 0) {
    return basePlan;
  }

  // Build AI pre-processing filters
  const aiFilters = buildAIFilters(aiConfig, clips);

  if (aiFilters.length === 0) {
    return basePlan;
  }

  // Integrate AI filters into the FFmpeg filter graph
  return {
    ...basePlan,
    filterComplex: mergeAIFiltersIntoGraph(basePlan.filterComplex, aiFilters),
    warnings: [
      ...basePlan.warnings,
      `AI enhancements applied: ${aiConfig.enhancements.filter((e) => e.enabled).map((e) => e.type).join(', ')}`,
    ],
  };
}

// AI Filter Generation
function buildAIFilters(
  config: AIRenderPipelineConfig,
  clips: ExportClip[],
): string[] {
  const filters: string[] = [];

  for (const enhancement of config.enhancements) {
    if (!enhancement.enabled) continue;

    const filter = generateFFmpegFilter(enhancement, clips);
    if (filter) {
      filters.push(filter);
    }
  }

  return filters;
}

function generateFFmpegFilter(
  enhancement: AIEnhancementConfig,
  clips: ExportClip[],
): string | null {
  switch (enhancement.type) {
    case 'super-resolution':
      return buildSuperResolutionFilter(enhancement);
    case 'denoise':
      return buildDenoiseFilter(enhancement);
    case 'color-grade':
      return buildColorGradeFilter(enhancement);
    case 'stabilization':
      return buildStabilizationFilter(enhancement);
    case 'frame-interpolation':
      return buildFrameInterpolationFilter(enhancement);
    case 'style-transfer':
      return buildStyleTransferFilter(enhancement);
    case 'background-removal':
      return buildBackgroundRemovalFilter(enhancement);
    case 'object-detection':
      return buildObjectDetectionFilter(enhancement);
    default:
      return null;
  }
}

function buildSuperResolutionFilter(config: AIEnhancementConfig): string {
  const strength = Math.round(config.strength * 4); // 1x to 4x upscale
  return `scale=iw*${strength}:ih*${strength}:flags=lanczos`;
}

function buildDenoiseFilter(config: AIEnhancementConfig): string {
  const strength = config.strength;
  if (strength < 0.3) return 'hqdn3d=2:2:2:2';
  if (strength < 0.7) return 'hqdn3d=4:4:4:4';
  return 'nlmeans=s=6:p=3';
}

function buildColorGradeFilter(config: AIEnhancementConfig): string {
  const intensity = config.strength;
  return `eq=contrast=${1 + intensity * 0.3}:brightness=${intensity * 0.05}:saturation=${1 + intensity * 0.4}`;
}

function buildStabilizationFilter(config: AIEnhancementConfig): string {
  const shakiness = Math.round((1 - config.strength) * 10);
  return `vidstabdetect=shakiness=${shakiness}:result=-`;
}

function buildFrameInterpolationFilter(config: AIEnhancementConfig): string {
  const fps = config.params?.targetFps ?? 60;
  return `minterpolate=fps=${fps}:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1`;
}

function buildStyleTransferFilter(config: AIEnhancementConfig): string {
  // Style transfer requires external model, placeholder for now
  const modelPath = config.params?.modelPath;
  if (!modelPath) return '';
  return `nltransform=model=${modelPath}:strength=${config.strength}`;
}

function buildBackgroundRemovalFilter(config: AIEnhancementConfig): string {
  // Background removal requires segmentation model
  return `alphareplace=colorkey=0x00FF00:similarity=0.3:blend=${config.strength}`;
}

function buildObjectDetectionFilter(config: AIEnhancementConfig): string {
  // Object detection is typically metadata, not a visual filter
  return '';
}

// Filter Graph Integration
function mergeAIFiltersIntoGraph(
  existingGraph: string,
  aiFilters: string[],
): string {
  if (aiFilters.length === 0) return existingGraph;

  // Insert AI filters before final output
  const aiFilterChain = aiFilters.join(',');

  if (!existingGraph) return aiFilterChain;

  // Find the last output pad and insert AI filters before it
  const lastOutputMatch = existingGraph.match(/\[([^\]]+)\]$/);
  if (lastOutputMatch) {
    const outputPad = lastOutputMatch[1];
    const graphWithoutLast = existingGraph.slice(0, -lastOutputMatch[0].length);
    return `${graphWithoutLast},${aiFilterChain}[ai_out];[ai_out]${lastOutputMatch[0]}`;
  }

  return `${existingGraph},${aiFilterChain}`;
}

// Non-Destructive Processing
export function createNonDestructiveWorkflow(
  originalPath: string,
  enhancements: AIEnhancementConfig[],
): { intermediatePath: string; workflow: string[] } {
  const intermediatePath = generateIntermediatePath(originalPath);
  const workflow: string[] = [];

  workflow.push(`Input: ${originalPath}`);
  workflow.push(`Intermediate: ${intermediatePath}`);

  for (const enhancement of enhancements) {
    if (enhancement.enabled) {
      workflow.push(`Apply ${enhancement.type} (strength: ${enhancement.strength})`);
    }
  }

  workflow.push(`Output: Final render`);

  return { intermediatePath, workflow };
}

// Preview Support
export function buildPreviewCommand(
  sourcePath: string,
  timeRange: { start: number; end: number },
  enhancements: AIEnhancementConfig[],
): string {
  const filters = enhancements
    .filter((e) => e.enabled)
    .map((e) => generateFFmpegFilter(e, []))
    .filter(Boolean)
    .join(',');

  const duration = timeRange.end - timeRange.start;

  return [
    'ffmpeg',
    `-ss ${timeRange.start}`,
    `-t ${duration}`,
    `-i "${sourcePath}"`,
    filters ? `-vf "${filters}"` : '',
    '-frames:v 1',
    '-f image2',
    'preview.jpg',
  ]
    .filter(Boolean)
    .join(' ');
}

// Clip Enhancement Capability
function canEnhanceClip(
  clip: ExportClip,
  enhancements: AIEnhancementConfig[],
): boolean {
  if (clip.type !== 'video' && clip.type !== 'image') return false;

  // Check if any enhancement is applicable to this clip type
  return enhancements.some((e) => {
    if (!e.enabled) return false;

    // Some enhancements only apply to video
    if (clip.type === 'image') {
      return ['super-resolution', 'color-grade', 'style-transfer', 'background-removal'].includes(e.type);
    }

    return true;
  });
}

// Utility Functions
function generatePresetId(): string {
  return `preset_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function generateIntermediatePath(originalPath: string): string {
  const ext = originalPath.split('.').pop() ?? 'mp4';
  const base = originalPath.slice(0, -(ext.length + 1));
  return `${base}_ai_enhanced.${ext}`;
}

function isValidPreset(preset: unknown): preset is AIPreset {
  if (!preset || typeof preset !== 'object') return false;

  const p = preset as Record<string, unknown>;

  return (
    typeof p.id === 'string' &&
    typeof p.name === 'string' &&
    typeof p.description === 'string' &&
    Array.isArray(p.enhancements) &&
    typeof p.createdAt === 'number' &&
    typeof p.updatedAt === 'number'
  );
}

// Built-in Presets
export const BUILT_IN_AI_PRESETS: AIPreset[] = [
  {
    id: 'preset-cinematic-enhance',
    name: 'Cinematic Enhancement',
    description: 'Professional color grading and stabilization for cinematic look',
    enhancements: [
      { type: 'color-grade', enabled: true, strength: 0.7 },
      { type: 'stabilization', enabled: true, strength: 0.5 },
      { type: 'denoise', enabled: true, strength: 0.3 },
    ],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: 'preset-social-media',
    name: 'Social Media Ready',
    description: 'Optimize video for social media platforms',
    enhancements: [
      { type: 'super-resolution', enabled: true, strength: 0.5 },
      { type: 'color-grade', enabled: true, strength: 0.4 },
      { type: 'denoise', enabled: true, strength: 0.6 },
    ],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: 'preset-archive-restore',
    name: 'Archive Restoration',
    description: 'Restore and enhance old or damaged footage',
    enhancements: [
      { type: 'denoise', enabled: true, strength: 0.8 },
      { type: 'super-resolution', enabled: true, strength: 0.6 },
      { type: 'color-grade', enabled: true, strength: 0.5 },
      { type: 'stabilization', enabled: true, strength: 0.7 },
    ],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
];

// Pipeline Status Management
export function createInitialPipelineState(): AIRenderPipelineState {
  return {
    status: 'idle',
    progress: {
      phase: 'preprocessing',
      percent: 0,
      currentFrame: 0,
      totalFrames: 0,
      estimatedTimeRemaining: 0,
    },
    intermediateFiles: [],
  };
}

export function updatePipelineProgress(
  state: AIRenderPipelineState,
  progress: Partial<AIRenderProgress>,
): AIRenderPipelineState {
  return {
    ...state,
    progress: { ...state.progress, ...progress },
  };
}

export function completePipeline(
  state: AIRenderPipelineState,
  result: AIRenderResult,
): AIRenderPipelineState {
  return {
    ...state,
    status: result.success ? 'completed' : 'error',
    result,
    progress: {
      ...state.progress,
      percent: 100,
      phase: 'encoding',
    },
  };
}
