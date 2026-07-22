/**
 * Smart Rough Cut Generator
 *
 * Generates rough cut suggestions by combining:
 * - Visual highlight markers
 * - Audio rhythm/beat alignment
 * - Pacing analysis
 *
 * Produces multiple cut proposals ranked by quality score.
 */

import { round } from './time';
import type { VisualHighlightMarker } from './visual-highlight-engine';
import type { OnsetEvent } from './audio-rhythm-analysis';

// ==================== Types ====================

export interface RoughCutConfig {
  /** Target output duration in seconds */
  targetDuration: number;
  /** Tolerance for duration matching (fraction, e.g. 0.1 = 10%) */
  durationTolerance: number;
  /** Minimum clip duration in seconds */
  minClipDuration: number;
  /** Maximum clip duration in seconds */
  maxClipDuration: number;
  /** Weight for visual highlight score */
  visualWeight: number;
  /** Weight for audio alignment score */
  audioWeight: number;
  /** Weight for pacing score */
  pacingWeight: number;
  /** Preferred cuts per minute for pacing */
  targetCpm: number;
}

export const DEFAULT_ROUGH_CUT_CONFIG: RoughCutConfig = {
  targetDuration: 60,
  durationTolerance: 0.15,
  minClipDuration: 0.5,
  maxClipDuration: 10,
  visualWeight: 0.5,
  audioWeight: 0.3,
  pacingWeight: 0.2,
  targetCpm: 20,
};

export interface CutPoint {
  /** Time in the source timeline (seconds) */
  time: number;
  /** Confidence score 0-1 */
  confidence: number;
  /** Why this cut point was chosen */
  reason: 'visual-highlight' | 'audio-beat' | 'combined' | 'pacing';
}

export interface RoughCutSegment {
  /** Start time in source (seconds) */
  sourceStart: number;
  /** End time in source (seconds) */
  sourceEnd: number;
  /** Duration of this segment */
  duration: number;
  /** Quality score 0-1 */
  score: number;
  /** Visual highlight score at this segment */
  visualScore: number;
  /** Audio alignment score */
  audioScore: number;
}

export interface RoughCutProposal {
  /** Unique proposal ID */
  id: string;
  /** Proposal name */
  name: string;
  /** Ordered segments */
  segments: RoughCutSegment[];
  /** Total duration */
  totalDuration: number;
  /** Overall quality score 0-1 */
  qualityScore: number;
  /** Pacing score (how well it matches target CPM) */
  pacingScore: number;
  /** Visual highlight coverage (fraction of highlights used) */
  highlightCoverage: number;
  /** Cut points */
  cutPoints: CutPoint[];
  /** Description of the proposal strategy */
  description: string;
}

export interface RoughCutResult {
  /** Generated proposals (sorted by quality) */
  proposals: RoughCutProposal[];
  /** Input highlight count */
  inputHighlightCount: number;
  /** Input beat count */
  inputBeatCount: number;
  /** Source duration */
  sourceDuration: number;
}

// ==================== Cut Point Generation ====================

/**
 * Generate candidate cut points from visual highlights and audio beats.
 */
export function generateCutPoints(
  highlights: VisualHighlightMarker[],
  audioBeats: OnsetEvent[],
  sourceDuration: number,
  minGap = 0.5,
): CutPoint[] {
  const points: CutPoint[] = [];

  // Add visual highlight cut points
  for (const h of highlights) {
    points.push({
      time: h.time,
      confidence: h.score,
      reason: 'visual-highlight',
    });
  }

  // Add audio beat cut points
  for (const b of audioBeats) {
    // Check if near an existing visual highlight
    const nearVisual = points.some(
      (p) => p.reason === 'visual-highlight' && Math.abs(p.time - b.time) <= minGap,
    );
    if (nearVisual) {
      // Boost the existing point
      const existing = points.find(
        (p) => p.reason === 'visual-highlight' && Math.abs(p.time - b.time) <= minGap,
      );
      if (existing) {
        existing.confidence = Math.min(1, existing.confidence * 1.2);
        existing.reason = 'combined';
      }
    } else {
      points.push({
        time: b.time,
        confidence: b.strength * 0.7,
        reason: 'audio-beat',
      });
    }
  }

  // Sort by time
  points.sort((a, b) => a.time - b.time);

  // Remove duplicates within minGap
  const filtered: CutPoint[] = [];
  for (const p of points) {
    if (filtered.length === 0 || p.time - filtered[filtered.length - 1].time >= minGap) {
      filtered.push(p);
    } else if (p.confidence > filtered[filtered.length - 1].confidence) {
      filtered[filtered.length - 1] = p;
    }
  }

  return filtered;
}

