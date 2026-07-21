/**
 * Template Recommender Engine
 *
 * Scores and ranks editing templates based on project content characteristics
 * and user preferences. Uses weighted cosine similarity across three dimensions:
 * - Content match (40%): duration, category, pacing fit
 * - User preference (30%): historical category/pace/transition affinity
 * - Material fit (30%): how well project assets match template requirements
 */

import type { EditingTemplate, TemplateCategory } from '../models/template-schema';
import type { Project, Clip, Timeline } from '../model-types';

// ─── Public Types ─────────────────────────────────────────────────

/** Content characteristics extracted from a project */
export interface ProjectContentProfile {
  duration: number;
  clipCount: number;
  /** Average motion intensity 0-1 (derived from clip speed variance) */
  avgMotion: number;
  hasDialogue: boolean;
  /** Detected music genre hint from track names, or null */
  musicGenre: string | null;
  /** Overall mood based on pacing */
  mood: 'energetic' | 'calm' | 'neutral';
  dominantClipType: Clip['type'];
  avgClipDuration: number;
  /** Transitions per minute */
  transitionDensity: number;
}

/** User preference profile for template selection */
export interface UserPreference {
  /** Categories ordered by affinity */
  favoriteCategories: ReadonlyArray<TemplateCategory>;
  preferredPace: 'fast' | 'medium' | 'slow';
  preferredTransitions: ReadonlyArray<string>;
}

/** A scored template recommendation with reasoning */
export interface AITemplateRecommendation {
  template: EditingTemplate;
  /** Composite score 0-1 */
  score: number;
  reasons: ReadonlyArray<string>;
  matchDimensions: {
    contentMatch: number;
    preferenceMatch: number;
    materialFit: number;
  };
}

// ─── Constants ────────────────────────────────────────────────────

const WEIGHTS = { content: 0.4, preference: 0.3, material: 0.3 } as const;

const MOOD_CATEGORIES: Record<string, ReadonlyArray<TemplateCategory>> = {
  energetic: ['vlog', 'short-form', 'music-video'],
  calm: ['documentary', 'tutorial'],
  neutral: ['product-demo', 'custom', 'tutorial'],
};

const TYPE_PLACEHOLDER_MAP: Record<string, ReadonlyArray<'user-video' | 'user-image' | 'user-audio' | 'generated-text'>> = {
  video: ['user-video'],
  image: ['user-image'],
  audio: ['user-audio'],
  text: ['generated-text'],
  subtitle: ['generated-text'],
};

// ─── Content Profile Extraction ───────────────────────────────────

/**
 * Extract a content profile from a project's timeline.
 * Analyzes clip durations, types, transitions, and audio tracks
 * to characterize the project's editing style.
 */
export function extractProjectContentProfile(project: Project): ProjectContentProfile {
  const timeline = project.timeline;
  const allClips = getAllClips(timeline);
  const transitions = timeline.transitions ?? [];

  const duration = allClips.reduce((sum, c) => sum + c.duration, 0);
  const clipCount = allClips.length;
  const avgClipDuration = clipCount > 0 ? duration / clipCount : 0;

  const speeds = allClips
    .filter((c): c is Clip & { speed: number } => 'speed' in c && typeof c.speed === 'number')
    .map((c) => c.speed);
  const avgMotion = speeds.length > 0 ? clamp(calcNormalizedStddev(speeds), 0, 1) : 0;

  const hasDialogue = timeline.tracks.some((t) =>
    t.type === 'audio' && /voice|dialogue|speech|narr/i.test(t.name),
  );

  const cutsPerMin = duration > 0 ? (clipCount / duration) * 60 : 0;
  const mood: ProjectContentProfile['mood'] =
    cutsPerMin > 12 ? 'energetic' : cutsPerMin < 4 ? 'calm' : 'neutral';

  return {
    duration,
    clipCount,
    avgMotion,
    hasDialogue,
    musicGenre: detectMusicGenre(timeline),
    mood,
    dominantClipType: findDominantType(allClips),
    avgClipDuration,
    transitionDensity: duration > 0 ? (transitions.length / duration) * 60 : 0,
  };
}

