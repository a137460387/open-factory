/**
 * AI narrative structure analyzer.
 *
 * Analyzes a sequence of content segments and emotion curves to identify
 * three-act story structure, generate narrative arcs, score completeness,
 * and produce improvement suggestions.
 */

import type { ContentAnalysisSegment, ContentEmotionPoint, ContentSceneType } from './content-analysis';

// --- Types ---

/** One narrative act within a three-act (or four-part) structure */
export interface NarrativeAct {
  label: 'setup' | 'development' | 'climax' | 'resolution';
  start: number;
  end: number;
  segmentIndices: number[];
}

/** Identified story structure built from segment / emotion data */
export interface NarrativeStructure {
  acts: NarrativeAct[];
  peakIndex: number;
  troughIndex: number;
  hasClimax: boolean;
}

/** A single point on the visual narrative arc */
export interface ArcPoint {
  time: number;
  tension: number;
  act: NarrativeAct['label'];
}

/** Full narrative arc suitable for charting */
export interface NarrativeArc {
  points: ArcPoint[];
  peakTime: number;
  troughTime: number;
}

/** One actionable suggestion for improving narrative quality */
export interface NarrativeSuggestion {
  category: 'pacing' | 'structure' | 'emotion' | 'engagement';
  severity: 'info' | 'warning' | 'critical';
  message: string;
}

/** Complete result of narrative analysis */
export interface NarrativeAnalysisResult {
  structure: NarrativeStructure;
  arc: NarrativeArc;
  score: number;
  suggestions: NarrativeSuggestion[];
}

// --- Main entry point ---

/**
 * Analyse the narrative structure of a clip given its content segments
 * and emotion curve.
 *
 * Pure function -- no side effects.
 *
 * @param segments  - Ordered content analysis segments from `content-analysis.ts`
 * @param emotionCurve - Sampled emotion points from `content-analysis.ts`
 * @returns Full narrative analysis result
 */
export function analyzeNarrative(
  segments: ContentAnalysisSegment[],
  emotionCurve: ContentEmotionPoint[],
): NarrativeAnalysisResult {
  const safeSegments = segments.length > 0 ? segments : fallbackSegments(emotionCurve);
  const safeCurve = emotionCurve.length > 0 ? emotionCurve : fallbackCurve(safeSegments);

  const structure = identifyStructure(safeSegments, safeCurve);
  const arc = buildArc(safeCurve, structure);
  const score = computeScore(structure, arc, safeCurve);
  const suggestions = generateSuggestions(structure, arc, score, safeCurve);

  return { structure, arc, score, suggestions };
}

// --- Structure identification ---

/**
 * Identify three-act narrative structure from segment sequence and emotion
 * curve.  Segments are bucketed into four parts: setup / development /
 * climax / resolution based on emotion peaks and troughs.
 */
function identifyStructure(segments: ContentAnalysisSegment[], curve: ContentEmotionPoint[]): NarrativeStructure {
  const peakIndex = findPeakIndex(curve);
  const troughIndex = findTroughIndex(curve);

  const totalDuration = segments[segments.length - 1].end - segments[0].start;
  const peakTime = curve[peakIndex].time;
  const troughTime = curve[troughIndex].time;

  const acts: NarrativeAct[] = [];

  // Setup: start -> 25% mark (or peak if it comes first)
  const setupEnd = Math.min(segments[0].start + totalDuration * 0.25, peakTime);
  acts.push(buildAct('setup', segments, segments[0].start, setupEnd));

  // Development: setup end -> peak
  const developmentStart = setupEnd;
  const developmentEnd = peakTime;
  acts.push(buildAct('development', segments, developmentStart, developmentEnd));

  // Climax: peak -> trough (or 75% mark)
  const climaxStart = peakTime;
  const climaxEnd = Math.max(troughTime, segments[0].start + totalDuration * 0.75);
  acts.push(buildAct('climax', segments, climaxStart, Math.min(climaxEnd, segments[segments.length - 1].end)));

  // Resolution: climax end -> end
  const resolutionStart = Math.min(climaxEnd, segments[segments.length - 1].end);
  const resolutionEnd = segments[segments.length - 1].end;
  acts.push(buildAct('resolution', segments, resolutionStart, resolutionEnd));

  const hasClimax = acts.some((a) => a.label === 'climax' && a.segmentIndices.length > 0);
  return { acts, peakIndex, troughIndex, hasClimax };
}