// ==================== Segment Selection ====================

/**
 * Select segments from cut points to fill target duration.
 * Uses a greedy approach: pick highest-confidence segments first.
 */
export function selectSegments(
  cutPoints: CutPoint[],
  sourceDuration: number,
  config: RoughCutConfig,
): RoughCutSegment[] {
  if (cutPoints.length === 0 || sourceDuration <= 0) return [];

  // Build segment candidates between consecutive cut points
  const candidates: RoughCutSegment[] = [];
  const boundaries = [0, ...cutPoints.map((p) => p.time), sourceDuration];

  for (let i = 0; i < boundaries.length - 1; i += 1) {
    const start = boundaries[i];
    const end = boundaries[i + 1];
    const duration = end - start;

    if (duration < config.minClipDuration || duration > config.maxClipDuration) continue;

    // Find relevant cut points within this segment
    const segHighlights = cutPoints.filter(
      (p) => p.time >= start && p.time < end,
    );
    const avgConfidence = segHighlights.length > 0
      ? segHighlights.reduce((s, p) => s + p.confidence, 0) / segHighlights.length
      : 0.1;

    candidates.push({
      sourceStart: round(start),
      sourceEnd: round(end),
      duration: round(duration),
      score: round(avgConfidence),
      visualScore: round(
        segHighlights.filter((p) => p.reason === 'visual-highlight' || p.reason === 'combined')
          .reduce((s, p) => s + p.confidence, 0) / Math.max(1, segHighlights.length),
      ),
      audioScore: round(
        segHighlights.filter((p) => p.reason === 'audio-beat' || p.reason === 'combined')
          .reduce((s, p) => s + p.confidence, 0) / Math.max(1, segHighlights.length),
      ),
    });
  }

  // Sort by score descending
  candidates.sort((a, b) => b.score - a.score);

  // Greedy selection until target duration
  const selected: RoughCutSegment[] = [];
  let totalDuration = 0;
  const maxDuration = config.targetDuration * (1 + config.durationTolerance);
  const usedRanges: Array<{ start: number; end: number }> = [];

  for (const seg of candidates) {
    if (totalDuration >= maxDuration) break;

    // Check for overlap with already-selected segments
    const overlaps = usedRanges.some(
      (r) => seg.sourceStart < r.end && seg.sourceEnd > r.start,
    );
    if (overlaps) continue;

    selected.push(seg);
    totalDuration += seg.duration;
    usedRanges.push({ start: seg.sourceStart, end: seg.sourceEnd });
  }

  // Sort selected by source time for proper playback order
  selected.sort((a, b) => a.sourceStart - b.sourceStart);
  return selected;
}

// ==================== Scoring ====================

/**
 * Calculate pacing score based on cuts per minute.
 */
export function calculatePacingScore(segments: RoughCutSegment[], targetCpm: number): number {
  if (segments.length < 2 || targetCpm <= 0) return 1;
  const totalDuration = segments.reduce((s, seg) => s + seg.duration, 0);
  if (totalDuration <= 0) return 1;
  const actualCpm = ((segments.length - 1) / totalDuration) * 60;
  const ratio = actualCpm / targetCpm;
  // Score peaks at 1.0 when ratio is 1.0
  return round(Math.max(0, 1 - Math.abs(1 - ratio) * 0.5));
}

