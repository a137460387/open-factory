/**
 * Template Recommender Engine
 *
 * Scores and ranks editing templates based on project content characteristics
 * and user preferences. Uses weighted cosine similarity across three dimensions:
 * - Content match (40%): duration, category, pacing fit
 * - User preference (30%): historical category/pace/transition affinity
 * - Material fit (30%): how well project assets match template requirements
 *
 * Pipeline:
 * 1. Extract ProjectContentProfile from project timeline
 * 2. Score each candidate template against profile + preferences
 * 3. Rank by composite score, return Top-K with explanations
 */

import type { EditingTemplate, TemplateCategory } from '../models/template-schema';
import type { Project, Clip, Track, Timeline } from '../model-types';

// ─── Public Types ─────────────────────────────────────────────────

/** Content characteristics extracted from a project */
export interface ProjectContentProfile {
  /** Total duration in seconds */
  duration: number;
  /** Number of clips across all tracks */
  clipCount: number;
  /** Average motion intensity 0-1 (derived from clip speed variance) */
  avgMotion: number;
  /** Whether project contains audio dialogue tracks */
  hasDialogue: boolean;
  /** Detected music genre hint from track names, or null */
  musicGenre: string | null;
  /** Overall mood: 'energetic' | 'calm' | 'neutral' based on pacing */
  mood: 'energetic' | 'calm' | 'neutral';
  /** Dominant clip type */
  dominantClipType: Clip['type'];
  /** Average clip duration in seconds */
  avgClipDuration: number;
  /** Transition density: transitions per minute */
  transitionDensity: number;
}

/** User preference profile for template selection */
export interface UserPreference {
  /** Categories the user favors (ordered by affinity) */
  favoriteCategories: ReadonlyArray<TemplateCategory>;
  /** Preferred editing pace */
  preferredPace: 'fast' | 'medium' | 'slow';
  /** Transition types the user prefers */
  preferredTransitions: ReadonlyArray<string>;
}

/** A scored template recommendation with reasoning */
export interface TemplateRecommendation {
  /** The recommended template */
  template: EditingTemplate;
  /** Composite score 0-1 */
  score: number;
  /** Human-readable recommendation reasons */
  reasons: ReadonlyArray<string>;
  /** Per-dimension match scores */
  matchDimensions: {
    /** Content match score 0-1 */
    contentMatch: number;
    /** User preference score 0-1 */
    preferenceMatch: number;
    /** Material fit score 0-1 */
    materialFit: number;
  };
}

// ─── Scoring Weights ──────────────────────────────────────────────

const WEIGHTS = {
  content: 0.4,
  preference: 0.3,
  material: 0.3,
} as const;

// ─── Content Profile Extraction ───────────────────────────────────

/**
 * Extract a content profile from a project's timeline.
 * Analyzes clip durations, types, transitions, and audio tracks
 * to characterize the project's editing style.
 *
 * @param project - The project to analyze
 * @returns Content profile describing project characteristics
 */
export function extractProjectContentProfile(project: Project): ProjectContentProfile {
  const timeline = project.timeline;
  const allClips = getAllClips(timeline);
  const transitions = timeline.transitions ?? [];

  const duration = allClips.reduce((sum, c) => sum + c.duration, 0);
  const clipCount = allClips.length;
  const avgClipDuration = clipCount > 0 ? duration / clipCount : 0;

  // Motion: normalized stddev of clip speeds (higher variance = more motion)
  const speeds = allClips
    .filter((c): c is Clip & { speed: number } => 'speed' in c && typeof c.speed === 'number')
    .map((c) => c.speed);
  const avgMotion = speeds.length > 0 ? calcNormalizedStddev(speeds) : 0;

  // Dialogue detection: audio tracks with voice/dialogue indicators
  const hasDialogue = timeline.tracks.some((t) =>
    t.type === 'audio' && /voice|dialogue|speech|narr/i.test(t.name),
  );

  // Music genre from track names
  const musicGenre = detectMusicGenre(timeline);

  // Mood from pacing
  const cutsPerMin = duration > 0 ? (clipCount / duration) * 60 : 0;
  const mood: ProjectContentProfile['mood'] =
    cutsPerMin > 12 ? 'energetic' : cutsPerMin < 4 ? 'calm' : 'neutral';

  // Dominant clip type
  const dominantClipType = findDominantType(allClips);

  // Transition density
  const transitionDensity = duration > 0 ? (transitions.length / duration) * 60 : 0;

  return {
    duration,
    clipCount,
    avgMotion: clamp(avgMotion, 0, 1),
    hasDialogue,
    musicGenre,
    mood,
    dominantClipType,
    avgClipDuration,
    transitionDensity,
  };
}

