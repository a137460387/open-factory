/**
 * Edit Decision List (EDL) Analysis Module
 *
 * Analyzes user's editing patterns from historical projects:
 * - Average shot duration
 * - Transition type preferences
 * - Rhythm patterns in highlight sections
 * - Personal editing style vector
 */

// ==================== Types ====================

export interface EditDecisionEntry {
  /** Clip start time in seconds */
  startTime: number;
  /** Clip end time in seconds */
  endTime: number;
  /** Clip duration in seconds */
  duration: number;
  /** Media source ID */
  mediaId: string;
  /** Track ID */
  trackId: string;
  /** Transition type used */
  transitionType?: string;
  /** Whether this is a highlight moment */
  isHighlight?: boolean;
  /** Visual energy score (0-1) */
  visualEnergy?: number;
  /** Audio energy score (0-1) */
  audioEnergy?: number;
}

export interface EditingRhythmProfile {
  /** Average shot duration in seconds */
  avgShotDuration: number;
  /** Median shot duration in seconds */
  medianShotDuration: number;
  /** Shot duration standard deviation */
  shotDurationStdDev: number;
  /** Short shot ratio (< 2 seconds) */
  shortShotRatio: number;
  /** Medium shot ratio (2-10 seconds) */
  mediumShotRatio: number;
  /** Long shot ratio (> 10 seconds) */
  longShotRatio: number;
  /** Transition type distribution */
  transitionDistribution: Record<string, number>;
  /** Rhythm pattern in highlight sections */
  highlightRhythmPattern: RhythmPattern;
  /** Editing pace (cuts per minute) */
  editingPace: number;
  /** Rhythm consistency (0-1, higher = more consistent) */
  rhythmConsistency: number;
}

export interface RhythmPattern {
  /** Pattern type */
  type: 'steady' | 'accelerating' | 'decelerating' | 'syncopated' | 'irregular';
  /** Confidence 0-1 */
  confidence: number;
  /** Average interval between cuts */
  avgInterval: number;
  /** Interval variance */
  intervalVariance: number;
}

export interface EditingStyleVector {
  /** 128-dimensional style vector */
  vector: number[];
  /** Style dimensions labels */
  dimensions: string[];
  /** Confidence in each dimension */
  confidence: number[];
}

export interface EDLAnalysisResult {
  /** Editing rhythm profile */
  rhythmProfile: EditingRhythmProfile;
  /** Style vector for machine learning */
  styleVector: EditingStyleVector;
  /** Statistics */
  stats: {
    totalClips: number;
    totalDuration: number;
    uniqueMediaCount: number;
    trackCount: number;
  };
}

// ==================== EDL Parsing ====================

/** Minimal timeline shape for EDL analysis */
export interface TimelineLike {
  tracks: Array<{
    id: string;
    clips: Array<{
      start: number;
      duration: number;
      mediaId: string;
      transition?: { type?: string };
      metadata?: { isHighlight?: boolean; visualEnergy?: number; audioEnergy?: number };
    }>;
  }>;
}

/**
 * Parse EDL entries from project timeline data
 */
export function parseEDLEntries(timeline: TimelineLike): EditDecisionEntry[] {
  const entries: EditDecisionEntry[] = [];

  if (!timeline?.tracks) {
    return entries;
  }

  for (const track of timeline.tracks) {
    if (!track.clips) continue;

    for (const clip of track.clips) {
      entries.push({
        startTime: clip.start,
        endTime: clip.start + clip.duration,
        duration: clip.duration,
        mediaId: clip.mediaId,
        trackId: track.id,
        transitionType: clip.transition?.type,
        isHighlight: clip.metadata?.isHighlight,
        visualEnergy: clip.metadata?.visualEnergy,
        audioEnergy: clip.metadata?.audioEnergy,
      });
    }
  }

  // Sort by start time
  entries.sort((a, b) => a.startTime - b.startTime);
  return entries;
}

// ==================== Rhythm Analysis ====================

/**
 * Calculate shot duration statistics
 */
export function calculateShotDurationStats(entries: EditDecisionEntry[]): {
  avg: number;
  median: number;
  stdDev: number;
  shortRatio: number;
  mediumRatio: number;
  longRatio: number;
} {
  if (entries.length === 0) {
    return { avg: 0, median: 0, stdDev: 0, shortRatio: 0, mediumRatio: 0, longRatio: 0 };
  }

  const durations = entries.map((e) => e.duration).sort((a, b) => a - b);
  const sum = durations.reduce((a, b) => a + b, 0);
  const avg = sum / durations.length;

  // Median
  const mid = Math.floor(durations.length / 2);
  const median = durations.length % 2 === 0 ? (durations[mid - 1] + durations[mid]) / 2 : durations[mid];

  // Standard deviation
  const squaredDiffs = durations.map((d) => (d - avg) ** 2);
  const variance = squaredDiffs.reduce((a, b) => a + b, 0) / durations.length;
  const stdDev = Math.sqrt(variance);

  // Ratios
  const shortCount = durations.filter((d) => d < 2).length;
  const mediumCount = durations.filter((d) => d >= 2 && d <= 10).length;
  const longCount = durations.filter((d) => d > 10).length;

  return {
    avg,
    median,
    stdDev,
    shortRatio: shortCount / durations.length,
    mediumRatio: mediumCount / durations.length,
    longRatio: longCount / durations.length,
  };
}

