export interface HighlightScoreWeights {
  visual: number;
  loudness: number;
  aiContent: number;
}

export interface HighlightScoreInput {
  clipId: string;
  visualScore: number;
  loudnessScore: number;
  aiScore: number;
}

export interface HighlightScore {
  clipId: string;
  visualScore: number;
  loudnessScore: number;
  aiScore: number;
  totalScore: number;
}

export const DEFAULT_HIGHLIGHT_WEIGHTS: HighlightScoreWeights = {
  visual: 0.4,
  loudness: 0.3,
  aiContent: 0.3,
};

/**
 * Score a single clip for highlight potential using weighted 3D scoring.
 */
export function scoreHighlightClip(
  input: HighlightScoreInput,
  weights: HighlightScoreWeights = DEFAULT_HIGHLIGHT_WEIGHTS,
): HighlightScore {
  const totalScore =
    Math.max(0, Math.min(1, input.visualScore)) * weights.visual +
    Math.max(0, Math.min(1, input.loudnessScore)) * weights.loudness +
    Math.max(0, Math.min(1, input.aiScore)) * weights.aiContent;
  return {
    clipId: input.clipId,
    visualScore: input.visualScore,
    loudnessScore: input.loudnessScore,
    aiScore: input.aiScore,
    totalScore: Math.round(totalScore * 1000) / 1000,
  };
}

/**
 * Score all clips and return sorted by totalScore descending.
 */
export function scoreAllHighlightClips(
  inputs: HighlightScoreInput[],
  weights: HighlightScoreWeights = DEFAULT_HIGHLIGHT_WEIGHTS,
): HighlightScore[] {
  return inputs.map((input) => scoreHighlightClip(input, weights)).sort((a, b) => b.totalScore - a.totalScore);
}

export interface HighlightSelection {
  selected: HighlightScore[];
  totalDuration: number;
}

/**
 * Extract top highlight clips to fit within target duration ± tolerance.
 * Selects clips in score order until the target duration is reached.
 * clipDurations maps clipId → duration in seconds.
 */
export function extractTopHighlightClips(
  scores: HighlightScore[],
  clipDurations: Map<string, number>,
  targetDuration: number,
  tolerance = 0.1,
): HighlightSelection {
  const selected: HighlightScore[] = [];
  let totalDuration = 0;
  const maxDuration = targetDuration * (1 + tolerance);

  for (const score of scores) {
    const duration = clipDurations.get(score.clipId) ?? 0;
    if (duration <= 0) continue;
    if (totalDuration + duration > maxDuration && selected.length > 0) break;
    selected.push(score);
    totalDuration += duration;
  }

  return {
    selected,
    totalDuration: Math.round(totalDuration * 100) / 100,
  };
}

/**
 * Extract mood keywords from aiAnalysis for AI-based content scoring.
 * Returns a score 0-1 based on how many "exciting" keywords are present.
 */
export function scoreAIMoodKeywords(mood: string): number {
  if (!mood) return 0;
  const exciting = ['exciting', 'dynamic', 'energetic', '活力', '动感', '激情', '激烈', '快节奏', '热血'];
  const lower = mood.toLowerCase();
  let matches = 0;
  for (const kw of exciting) {
    if (lower.includes(kw)) matches++;
  }
  return Math.min(1, matches / 3);
}

export function buildHighlightReelSystemPrompt(): string {
  return [
    '你是一个专业的视频集锦编辑助手。用户会给你一组候选片段的评分和信息。',
    '请从这些片段中选出最精彩的组合，返回一个严格JSON对象:',
    '{',
    '  "selectedIds": ["clipId1", "clipId2", ...],',
    '  "transitionNotes": ["片段1→片段2过渡说明", "片段2→片段3过渡说明"]',
    '}',
    'selectedIds必须来自提供的候选列表。只返回JSON对象，不要其他内容。',
  ].join('\n');
}

export function buildHighlightReelUserPrompt(
  description: string,
  candidates: Array<{ clipId: string; duration: number; totalScore: number; mood?: string }>,
): string {
  const lines = [`集锦目标: ${description}`];
  lines.push('');
  lines.push('候选片段:');
  for (const c of candidates) {
    const parts = [`ID: ${c.clipId}`, `时长: ${c.duration}秒`, `评分: ${c.totalScore}`];
    if (c.mood) parts.push(`氛围: ${c.mood}`);
    lines.push(parts.join(' | '));
  }
  return lines.join('\n');
}

export function parseHighlightReelResponse(json: unknown): { selectedIds: string[]; transitionNotes: string[] } {
  if (!json || typeof json !== 'object') return { selectedIds: [], transitionNotes: [] };
  const input = json as Record<string, unknown>;
  const selectedIds = Array.isArray(input.selectedIds)
    ? (input.selectedIds as unknown[])
        .filter((id): id is string => typeof id === 'string')
        .map((id) => id.trim())
        .filter(Boolean)
    : [];
  const transitionNotes = Array.isArray(input.transitionNotes)
    ? (input.transitionNotes as unknown[])
        .filter((n): n is string => typeof n === 'string')
        .map((n) => n.trim())
        .filter(Boolean)
    : [];
  return { selectedIds, transitionNotes };
}