/**
 * Calculate highlight coverage (fraction of input highlights included).
 */
export function calculateHighlightCoverage(
  segments: RoughCutSegment[],
  highlights: VisualHighlightMarker[],
): number {
  if (highlights.length === 0) return 1;
  const covered = highlights.filter((h) =>
    segments.some((seg) => h.time >= seg.sourceStart && h.time < seg.sourceEnd),
  );
  return round(covered.length / highlights.length);
}

// ==================== Proposal Generation ====================

/**
 * Generate a "highlights-first" proposal: prioritize visual highlights.
 */
function generateHighlightsProposal(
  cutPoints: CutPoint[],
  sourceDuration: number,
  highlights: VisualHighlightMarker[],
  config: RoughCutConfig,
): RoughCutProposal {
  const segments = selectSegments(cutPoints, sourceDuration, config);
  const pacingScore = calculatePacingScore(segments, config.targetCpm);
  const highlightCoverage = calculateHighlightCoverage(segments, highlights);
  const totalDuration = segments.reduce((s, seg) => s + seg.duration, 0);
  const avgScore = segments.length > 0
    ? segments.reduce((s, seg) => s + seg.score, 0) / segments.length
    : 0;
  const qualityScore = round(
    avgScore * config.visualWeight +
    pacingScore * config.pacingWeight +
    highlightCoverage * config.audioWeight,
  );

  return {
    id: 'highlights-first',
    name: '高光优先',
    segments,
    totalDuration: round(totalDuration),
    qualityScore,
    pacingScore,
    highlightCoverage,
    cutPoints: cutPoints.filter((p) =>
      segments.some((seg) => Math.abs(p.time - seg.sourceStart) < 0.1 || Math.abs(p.time - seg.sourceEnd) < 0.1),
    ),
    description: '优先选取视觉高光时刻，确保精彩内容不遗漏',
  };
}

/**
 * Generate a "beat-sync" proposal: align cuts to audio beats.
 */
function generateBeatSyncProposal(
  cutPoints: CutPoint[],
  sourceDuration: number,
  highlights: VisualHighlightMarker[],
  audioBeats: OnsetEvent[],
  config: RoughCutConfig,
): RoughCutProposal {
  // Prefer combined and audio-beat cut points
  const beatAlignedPoints = cutPoints.filter(
    (p) => p.reason === 'audio-beat' || p.reason === 'combined',
  );
  const allPoints = beatAlignedPoints.length >= 2 ? beatAlignedPoints : cutPoints;

  const segments = selectSegments(allPoints, sourceDuration, config);
  const pacingScore = calculatePacingScore(segments, config.targetCpm);
  const highlightCoverage = calculateHighlightCoverage(segments, highlights);
  const totalDuration = segments.reduce((s, seg) => s + seg.duration, 0);
  const avgScore = segments.length > 0
    ? segments.reduce((s, seg) => s + seg.audioScore, 0) / segments.length
    : 0;
  const qualityScore = round(
    avgScore * config.audioWeight +
    pacingScore * config.pacingWeight +
    highlightCoverage * config.visualWeight,
  );

  return {
    id: 'beat-sync',
    name: '节奏同步',
    segments,
    totalDuration: round(totalDuration),
    qualityScore,
    pacingScore,
    highlightCoverage,
    cutPoints: cutPoints.filter((p) =>
      segments.some((seg) => Math.abs(p.time - seg.sourceStart) < 0.1 || Math.abs(p.time - seg.sourceEnd) < 0.1),
    ),
    description: '以音频节拍为基准对齐剪辑点，节奏感强',
  };
}

/**
 * Generate a "balanced" proposal: mix of visual and audio cues.
 */
