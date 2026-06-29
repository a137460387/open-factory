/**
 * AI platform duration fit suggestion (local greedy algorithm).
 *
 * Given a list of clips with importance scores and a target platform
 * duration limit, greedily selects the highest-scoring clips that
 * fit within the limit, preserving original time order.
 * Optionally snaps cut points to scene-change boundaries.
 */

import { round } from './time';

// -- Public types ------------------------------------------------

export type PlatformFitTarget = 'tiktok' | 'reels' | 'shorts' | 'custom';

export interface PlatformFitSegment {
  clipId: string;
  start: number;
  end: number;
  score: number;
}

export interface PlatformFitSuggestion {
  targetPlatform: PlatformFitTarget;
  limitSeconds: number;
  keptSegments: PlatformFitSegment[];
  removedSegments: PlatformFitSegment[];
}

export interface ClipWithDurationAndScore {
  clipId: string;
  start: number;
  end: number;
  score?: number; // undefined → use median fallback
}

// -- Platform limits ---------------------------------------------

export const PLATFORM_LIMITS: Record<Exclude<PlatformFitTarget, 'custom'>, number> = {
  tiktok: 60,
  reels: 90,
  shorts: 60
};

// -- Importance scoring ------------------------------------------

/**
 * Calculate clip importance score, using AI highlight score if available
 * or falling back to the provided median default.
 */
export function calculateClipImportance(
  clip: ClipWithDurationAndScore,
  defaultScore = 0.5
): number {
  if (typeof clip.score === 'number' && Number.isFinite(clip.score)) {
    return round(Math.max(0, Math.min(1, clip.score)));
  }
  return defaultScore;
}

// -- Scene-change boundary snapping ------------------------------

/**
 * Snap a time value to the nearest scene-change boundary within
 * the given tolerance.
 */
export function snapToSceneChange(
  time: number,
  sceneChangeTimes: readonly number[],
  tolerance = 0.5
): number {
  if (sceneChangeTimes.length === 0) return time;
  let bestTime = time;
  let bestDist = Infinity;
  for (const sceneTime of sceneChangeTimes) {
    const dist = Math.abs(sceneTime - time);
    if (dist < bestDist && dist <= tolerance) {
      bestDist = dist;
      bestTime = sceneTime;
    }
  }
  return round(bestTime);
}

// -- Main suggestion algorithm -----------------------------------

/**
 * Generate a platform duration fit suggestion.
 *
 * 1. Score each clip by importance.
 * 2. Sort by score descending and greedily select until duration limit.
 * 3. Re-sort selected clips by original time order.
 * 4. Optionally snap start/end to scene-change boundaries.
 */
export function generatePlatformFitSuggestion(
  clips: ClipWithDurationAndScore[],
  limitSeconds: number,
  sceneChangeTimes?: readonly number[],
  snapTolerance?: number
): PlatformFitSuggestion {
  if (clips.length === 0 || limitSeconds <= 0) {
    return {
      targetPlatform: 'custom',
      limitSeconds,
      keptSegments: [],
      removedSegments: clips.map((c) => ({
        clipId: c.clipId,
        start: c.start,
        end: c.end,
        score: calculateClipImportance(c)
      }))
    };
  }

  // Compute median score for fallback
  const explicitScores = clips
    .map((c) => c.score)
    .filter((s): s is number => typeof s === 'number' && Number.isFinite(s))
    .sort((a, b) => a - b);
  const medianScore = explicitScores.length > 0
    ? explicitScores[Math.floor(explicitScores.length / 2)]
    : 0.5;

  // Score all clips
  const scored = clips.map((c) => ({
    ...c,
    effectiveScore: calculateClipImportance(c, medianScore)
  }));

  // Sort by score descending for greedy selection
  const byScoreDesc = [...scored].sort((a, b) => b.effectiveScore - a.effectiveScore);

  let remaining = limitSeconds;
  const keptIds = new Set<string>();

  for (const clip of byScoreDesc) {
    const clipDuration = clip.end - clip.start;
    if (clipDuration <= 0) continue;
    if (clipDuration <= remaining + 0.001) {
      keptIds.add(clip.clipId);
      remaining -= clipDuration;
    }
  }

  // Re-sort kept clips by original time order
  const keptSegments: PlatformFitSegment[] = [];
  const removedSegments: PlatformFitSegment[] = [];

  for (const clip of scored) {
    const seg: PlatformFitSegment = {
      clipId: clip.clipId,
      start: clip.start,
      end: clip.end,
      score: clip.effectiveScore
    };

    if (keptIds.has(clip.clipId)) {
      // Optionally snap to scene-change boundaries
      if (sceneChangeTimes && sceneChangeTimes.length > 0) {
        const tolerance = snapTolerance ?? 0.5;
        seg.start = snapToSceneChange(seg.start, sceneChangeTimes, tolerance);
        seg.end = snapToSceneChange(seg.end, sceneChangeTimes, tolerance);
        // Ensure valid segment after snapping
        if (seg.end <= seg.start) {
          seg.start = clip.start;
          seg.end = clip.end;
        }
      }
      keptSegments.push(seg);
    } else {
      removedSegments.push(seg);
    }
  }

  // Sort kept segments by start time
  keptSegments.sort((a, b) => a.start - b.start || a.clipId.localeCompare(b.clipId));

  return {
    targetPlatform: 'custom',
    limitSeconds,
    keptSegments,
    removedSegments
  };
}