// ─── Template Scoring ─────────────────────────────────────────────

/**
 * Score a single template against a project profile and user preferences.
 * Uses weighted cosine similarity across three dimensions.
 *
 * @param template - The template to score
 * @param profile - Project content profile
 * @param preferences - User preference profile
 * @returns Recommendation with score, reasons, and dimension breakdown
 */
export function scoreTemplate(
  template: EditingTemplate,
  profile: ProjectContentProfile,
  preferences: UserPreference,
): TemplateRecommendation {
  const contentMatch = scoreContentMatch(template, profile);
  const preferenceMatch = scorePreferenceMatch(template, preferences);
  const materialFit = scoreMaterialFit(template, profile);

  const score = round3(
    WEIGHTS.content * contentMatch +
    WEIGHTS.preference * preferenceMatch +
    WEIGHTS.material * materialFit,
  );

  const reasons = buildReasons(template, profile, preferences, {
    contentMatch,
    preferenceMatch,
    materialFit,
  });

  return {
    template,
    score,
    reasons,
    matchDimensions: { contentMatch, preferenceMatch, materialFit },
  };
}

/**
 * Recommend Top-K templates from a list of candidates.
 * Scores all templates and returns the highest-scoring ones.
 *
 * @param templates - Candidate templates to evaluate
 * @param profile - Project content profile
 * @param preferences - User preference profile
 * @param topK - Number of recommendations to return (default 5)
 * @returns Sorted recommendations (highest score first)
 */
