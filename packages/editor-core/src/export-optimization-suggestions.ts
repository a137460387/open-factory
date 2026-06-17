import { getTimelineDuration } from './timeline';
import { getCfrTargetFrameRate } from './vfr';
import type { ExportSettings } from './export/export-types';
import type { MediaAsset, Project } from './model-types';

export type ExportOptimizationSuggestionId = 'proxy-for-4k-downscale' | 'unify-frame-rate' | 'normalize-loudness' | 'convert-vfr-to-cfr' | 'parallel-long-export';
export type ExportOptimizationSuggestionSeverity = 'info' | 'warning';

export interface ExportOptimizationSettings {
  dismissedSuggestionIds: ExportOptimizationSuggestionId[];
}

export interface ExportOptimizationAnalysisContext {
  measuredIntegratedLufs?: number;
  renderFarmEnabled?: boolean;
  suggestedRenderFarmInstances?: number;
}

export interface ExportOptimizationSuggestion {
  id: ExportOptimizationSuggestionId;
  severity: ExportOptimizationSuggestionSeverity;
  mediaIds: string[];
  value?: number;
  targetValue?: number;
}

export interface ExportOptimizationApplyResult {
  settings: Partial<Omit<ExportSettings, 'outputPath'>>;
  renderFarm?: {
    enabled: boolean;
    instances: number;
  };
}

export const DEFAULT_EXPORT_OPTIMIZATION_SETTINGS: ExportOptimizationSettings = {
  dismissedSuggestionIds: []
};

const ALL_EXPORT_OPTIMIZATION_SUGGESTION_IDS: ExportOptimizationSuggestionId[] = ['proxy-for-4k-downscale', 'unify-frame-rate', 'normalize-loudness', 'convert-vfr-to-cfr', 'parallel-long-export'];

export function normalizeExportOptimizationSettings(settings: unknown): ExportOptimizationSettings {
  if (!settings || typeof settings !== 'object') {
    return { ...DEFAULT_EXPORT_OPTIMIZATION_SETTINGS };
  }
  const input = settings as Partial<ExportOptimizationSettings>;
  const allowed = new Set(ALL_EXPORT_OPTIMIZATION_SUGGESTION_IDS);
  const dismissedSuggestionIds = Array.from(
    new Set((Array.isArray(input.dismissedSuggestionIds) ? input.dismissedSuggestionIds : []).filter((id): id is ExportOptimizationSuggestionId => allowed.has(id as ExportOptimizationSuggestionId)))
  );
  return { dismissedSuggestionIds };
}

