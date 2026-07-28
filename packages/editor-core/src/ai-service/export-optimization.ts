import type { AIExportSuggestion, AIExportSuggestionPriority, AIExportProjectInfo } from './types';

export const EXPORT_SUGGESTION_CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Build project info summary for AI export optimization.
 */
export function buildExportProjectInfo(project: {
  settings: { width: number; height: number; fps: number };
  timeline: { tracks: Array<{ type: string; clips: Array<Record<string, unknown>> }> };
}): AIExportProjectInfo {
  const tracks = project.timeline.tracks;
  const allClips = tracks.flatMap((t) => t.clips);
  const hasSubtitle = tracks.some((t) => t.type === 'subtitle');
  const effectCount = allClips.filter(
    (c) =>
      'effects' in c &&
      Array.isArray((c as Record<string, unknown>).effects) &&
      ((c as Record<string, unknown>).effects as unknown[]).length > 0,
  ).length;
  const hasHDR = allClips.some((c) => {
    const style = (c as Record<string, unknown>).style as Record<string, unknown> | undefined;
    return Boolean(style && style.hdr);
  });
  const maxDuration = allClips.reduce((max, c) => {
    const end = ((c as Record<string, unknown>).start as number) + ((c as Record<string, unknown>).duration as number);
    return end > max ? end : max;
  }, 0);
  return {
    durationSeconds: Math.round(maxDuration),
    width: project.settings.width,
    height: project.settings.height,
    fps: project.settings.fps,
    trackCount: tracks.length,
    effectCount,
    hasSubtitle,
    hasHDR,
    clipCount: allClips.length,
  };
}

/**
 * Build system prompt for AI export optimization.
 */
export function buildExportOptimizationSystemPrompt(): string {
  return [
    'You are an expert video encoding advisor. Analyze the current export preset and project info, then suggest parameter improvements.',
    'Return a JSON array of suggestion objects with exactly these fields:',
    "[{parameter: string, currentValue: string, suggestedValue: string, reason: string, priority: 'high'|'medium'|'low'}]",
    '',
    'Cover these areas when relevant:',
    '* videoBitrate: whether bitrate matches content complexity (action-heavy vs talking-head)',
    '* audioBitrate: whether audio bitrate is appropriate for content type',
    '* loudnessNormalization: whether loudness normalization should be enabled',
    '* subtitleFormat: whether subtitle format matches target platform',
    '* videoCodec: whether the encoder is optimal for quality/speed',
    '* width/height: whether resolution matches source media',
    '* fps: whether frame rate matches source media',
    '* hardwareEncoding: whether GPU encoding is beneficial',
    '',
    'Only suggest changes that would genuinely improve the output. Return an empty array if the current settings are already optimal.',
    'Return ONLY the JSON array, no markdown fences or explanation.',
  ].join('\n');
}

/**
 * Build user prompt for AI export optimization.
 */
export function buildExportOptimizationUserPrompt(
  projectInfo: AIExportProjectInfo,
  presetSettings: {
    format?: string;
    videoCodec?: string;
    audioCodec?: string;
    videoBitrate?: string;
    audioBitrate?: string;
    width?: number;
    height?: number;
    fps?: number;
    loudnessNormalization?: string;
    subtitleFormat?: string;
    hardwareEncoding?: boolean;
    outputMode?: string;
  },
): string {
  return [
    'Project info:',
    '  Duration: ' + projectInfo.durationSeconds + 's',
    '  Resolution: ' + projectInfo.width + 'x' + projectInfo.height,
    '  FPS: ' + projectInfo.fps,
    '  Tracks: ' + projectInfo.trackCount + ' (' + projectInfo.clipCount + ' clips total)',
    '  Effects: ' + projectInfo.effectCount + ' clips with effects',
    '  Subtitles: ' + (projectInfo.hasSubtitle ? 'yes' : 'no'),
    '  HDR: ' + (projectInfo.hasHDR ? 'yes' : 'no'),
    '',
    'Current export preset:',
    '  Format: ' + (presetSettings.format ?? 'mp4'),
    '  Video codec: ' + (presetSettings.videoCodec ?? 'h264'),
    '  Audio codec: ' + (presetSettings.audioCodec ?? 'aac'),
    '  Video bitrate: ' + (presetSettings.videoBitrate ?? 'auto'),
    '  Audio bitrate: ' + (presetSettings.audioBitrate ?? 'auto'),
    '  Output resolution: ' +
      (presetSettings.width ?? projectInfo.width) +
      'x' +
      (presetSettings.height ?? projectInfo.height),
    '  Output FPS: ' + (presetSettings.fps ?? projectInfo.fps),
    '  Loudness normalization: ' + (presetSettings.loudnessNormalization ?? 'off'),
    '  Subtitle format: ' + (presetSettings.subtitleFormat ?? 'none'),
    '  Hardware encoding: ' + (presetSettings.hardwareEncoding ? 'yes' : 'no'),
    '  Output mode: ' + (presetSettings.outputMode ?? 'video'),
  ].join('\n');
}

/**
 * Parse AI export optimization response into typed suggestions.
 */
export function parseExportOptimizationResponse(json: unknown): AIExportSuggestion[] {
  if (!Array.isArray(json)) return [];
  const validPriorities = new Set<AIExportSuggestionPriority>(['high', 'medium', 'low']);
  return json
    .filter(
      (item): item is Record<string, unknown> =>
        typeof item === 'object' &&
        item !== null &&
        typeof (item as Record<string, unknown>).parameter === 'string' &&
        typeof (item as Record<string, unknown>).currentValue === 'string' &&
        typeof (item as Record<string, unknown>).suggestedValue === 'string' &&
        typeof (item as Record<string, unknown>).reason === 'string' &&
        validPriorities.has((item as Record<string, unknown>).priority as AIExportSuggestionPriority),
    )
    .map((item) => ({
      parameter: item.parameter as string,
      currentValue: item.currentValue as string,
      suggestedValue: item.suggestedValue as string,
      reason: item.reason as string,
      priority: item.priority as AIExportSuggestionPriority,
    }));
}

const PRIORITY_ORDER: Record<AIExportSuggestionPriority, number> = { high: 0, medium: 1, low: 2 };

/**
 * Sort suggestions by priority (high first).
 */
export function sortExportSuggestionsByPriority(suggestions: AIExportSuggestion[]): AIExportSuggestion[] {
  return [...suggestions].sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);
}