export function recommendTemplates(
  templates: ReadonlyArray<EditingTemplate>,
  profile: ProjectContentProfile,
  preferences: UserPreference,
  topK: number = 5,
): ReadonlyArray<TemplateRecommendation> {
  return templates
    .map((t) => scoreTemplate(t, profile, preferences))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

/**
 * Generate a human-readable explanation for a recommendation.
 *
 * @param recommendation - The recommendation to explain
 * @returns Multi-line explanation string
 */
export function explainRecommendation(recommendation: TemplateRecommendation): string {
  const { template, score, reasons, matchDimensions } = recommendation;
  const pct = (v: number) => Math.round(v * 100);

  const lines = [
    `"${template.metadata.name}" (score: ${pct(score)}%)`,
    '',
    `Content match: ${pct(matchDimensions.contentMatch)}%`,
    `Preference match: ${pct(matchDimensions.preferenceMatch)}%`,
    `Material fit: ${pct(matchDimensions.materialFit)}%`,
    '',
    'Reasons:',
  ];

  for (const reason of reasons) {
    lines.push(`  - ${reason}`);
  }

  return lines.join('\n');
}

// ─── Dimension Scorers ────────────────────────────────────────────

/** Score how well template content matches the project (0-1) */
function scoreContentMatch(
  template: EditingTemplate,
  profile: ProjectContentProfile,
): number {
  const dimensions: number[] = [];

  // Duration fit: how close template duration is to project duration
  const templateDur = template.metadata.estimatedDurationSec;
  const durationRatio = Math.min(templateDur, profile.duration) /
    Math.max(templateDur, profile.duration, 1);
  dimensions.push(durationRatio);

  // Category match: does template category align with detected mood
  const categoryMoodScore = scoreCategoryMood(template.metadata.category, profile.mood);
  dimensions.push(categoryMoodScore);

  // Pacing fit: template clip count vs project clip count
  const templateClipCount = template.tracks.reduce((s, t) => s + t.clips.length, 0);
  const clipCountRatio = Math.min(templateClipCount, profile.clipCount) /
    Math.max(templateClipCount, profile.clipCount, 1);
  dimensions.push(clipCountRatio);

  // Aspect ratio awareness (minor factor)
  const arScore = template.metadata.aspectRatio === '16:9' ? 1 : 0.8;
  dimensions.push(arScore);

  return cosineSimilarity(dimensions, new Array(dimensions.length).fill(1));
}

/** Score how well template matches user preferences (0-1) */
function scorePreferenceMatch(
  template: EditingTemplate,
  preferences: UserPreference,
): number {
  const dimensions: number[] = [];

  // Category preference
  const catIdx = preferences.favoriteCategories.indexOf(template.metadata.category);
  const categoryScore = catIdx >= 0
    ? 1 - catIdx / Math.max(preferences.favoriteCategories.length, 1)
    : 0;
  dimensions.push(categoryScore);

  // Pace preference vs template rhythm
  const templatePace = inferTemplatePace(template);
  const paceScore = templatePace === preferences.preferredPace ? 1 :
    (templatePace === 'medium' || preferences.preferredPace === 'medium') ? 0.5 : 0;
  dimensions.push(paceScore);

  // Transition preference overlap
  const templateTransitions = new Set(
    template.tracks.flatMap((t) => t.transitions.map((tr) => tr.type)),
  );
  const preferredSet = new Set(preferences.preferredTransitions);
  const overlap = [...templateTransitions].filter((t) => preferredSet.has(t)).length;
  const union = new Set([...templateTransitions, ...preferredSet]).size;
  const transScore = union > 0 ? overlap / union : 0.5;
  dimensions.push(transScore);

  return cosineSimilarity(dimensions, new Array(dimensions.length).fill(1));
}

/** Score how well project assets fit template requirements (0-1) */
function scoreMaterialFit(
  template: EditingTemplate,
  profile: ProjectContentProfile,
): number {
  const dimensions: number[] = [];

  // Dialogue compatibility: templates with voice role score higher for dialogue projects
  const hasVoiceRole = template.audioLayout.tracks.some((t) => t.role === 'voice');
  const dialogueScore = profile.hasDialogue
    ? (hasVoiceRole ? 1 : 0.3)
    : (hasVoiceRole ? 0.7 : 1);
  dimensions.push(dialogueScore);

  // Motion compatibility: high-motion projects need templates that support it
  const templateHasEffects = template.tracks.some((t) =>
    t.clips.some((c) => c.effects.length > 0),
  );
  const motionScore = profile.avgMotion > 0.5
    ? (templateHasEffects ? 1 : 0.4)
    : 0.8;
  dimensions.push(motionScore);

  // Clip type compatibility
  const templatePlaceholderTypes = new Set(
    template.tracks.flatMap((t) => t.clips.map((c) => c.placeholder)),
  );
  const typeScore = scoreClipTypeFit(profile.dominantClipType, templatePlaceholderTypes);
  dimensions.push(typeScore);

  // Music genre alignment (minor factor)
  const musicScore = profile.musicGenre
    ? (template.metadata.tags.includes(profile.musicGenre) ? 1 : 0.6)
    : 0.7;
  dimensions.push(musicScore);

  return cosineSimilarity(dimensions, new Array(dimensions.length).fill(1));
}

// ─── Reason Builder ───────────────────────────────────────────────

function buildReasons(
  template: EditingTemplate,
  profile: ProjectContentProfile,
  preferences: UserPreference,
  scores: { contentMatch: number; preferenceMatch: number; materialFit: number },
): string[] {
  const reasons: string[] = [];

  // Top content reasons
  if (scores.contentMatch > 0.7) {
    reasons.push(`Duration closely matches project (${Math.round(template.metadata.estimatedDurationSec)}s vs ${Math.round(profile.duration)}s)`);
  }
  if (template.metadata.category === profile.mood ||
    scoreCategoryMood(template.metadata.category, profile.mood) > 0.7) {
    reasons.push(`Template style fits project ${profile.mood} mood`);
  }

  // Top preference reasons
  if (preferences.favoriteCategories.includes(template.metadata.category)) {
    reasons.push(`Matches your preferred category: ${template.metadata.category}`);
  }
  const templatePace = inferTemplatePace(template);
  if (templatePace === preferences.preferredPace) {
    reasons.push(`Pace matches your preference: ${preferences.preferredPace}`);
  }

  // Top material reasons
  if (profile.hasDialogue && template.audioLayout.tracks.some((t) => t.role === 'voice')) {
    reasons.push('Template includes voice track layout for your dialogue content');
  }
  if (profile.avgMotion > 0.5 && template.tracks.some((t) => t.clips.some((c) => c.effects.length > 0))) {
    reasons.push('Template supports effects that suit your dynamic footage');
  }

  // Fallback
  if (reasons.length === 0) {
    reasons.push('General purpose template with balanced characteristics');
  }

  return reasons;
}

// ─── Utilities ────────────────────────────────────────────────────

function getAllClips(timeline: Timeline): Clip[] {
  return timeline.tracks.flatMap((t) => t.clips);
}

function calcNormalizedStddev(values: ReadonlyArray<number>): number {
  if (values.length <= 1) return 0;
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance) / Math.max(mean, 1);
}