// ─── Template Scoring ─────────────────────────────────────────────

/**
 * Score a single template against a project profile and user preferences.
 * Uses weighted cosine similarity across content, preference, and material dimensions.
 */
export function scoreTemplate(
  template: EditingTemplate,
  profile: ProjectContentProfile,
  preferences: UserPreference,
): AITemplateRecommendation {
  const contentMatch = scoreContentMatch(template, profile);
  const preferenceMatch = scorePreferenceMatch(template, preferences);
  const materialFit = scoreMaterialFit(template, profile);

  const score = round3(
    WEIGHTS.content * contentMatch +
    WEIGHTS.preference * preferenceMatch +
    WEIGHTS.material * materialFit,
  );

  return {
    template,
    score,
    reasons: buildReasons(template, profile, preferences, { contentMatch, preferenceMatch, materialFit }),
    matchDimensions: { contentMatch, preferenceMatch, materialFit },
  };
}

/**
 * Recommend Top-K templates from a list of candidates.
 * Scores all templates and returns the highest-scoring ones sorted by score descending.
 */
export function recommendTemplates(
  templates: ReadonlyArray<EditingTemplate>,
  profile: ProjectContentProfile,
  preferences: UserPreference,
  topK: number = 5,
): ReadonlyArray<AITemplateRecommendation> {
  return templates
    .map((t) => scoreTemplate(t, profile, preferences))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

/**
 * Generate a human-readable explanation for a recommendation.
 * Includes dimension scores and individual reasons.
 */
export function explainRecommendation(recommendation: AITemplateRecommendation): string {
  const { template, score, reasons, matchDimensions } = recommendation;
  const pct = (v: number) => Math.round(v * 100);

  return [
    `"${template.metadata.name}" (score: ${pct(score)}%)`,
    '',
    `Content match: ${pct(matchDimensions.contentMatch)}%`,
    `Preference match: ${pct(matchDimensions.preferenceMatch)}%`,
    `Material fit: ${pct(matchDimensions.materialFit)}%`,
    '',
    'Reasons:',
    ...reasons.map((r) => `  - ${r}`),
  ].join('\n');
}

// ─── Dimension Scorers ────────────────────────────────────────────

function scoreContentMatch(template: EditingTemplate, profile: ProjectContentProfile): number {
  const templateDur = template.metadata.estimatedDurationSec;
  const durationRatio = Math.min(templateDur, profile.duration) /
    Math.max(templateDur, profile.duration, 1);

  const categoryMood = (MOOD_CATEGORIES[profile.mood] ?? []).includes(template.metadata.category)
    ? 1 : 0.3;

  const templateClipCount = template.tracks.reduce((s, t) => s + t.clips.length, 0);
  const clipCountRatio = Math.min(templateClipCount, profile.clipCount) /
    Math.max(templateClipCount, profile.clipCount, 1);

  const arScore = template.metadata.aspectRatio === '16:9' ? 1 : 0.8;

  return cosineSimilarity([durationRatio, categoryMood, clipCountRatio, arScore], [1, 1, 1, 1]);
}

function scorePreferenceMatch(template: EditingTemplate, preferences: UserPreference): number {
  const catIdx = preferences.favoriteCategories.indexOf(template.metadata.category);
  const categoryScore = catIdx >= 0
    ? 1 - catIdx / Math.max(preferences.favoriteCategories.length, 1) : 0;

  const templatePace = inferTemplatePace(template);
  const paceScore = templatePace === preferences.preferredPace ? 1
    : (templatePace === 'medium' || preferences.preferredPace === 'medium') ? 0.5 : 0;

  const templateTransitions = new Set(
    template.tracks.flatMap((t) => t.transitions.map((tr) => tr.type)),
  );
  const preferredSet = new Set(preferences.preferredTransitions);
  const overlap = [...templateTransitions].filter((t) => preferredSet.has(t)).length;
  const union = new Set([...templateTransitions, ...preferredSet]).size;
  const transScore = union > 0 ? overlap / union : 0.5;

  return cosineSimilarity([categoryScore, paceScore, transScore], [1, 1, 1]);
}

function scoreMaterialFit(template: EditingTemplate, profile: ProjectContentProfile): number {
  const hasVoiceRole = template.audioLayout.tracks.some((t) => t.role === 'voice');
  const dialogueScore = profile.hasDialogue
    ? (hasVoiceRole ? 1 : 0.3) : (hasVoiceRole ? 0.7 : 1);

  const templateHasEffects = template.tracks.some((t) =>
    t.clips.some((c) => c.effects.length > 0),
  );
  const motionScore = profile.avgMotion > 0.5 ? (templateHasEffects ? 1 : 0.4) : 0.8;

  const placeholderTypes = new Set(
    template.tracks.flatMap((t) => t.clips.map((c) => c.placeholder)),
  );
  const expected = TYPE_PLACEHOLDER_MAP[profile.dominantClipType] ?? [];
  const typeScore = expected.length === 0 ? 0.7
    : expected.some((p) => placeholderTypes.has(p)) ? 1 : 0.4;

  const musicScore = profile.musicGenre
    ? (template.metadata.tags.includes(profile.musicGenre) ? 1 : 0.6) : 0.7;

  return cosineSimilarity([dialogueScore, motionScore, typeScore, musicScore], [1, 1, 1, 1]);
}

// ─── Reason Builder ───────────────────────────────────────────────

function buildReasons(
  template: EditingTemplate,
  profile: ProjectContentProfile,
  preferences: UserPreference,
  scores: { contentMatch: number; preferenceMatch: number; materialFit: number },
): string[] {
  const reasons: string[] = [];

  if (scores.contentMatch > 0.7) {
    reasons.push(`Duration closely matches project (${Math.round(template.metadata.estimatedDurationSec)}s vs ${Math.round(profile.duration)}s)`);
  }
  if ((MOOD_CATEGORIES[profile.mood] ?? []).includes(template.metadata.category)) {
    reasons.push(`Template style fits project ${profile.mood} mood`);
  }
  if (preferences.favoriteCategories.includes(template.metadata.category)) {
    reasons.push(`Matches your preferred category: ${template.metadata.category}`);
  }
  if (inferTemplatePace(template) === preferences.preferredPace) {
    reasons.push(`Pace matches your preference: ${preferences.preferredPace}`);
  }
  if (profile.hasDialogue && template.audioLayout.tracks.some((t) => t.role === 'voice')) {
    reasons.push('Template includes voice track layout for your dialogue content');
  }
  if (profile.avgMotion > 0.5 && template.tracks.some((t) => t.clips.some((c) => c.effects.length > 0))) {
    reasons.push('Template supports effects that suit your dynamic footage');
  }

  return reasons.length > 0 ? reasons : ['General purpose template with balanced characteristics'];
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

function cosineSimilarity(a: ReadonlyArray<number>, b: ReadonlyArray<number>): number {
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

function inferTemplatePace(template: EditingTemplate): UserPreference['preferredPace'] {
  const totalClips = template.tracks.reduce((s, t) => s + t.clips.length, 0);
  const cutsPerMin = template.metadata.estimatedDurationSec > 0
    ? (totalClips / template.metadata.estimatedDurationSec) * 60 : 0;
  if (cutsPerMin > 12) return 'fast';
  if (cutsPerMin < 5) return 'slow';
  return 'medium';
}

function detectMusicGenre(timeline: Timeline): string | null {
  const musicTracks = timeline.tracks.filter((t) =>
    t.type === 'audio' && /music|bgm|soundtrack/i.test(t.name),
  );
  if (musicTracks.length === 0) return null;
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