function buildAct(
  label: NarrativeAct['label'],
  segments: ContentAnalysisSegment[],
  start: number,
  end: number,
): NarrativeAct {
  const segmentIndices: number[] = [];
  for (let i = 0; i < segments.length; i += 1) {
    const seg = segments[i];
    if (seg.end > start && seg.start < end) {
      segmentIndices.push(i);
    }
  }
  return { label, start: round(start), end: round(end), segmentIndices };
}

// --- Arc generation ---

/**
 * Generate a narrative arc (series of tension points) from the emotion
 * curve, annotated with the act each point belongs to.
 */
function buildArc(curve: ContentEmotionPoint[], structure: NarrativeStructure): NarrativeArc {
  const peakTime = curve[structure.peakIndex].time;
  const troughTime = curve[structure.troughIndex].time;

  const points: ArcPoint[] = curve.map((point) => {
    const act = resolveAct(point.time, structure.acts);
    const tension = computeTension(point, curve);
    return { time: point.time, tension: round(tension), act };
  });

  return { points, peakTime, troughTime };
}

/**
 * Compute a tension value for a single emotion point.
 * Combines the raw emotion value with local gradient to reflect rising /
 * falling action.
 */
function computeTension(point: ContentEmotionPoint, curve: ContentEmotionPoint[]): number {
  const index = curve.indexOf(point);
  const prev = index > 0 ? curve[index - 1] : point;
  const gradient = point.value - prev.value;
  return clamp01(point.value * 0.7 + (gradient + 1) * 0.15 + point.brightness * 0.15);
}

function resolveAct(time: number, acts: NarrativeAct[]): NarrativeAct['label'] {
  for (const act of acts) {
    if (time >= act.start && time < act.end) {
      return act.label;
    }
  }
  // Fallback to last act
  return acts[acts.length - 1]?.label ?? 'resolution';
}

// --- Scoring ---

/**
 * Compute a 0-100 narrative completeness score.
 *
 * Factors:
 * - Presence and balance of all four acts
 * - Emotion variance (higher = more dynamic story)
 * - Peak/trough separation (good stories have distinct peaks and valleys)
 */
function computeScore(structure: NarrativeStructure, arc: NarrativeArc, curve: ContentEmotionPoint[]): number {
  let score = 0;

  // Act coverage (up to 40 pts)
  const nonEmptyActs = structure.acts.filter((a) => a.segmentIndices.length > 0).length;
  score += (nonEmptyActs / 4) * 40;

  // Emotion variance (up to 30 pts)
  const values = curve.map((p) => p.value);
  const emotionVariance = variance(values);
  score += clamp01(emotionVariance * 4) * 30;

  // Peak-trough separation (up to 30 pts)
  const separation = Math.abs(curve[structure.peakIndex].value - curve[structure.troughIndex].value);
  score += clamp01(separation * 1.5) * 30;

  return round(clamp01(score / 100) * 100);
}

// --- Suggestions ---

/**
 * Generate narrative improvement suggestions based on the analysis.
 */
