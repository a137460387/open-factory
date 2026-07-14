/**
 * AI sound-effect intelligent matching and recommendation.
 *
 * Detects action candidate points from motion magnitude spikes
 * (motion delta > 50%), maps AI response categories to local SFX library,
 * and provides timeline insertion support.
 */

export interface ActionCandidatePoint {
  time: number;
  previousMagnitude: number;
  currentMagnitude: number;
  deltaRatio: number;
}

export interface SfxLibraryEntry {
  id: string;
  category: string;
  filename: string;
  duration: number;
}

export interface SfxMatchSuggestion {
  time: number;
  category: string;
  confidence: number;
  matchedAssetId: string | null;
  status: 'pending' | 'accepted' | 'rejected';
}

export interface SfxAISuggestion {
  time: number;
  soundEffectCategory: string;
  reason: string;
  confidence: number;
}

export interface SfxAIResponse {
  suggestions: SfxAISuggestion[];
}

export interface SfxCandidateMoment {
  time: number;
  sceneTag?: string;
  nearbySubtitle?: string;
}

export const ACTION_DELTA_RATIO_THRESHOLD = 0.5;
export const MIN_SUGGESTION_CONFIDENCE = 0.3;

const CATEGORY_ALIASES: Record<string, string> = {
  footstep: 'footstep',
  footsteps: 'footstep',
  door: 'door',
  door_open: 'door',
  door_close: 'door',
  collision: 'collision',
  impact: 'collision',
  page_turn: 'page_turn',
  pageturn: 'page_turn',
  whoosh: 'whoosh',
  swoosh: 'whoosh',
  click: 'click',
  tap: 'click',
  splash: 'splash',
  water: 'splash',
  glass: 'glass_break',
  glass_break: 'glass_break',
  thud: 'collision',
  slam: 'door',
};

export function detectActionCandidatePoints(motionMagnitudes: number[]): ActionCandidatePoint[] {
  if (motionMagnitudes.length < 2) return [];
  const candidates: ActionCandidatePoint[] = [];
  for (let i = 1; i < motionMagnitudes.length; i += 1) {
    const prev = motionMagnitudes[i - 1];
    const curr = motionMagnitudes[i];
    if (prev <= 0) {
      if (curr > 0) {
        candidates.push({ time: i, previousMagnitude: prev, currentMagnitude: curr, deltaRatio: Infinity });
      }
      continue;
    }
    const deltaRatio = (curr - prev) / prev;
    if (deltaRatio > ACTION_DELTA_RATIO_THRESHOLD) {
      candidates.push({ time: i, previousMagnitude: prev, currentMagnitude: curr, deltaRatio });
    }
  }
  return candidates;
}

export function buildSfxMatchPrompt(moments: SfxCandidateMoment[]): string {
  const lines: string[] = [
    '你是一个专业的音效推荐助手。以下是一段视频中检测到的动作候选时刻。',
    '请为每个时刻推荐一个音效类别(soundEffectCategory)，并给出理由和置信度。',
    '',
    '返回严格JSON格式:',
    '{',
    '  "suggestions": [',
    '    { "time": 秒数, "soundEffectCategory": "类别", "reason": "理由", "confidence": 0-1 }',
    '  ]',
    '}',
    '',
    '候选时刻:',
  ];
  for (const m of moments) {
    let line = `  - 时间: ${m.time}s`;
    if (m.sceneTag) line += `, 场景: ${m.sceneTag}`;
    if (m.nearbySubtitle) line += `, 字幕: '${m.nearbySubtitle}'`;
    lines.push(line);
  }
  return lines.join('\n');
}

export function parseSfxMatchResponse(json: string): SfxAISuggestion[] {
  try {
    const parsed = JSON.parse(json) as SfxAIResponse;
    if (!Array.isArray(parsed.suggestions)) return [];
    return parsed.suggestions
      .filter((s) => s.confidence >= MIN_SUGGESTION_CONFIDENCE)
      .map((s) => ({
        time: s.time,
        soundEffectCategory: normalizeCategory(s.soundEffectCategory),
        reason: s.reason ?? '',
        confidence: s.confidence,
      }));
  } catch {
    return [];
  }
}

export function normalizeCategory(raw: string): string {
  const lower = raw
    .toLowerCase()
    .trim()
    .replace(/[\s-]+/g, '_');
  return CATEGORY_ALIASES[lower] ?? lower;
}

export function matchLocalSfxLibrary(category: string, library: SfxLibraryEntry[]): SfxLibraryEntry | null {
  const normalized = normalizeCategory(category);
  return library.find((entry) => normalizeCategory(entry.category) === normalized) ?? null;
}

export function buildSfxSuggestions(
  aiSuggestions: SfxAISuggestion[],
  library: SfxLibraryEntry[],
): SfxMatchSuggestion[] {
  return aiSuggestions.map((s) => {
    const match = matchLocalSfxLibrary(s.soundEffectCategory, library);
    return {
      time: s.time,
      category: s.soundEffectCategory,
      confidence: s.confidence,
      matchedAssetId: match?.id ?? null,
      status: 'pending' as const,
    };
  });
}