/**
 * Calculate transition type distribution
 */
export function calculateTransitionDistribution(entries: EditDecisionEntry[]): Record<string, number> {
  const distribution: Record<string, number> = {};
  let total = 0;

  for (const entry of entries) {
    if (entry.transitionType) {
      distribution[entry.transitionType] = (distribution[entry.transitionType] || 0) + 1;
      total++;
    }
  }

  // Normalize to percentages
  if (total > 0) {
    for (const key in distribution) {
      distribution[key] = distribution[key] / total;
    }
  }

  return distribution;
}

/**
 * Analyze rhythm pattern from cut intervals
 */
export function analyzeRhythmPattern(entries: EditDecisionEntry[]): RhythmPattern {
  if (entries.length < 3) {
    return { type: 'irregular', confidence: 0, avgInterval: 0, intervalVariance: 1 };
  }

  // Calculate intervals between cuts
  const intervals: number[] = [];
  for (let i = 1; i < entries.length; i++) {
    intervals.push(entries[i].startTime - entries[i - 1].startTime);
  }

  const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
  const variance = intervals.reduce((acc, v) => acc + (v - avgInterval) ** 2, 0) / intervals.length;
  const stdDev = Math.sqrt(variance);
  const cv = avgInterval > 0 ? stdDev / avgInterval : 1;

  // Check for accelerating (decreasing intervals)
  let decreasingCount = 0;
  for (let i = 1; i < intervals.length; i++) {
    if (intervals[i] < intervals[i - 1] * 0.95) decreasingCount++;
  }
  const decreasingRatio = decreasingCount / Math.max(1, intervals.length - 1);

  // Check for decelerating (increasing intervals)
  let increasingCount = 0;
  for (let i = 1; i < intervals.length; i++) {
    if (intervals[i] > intervals[i - 1] * 1.05) increasingCount++;
  }
  const increasingRatio = increasingCount / Math.max(1, intervals.length - 1);

  if (decreasingRatio > 0.6) {
    return { type: 'accelerating', confidence: decreasingRatio, avgInterval, intervalVariance: variance };
  }
  if (increasingRatio > 0.6) {
    return { type: 'decelerating', confidence: increasingRatio, avgInterval, intervalVariance: variance };
  }
  if (cv < 0.15) {
    return { type: 'steady', confidence: 1 - cv, avgInterval, intervalVariance: variance };
  }
  if (cv < 0.4) {
    return { type: 'syncopated', confidence: 1 - cv * 2, avgInterval, intervalVariance: variance };
  }

  return { type: 'irregular', confidence: cv, avgInterval, intervalVariance: variance };
}

/**
 * Calculate editing pace (cuts per minute)
 */
export function calculateEditingPace(entries: EditDecisionEntry[]): number {
  if (entries.length < 2) return 0;

  const totalDuration = entries[entries.length - 1].endTime - entries[0].startTime;
  if (totalDuration <= 0) return 0;

  const cuts = entries.length - 1;
  return (cuts / totalDuration) * 60; // cuts per minute
}

/**
 * Calculate rhythm consistency
 */
export function calculateRhythmConsistency(entries: EditDecisionEntry[]): number {
  if (entries.length < 3) return 0;

  const intervals: number[] = [];
  for (let i = 1; i < entries.length; i++) {
    intervals.push(entries[i].startTime - entries[i - 1].startTime);
  }

  const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length;
  const variance = intervals.reduce((acc, v) => acc + (v - avg) ** 2, 0) / intervals.length;
  const cv = avg > 0 ? Math.sqrt(variance) / avg : 1;

  // Lower CV = higher consistency
  return Math.max(0, 1 - cv);
}

// ==================== Style Vector Generation ====================

/**
 * Generate editing style vector from rhythm profile
 */