function generateSuggestions(
  structure: NarrativeStructure,
  arc: NarrativeArc,
  score: number,
  curve: ContentEmotionPoint[],
): NarrativeSuggestion[] {
  const suggestions: NarrativeSuggestion[] = [];

  // Check act balance
  const totalDuration = structure.acts[structure.acts.length - 1].end - structure.acts[0].start;
  for (const act of structure.acts) {
    const ratio = totalDuration > 0 ? (act.end - act.start) / totalDuration : 0;
    if (act.label === 'setup' && ratio > 0.4) {
      suggestions.push({
        category: 'pacing',
        severity: 'warning',
        message: 'The setup phase is too long relative to total duration. Consider tightening the opening.',
      });
    }
    if (act.label === 'resolution' && ratio > 0.35) {
      suggestions.push({
        category: 'pacing',
        severity: 'warning',
        message: 'The resolution extends too far. Consider trimming the ending for a tighter close.',
      });
    }
    if (act.segmentIndices.length === 0) {
      suggestions.push({
        category: 'structure',
        severity: 'critical',
        message: `The "${act.label}" act has no content segments. The story may feel incomplete.`,
      });
    }
  }

  // Check emotion dynamics
  const values = curve.map((p) => p.value);
  const emotionVariance = variance(values);
  if (emotionVariance < 0.02) {
    suggestions.push({
      category: 'emotion',
      severity: 'warning',
      message: 'The emotion curve is very flat. Consider adding more emotional contrast to improve engagement.',
    });
  }

  // Check peak/trough separation
  const peakTroughDiff = Math.abs(curve[structure.peakIndex].value - curve[structure.troughIndex].value);
  if (peakTroughDiff < 0.15) {
    suggestions.push({
      category: 'engagement',
      severity: 'info',
      message:
        'The emotional peak and trough are very close in intensity. A more dramatic arc may improve viewer retention.',
    });
  }

  // Check for monotonic trends
  const firstHalfAvg = average(values.slice(0, Math.floor(values.length / 2)));
  const secondHalfAvg = average(values.slice(Math.floor(values.length / 2)));
  if (secondHalfAvg < firstHalfAvg * 0.5) {
    suggestions.push({
      category: 'engagement',
      severity: 'warning',
      message: 'Energy drops significantly in the second half. Consider redistributing high-energy moments.',
    });
  }

  // Overall score feedback
  if (score >= 80) {
    suggestions.push({
      category: 'structure',
      severity: 'info',
      message: 'Narrative structure is strong. The story arc is well-formed and engaging.',
    });
  } else if (score < 50) {
    suggestions.push({
      category: 'structure',
      severity: 'critical',
      message:
        'Narrative structure needs significant improvement. Consider restructuring to follow a clearer three-act pattern.',
    });
  }

  return suggestions;
}

// --- Utility helpers ---

function findPeakIndex(curve: ContentEmotionPoint[]): number {
  let peak = 0;
  for (let i = 1; i < curve.length; i += 1) {
    if (curve[i].value > curve[peak].value) {
      peak = i;
    }
  }
  return peak;
}

function findTroughIndex(curve: ContentEmotionPoint[]): number {
  let trough = 0;
  for (let i = 1; i < curve.length; i += 1) {
    if (curve[i].value < curve[trough].value) {
      trough = i;
    }
  }
  return trough;
}

function fallbackSegments(curve: ContentEmotionPoint[]): ContentAnalysisSegment[] {
  if (curve.length === 0) {
    return [{ start: 0, end: 1, sceneTypes: ['indoor' as ContentSceneType], brightness: 0.5, motion: 0.1 }];
  }
  return curve.map((point, i) => {
    const next = curve[i + 1];
    return {
      start: point.time,
      end: next ? next.time : point.time + 1,
      sceneTypes: ['indoor' as ContentSceneType],
      brightness: point.brightness,
      motion: 0.1,
    };
  });
}

function fallbackCurve(segments: ContentAnalysisSegment[]): ContentEmotionPoint[] {
  return segments.map((seg) => ({
    time: seg.start,
    value: clamp01(seg.brightness * 0.6 + seg.motion * 0.4),
    brightness: seg.brightness,
  }));
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((total, v) => total + v, 0) / values.length;
}

function variance(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  const mean = average(values);
  return average(values.map((v) => (v - mean) ** 2));
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(1, Math.max(0, value));
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}