function generateBalancedProposal(
  cutPoints: CutPoint[],
  sourceDuration: number,
  highlights: VisualHighlightMarker[],
  config: RoughCutConfig,
): RoughCutProposal {
  // Use all cut points equally
  const segments = selectSegments(cutPoints, sourceDuration, config);
  const pacingScore = calculatePacingScore(segments, config.targetCpm);
  const highlightCoverage = calculateHighlightCoverage(segments, highlights);
  const totalDuration = segments.reduce((s, seg) => s + seg.duration, 0);
  const avgScore = segments.length > 0
    ? segments.reduce((s, seg) => s + (seg.visualScore + seg.audioScore) / 2, 0) / segments.length
    : 0;
  const qualityScore = round(
    avgScore * 0.4 +
    pacingScore * config.pacingWeight +
    highlightCoverage * 0.4,
  );

  return {
    id: 'balanced',
    name: '均衡方案',
    segments,
    totalDuration: round(totalDuration),
    qualityScore,
    pacingScore,
    highlightCoverage,
    cutPoints: cutPoints.filter((p) =>
      segments.some((seg) => Math.abs(p.time - seg.sourceStart) < 0.1 || Math.abs(p.time - seg.sourceEnd) < 0.1),
    ),
    description: '平衡视觉高光与音频节奏，适合大多数场景',
  };
}

// ==================== Main Entry ====================

/**
 * Generate smart rough cut proposals.
 *
 * @param highlights - Visual highlight markers
 * @param audioBeats - Audio onset events
 * @param sourceDuration - Total source duration (seconds)
 * @param config - Generation configuration
 */
export function generateRoughCutProposals(
  highlights: VisualHighlightMarker[],
  audioBeats: OnsetEvent[],
  sourceDuration: number,
  config: Partial<RoughCutConfig> = {},
): RoughCutResult {
  const cfg = { ...DEFAULT_ROUGH_CUT_CONFIG, ...config };

  const cutPoints = generateCutPoints(highlights, audioBeats, sourceDuration);

  const proposals = [
    generateHighlightsProposal(cutPoints, sourceDuration, highlights, cfg),
    generateBeatSyncProposal(cutPoints, sourceDuration, highlights, audioBeats, cfg),
    generateBalancedProposal(cutPoints, sourceDuration, highlights, cfg),
  ].sort((a, b) => b.qualityScore - a.qualityScore);

  return {
    proposals,
    inputHighlightCount: highlights.length,
    inputBeatCount: audioBeats.length,
    sourceDuration,
  };
}

/**
 * Build system prompt for AI-assisted rough cut refinement.
 */
export function buildRoughCutSystemPrompt(): string {
  return [
    '你是一个专业的视频粗剪助手。用户会给你一组粗剪方案及其评分。',
    '请分析这些方案并提供优化建议，返回严格JSON:',
    '{',
    '  "recommendedProposalId": "最佳方案ID",',
    '  "adjustments": [',
    '    {"segmentIndex": 0, "action": "keep|remove|extend|shorten", "reason": "原因"}',
    '  ],',
    '  "overallFeedback": "总体建议"',
    '}',
    '只返回JSON对象。',
  ].join('\n');
}

/**
 * Build user prompt for AI rough cut refinement.
 */
export function buildRoughCutUserPrompt(result: RoughCutResult): string {
  const lines = [`源素材时长: ${result.sourceDuration}秒`, `检测到高光: ${result.inputHighlightCount}个`, `检测到节拍: ${result.inputBeatCount}个`, ''];

  for (const proposal of result.proposals) {
    lines.push(`方案: ${proposal.name} (${proposal.id})`);
    lines.push(`  时长: ${proposal.totalDuration}秒, 质量: ${proposal.qualityScore}, 节奏: ${proposal.pacingScore}, 覆盖: ${proposal.highlightCoverage}`);
    lines.push(`  片段数: ${proposal.segments.length}`);
    lines.push(`  说明: ${proposal.description}`);
    lines.push('');
  }

  return lines.join('\n');
}