export function generateStyleVector(profile: EditingRhythmProfile): EditingStyleVector {
  const dimensions = [
    'avgShotDuration',
    'medianShotDuration',
    'shotDurationStdDev',
    'shortShotRatio',
    'mediumShotRatio',
    'longShotRatio',
    'editingPace',
    'rhythmConsistency',
    'hasHardCuts',
    'hasCrossDissolve',
    'hasFade',
    'hasWipe',
    'rhythmType_steady',
    'rhythmType_accelerating',
    'rhythmType_decelerating',
    'rhythmType_syncopated',
  ];

  const vector: number[] = [
    normalizeValue(profile.avgShotDuration, 0, 30),
    normalizeValue(profile.medianShotDuration, 0, 30),
    normalizeValue(profile.shotDurationStdDev, 0, 15),
    profile.shortShotRatio,
    profile.mediumShotRatio,
    profile.longShotRatio,
    normalizeValue(profile.editingPace, 0, 120),
    profile.rhythmConsistency,
    profile.transitionDistribution['hard-cut'] || 0,
    profile.transitionDistribution['cross-dissolve'] || 0,
    profile.transitionDistribution['fade'] || 0,
    profile.transitionDistribution['wipe'] || 0,
    profile.highlightRhythmPattern.type === 'steady' ? profile.highlightRhythmPattern.confidence : 0,
    profile.highlightRhythmPattern.type === 'accelerating' ? profile.highlightRhythmPattern.confidence : 0,
    profile.highlightRhythmPattern.type === 'decelerating' ? profile.highlightRhythmPattern.confidence : 0,
    profile.highlightRhythmPattern.type === 'syncopated' ? profile.highlightRhythmPattern.confidence : 0,
  ];

  // Pad to 128 dimensions with zeros
  while (vector.length < 128) {
    vector.push(0);
  }

  const confidence = dimensions.map(() => 1.0);
  while (confidence.length < 128) {
    confidence.push(0);
  }

  return { vector, dimensions, confidence };
}

/**
 * Normalize a value to 0-1 range
 */
function normalizeValue(value: number, min: number, max: number): number {
  if (max <= min) return 0;
  return Math.max(0, Math.min(1, (value - min) / (max - min)));
}

// ==================== Full Analysis Pipeline ====================

/**
 * Run full EDL analysis on project timeline
 */
export function analyzeEditingStyle(timeline: TimelineLike): EDLAnalysisResult {
  const entries = parseEDLEntries(timeline);

  if (entries.length === 0) {
    return {
      rhythmProfile: {
        avgShotDuration: 0,
        medianShotDuration: 0,
        shotDurationStdDev: 0,
        shortShotRatio: 0,
        mediumShotRatio: 0,
        longShotRatio: 0,
        transitionDistribution: {},
        highlightRhythmPattern: { type: 'irregular', confidence: 0, avgInterval: 0, intervalVariance: 0 },
        editingPace: 0,
        rhythmConsistency: 0,
      },
      styleVector: { vector: new Array(128).fill(0), dimensions: [], confidence: new Array(128).fill(0) },
      stats: { totalClips: 0, totalDuration: 0, uniqueMediaCount: 0, trackCount: 0 },
    };
  }

  // Calculate duration stats
  const durationStats = calculateShotDurationStats(entries);

  // Calculate transition distribution
  const transitionDistribution = calculateTransitionDistribution(entries);

  // Analyze rhythm pattern
  const highlightRhythmPattern = analyzeRhythmPattern(entries);

  // Calculate editing pace
  const editingPace = calculateEditingPace(entries);

  // Calculate rhythm consistency
  const rhythmConsistency = calculateRhythmConsistency(entries);

  const rhythmProfile: EditingRhythmProfile = {
    avgShotDuration: durationStats.avg,
    medianShotDuration: durationStats.median,
    shotDurationStdDev: durationStats.stdDev,
    shortShotRatio: durationStats.shortRatio,
    mediumShotRatio: durationStats.mediumRatio,
    longShotRatio: durationStats.longRatio,
    transitionDistribution,
    highlightRhythmPattern,
    editingPace,
    rhythmConsistency,
  };

  // Generate style vector
  const styleVector = generateStyleVector(rhythmProfile);

  // Calculate stats
  const uniqueMedia = new Set(entries.map((e) => e.mediaId));
  const tracks = new Set(entries.map((e) => e.trackId));
  const totalDuration = entries.length > 0 ? entries[entries.length - 1].endTime - entries[0].startTime : 0;

  return {
    rhythmProfile,
    styleVector,
    stats: {
      totalClips: entries.length,
      totalDuration,
      uniqueMediaCount: uniqueMedia.size,
      trackCount: tracks.size,
    },
  };
}

/**
 * Compare two editing styles and return similarity score (0-1)
 */
export function compareEditingStyles(style1: EditingStyleVector, style2: EditingStyleVector): number {
  if (style1.vector.length !== style2.vector.length) return 0;

  // Cosine similarity
  let dotProduct = 0;
  let norm1 = 0;
  let norm2 = 0;

  for (let i = 0; i < style1.vector.length; i++) {
    dotProduct += style1.vector[i] * style2.vector[i];
    norm1 += style1.vector[i] ** 2;
    norm2 += style2.vector[i] ** 2;
  }

  if (norm1 === 0 || norm2 === 0) return 0;

  return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
}