function cosineSimilarity(
  a: ReadonlyArray<number>,
  b: ReadonlyArray<number>,
): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom > 0 ? clamp(dot / denom, 0, 1) : 0;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function scoreCategoryMood(category: TemplateCategory, mood: ProjectContentProfile['mood']): number {
  const moodCategoryMap: Record<ProjectContentProfile['mood'], ReadonlyArray<TemplateCategory>> = {
    energetic: ['vlog', 'short-form', 'music-video'],
    calm: ['documentary', 'tutorial'],
    neutral: ['product-demo', 'custom', 'tutorial'],
  };
  return moodCategoryMap[mood].includes(category) ? 1 : 0.3;
}

function inferTemplatePace(template: EditingTemplate): UserPreference['preferredPace'] {
  const totalClips = template.tracks.reduce((s, t) => s + t.clips.length, 0);
  const duration = template.metadata.estimatedDurationSec;
  const cutsPerMin = duration > 0 ? (totalClips / duration) * 60 : 0;
  if (cutsPerMin > 12) return 'fast';
  if (cutsPerMin < 5) return 'slow';
  return 'medium';
}

function detectMusicGenre(timeline: Timeline): string | null {
  const musicTracks = timeline.tracks.filter((t) =>
    t.type === 'audio' && /music|bgm|soundtrack/i.test(t.name),
  );
  if (musicTracks.length === 0) return null;
  // Extract genre hint from track name patterns
  const name = musicTracks[0].name.toLowerCase();
  const genres = ['pop', 'rock', 'jazz', 'electronic', 'classical', 'hip-hop', 'ambient', 'lo-fi'];
  for (const genre of genres) {
    if (name.includes(genre)) return genre;
  }
  return null;
}

function findDominantType(clips: ReadonlyArray<Clip>): Clip['type'] {
  const counts = new Map<Clip['type'], number>();
  for (const c of clips) {
    counts.set(c.type, (counts.get(c.type) ?? 0) + 1);
  }
  let maxCount = 0;
  let dominant: Clip['type'] = 'video';
  for (const [type, count] of counts) {
    if (count > maxCount) {
      maxCount = count;
      dominant = type;
    }
  }
  return dominant;
}

function scoreClipTypeFit(
  dominantType: Clip['type'],
  placeholderTypes: ReadonlySet<string>,
): number {
  const typePlaceholderMap: Record<string, ReadonlyArray<string>> = {
    video: ['user-video'],
    image: ['user-image'],
    audio: ['user-audio'],
    text: ['generated-text'],
    subtitle: ['generated-text'],
  };
  const expected = typePlaceholderMap[dominantType] ?? [];
  if (expected.length === 0) return 0.7;
  const hasMatch = expected.some((p) => placeholderTypes.has(p));
  return hasMatch ? 1 : 0.4;
}