export function analyzeExportOptimizationSuggestions(
  project: Pick<Project, 'media' | 'timeline' | 'settings'>,
  settings: Partial<Omit<ExportSettings, 'outputPath'>>,
  optimizationSettings: ExportOptimizationSettings = DEFAULT_EXPORT_OPTIMIZATION_SETTINGS,
  context: ExportOptimizationAnalysisContext = {}
): ExportOptimizationSuggestion[] {
  const dismissed = new Set(normalizeExportOptimizationSettings(optimizationSettings).dismissedSuggestionIds);
  const usedMedia = collectUsedTimelineMedia(project);
  const suggestions: ExportOptimizationSuggestion[] = [];
  const outputWidth = normalizePositiveNumber(settings.width ?? project.settings.width);
  const outputHeight = normalizePositiveNumber(settings.height ?? project.settings.height);
  const outputFps = normalizePositiveNumber(settings.fps ?? project.settings.fps);

  const downscaled4k = usedMedia.filter((asset) => asset.type === 'video' && isFourKAsset(asset) && outputWidth <= 1920 && outputHeight <= 1080);
  if (downscaled4k.length > 0 && !settings.hardwareEncoding) {
    suggestions.push({
      id: 'proxy-for-4k-downscale',
      severity: 'info',
      mediaIds: downscaled4k.map((asset) => asset.id),
      value: Math.max(...downscaled4k.map((asset) => Math.max(asset.width, asset.height))),
      targetValue: Math.max(outputWidth, outputHeight)
    });
  }

  const highFpsMedia = usedMedia.filter((asset) => asset.type === 'video' && normalizePositiveNumber(asset.frameRate) >= 55 && outputFps < normalizePositiveNumber(asset.frameRate) - 0.01);
  if (highFpsMedia.length > 0) {
    const targetFps = Math.max(...highFpsMedia.map((asset) => normalizePositiveNumber(asset.frameRate)));
    suggestions.push({
      id: 'unify-frame-rate',
      severity: 'warning',
      mediaIds: highFpsMedia.map((asset) => asset.id),
      value: outputFps,
      targetValue: targetFps
    });
  }

  if (typeof context.measuredIntegratedLufs === 'number' && Number.isFinite(context.measuredIntegratedLufs) && context.measuredIntegratedLufs <= -24 && (!settings.loudnessNormalization || settings.loudnessNormalization === 'off')) {
    suggestions.push({
      id: 'normalize-loudness',
      severity: 'warning',
      mediaIds: [],
      value: context.measuredIntegratedLufs,
      targetValue: -14
    });
  }

  const vfrMedia = usedMedia.filter((asset) => asset.type === 'video' && asset.variableFrameRate);
  if (vfrMedia.length > 0) {
    const targetFps = getCfrTargetFrameRate({ avgFrameRate: vfrMedia[0]?.avgFrameRate, realFrameRate: vfrMedia[0]?.realFrameRate }, outputFps || 30);
    suggestions.push({
      id: 'convert-vfr-to-cfr',
      severity: 'warning',
      mediaIds: vfrMedia.map((asset) => asset.id),
      value: vfrMedia.length,
      targetValue: targetFps
    });
  }

  const durationSeconds = getTimelineDuration(project.timeline);
  if (durationSeconds > 30 * 60 && context.renderFarmEnabled !== true) {
    suggestions.push({
      id: 'parallel-long-export',
      severity: 'info',
      mediaIds: [],
      value: durationSeconds,
      targetValue: Math.max(2, Math.min(4, Math.round(context.suggestedRenderFarmInstances ?? 2)))
    });
  }

  return suggestions.filter((suggestion) => !dismissed.has(suggestion.id));
}

export function applyExportOptimizationSuggestion(
  suggestion: ExportOptimizationSuggestion | ExportOptimizationSuggestionId,
  settings: Partial<Omit<ExportSettings, 'outputPath'>>,
  context: ExportOptimizationAnalysisContext = {}
): ExportOptimizationApplyResult {
  const id = typeof suggestion === 'string' ? suggestion : suggestion.id;
  const targetValue = typeof suggestion === 'string' ? undefined : suggestion.targetValue;
  if (id === 'proxy-for-4k-downscale') {
    return {
      settings: {
        ...settings,
        hardwareEncoding: true,
        scaleMode: 'fit'
      }
    };
  }
  if (id === 'unify-frame-rate') {
    return {
      settings: {
        ...settings,
        fps: normalizePositiveNumber(targetValue) || settings.fps
      }
    };
  }
  if (id === 'normalize-loudness') {
    return {
      settings: {
        ...settings,
        loudnessNormalization: 'youtube'
      }
    };
  }
  if (id === 'convert-vfr-to-cfr') {
    return {
      settings: {
        ...settings,
        fps: normalizePositiveNumber(targetValue) || settings.fps
      }
    };
  }
  if (id === 'parallel-long-export') {
    return {
      settings,
      renderFarm: {
        enabled: true,
        instances: Math.max(2, Math.min(4, Math.round(targetValue ?? context.suggestedRenderFarmInstances ?? 2)))
      }
    };
  }
  return { settings };
}

function collectUsedTimelineMedia(project: Pick<Project, 'media' | 'timeline'>): MediaAsset[] {
  const mediaById = new Map(project.media.map((asset) => [asset.id, asset]));
  const usedIds = new Set(
    project.timeline.tracks.flatMap((track) =>
      track.clips.flatMap((clip) => ('mediaId' in clip && typeof clip.mediaId === 'string' ? [clip.mediaId] : []))
    )
  );
  return Array.from(usedIds).flatMap((id) => {
    const asset = mediaById.get(id);
    return asset ? [asset] : [];
  });
}

function isFourKAsset(asset: MediaAsset): boolean {
  return asset.width >= 3840 || asset.height >= 2160;
}

function normalizePositiveNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0;
}
