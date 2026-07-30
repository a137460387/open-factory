/**
 * Integration format conversion for v4.37.0 multicam system
 */

import type {
  IntelligentSyncResult,
  MulticamSyncIntegration,
  SwitchSuggestion,
  SyncQuality,
} from './types';

/**
 * Convert intelligent sync result to integration format
 */
export function toIntegrationFormat(
  syncResult: IntelligentSyncResult,
  suggestions: SwitchSuggestion[],
): MulticamSyncIntegration {
  const offsets: Record<string, number> = {};
  syncResult.offsets.forEach((v, k) => {
    offsets[k] = v;
  });

  const switchPoints = suggestions.map((s) => ({
    time: s.time,
    angleId: s.targetAngleId,
    transition: s.confidence > 0.8 ? ('cut' as const) : ('dissolve' as const),
  }));

  const details: Array<{ angleId: string; quality: SyncQuality }> = [];
  syncResult.angleQualities.forEach((quality, angleId) => {
    details.push({ angleId, quality });
  });

  const overallLevels = details.map((d) => d.quality.level);
  const overall: SyncQuality['level'] = overallLevels.includes('poor')
    ? 'poor'
    : overallLevels.includes('fair')
      ? 'fair'
      : overallLevels.includes('good')
        ? 'good'
        : 'excellent';

  return {
    offsets,
    switchPoints,
    qualitySummary: { overall, details },
  };
}
