/**
 * LLM Suggestion Engine
 *
 * Extends the LLM orchestrator with a "suggestion mode" that proactively
 * generates multiple creative editing proposals based on:
 * - Current material semantic analysis
 * - User's style fingerprint library
 * - Platform/audience context
 *
 * Distinct from "editing mode": suggestions are non-binding proposals
 * for the user to browse, compare, and selectively apply.
 */

import type { MaterialMetadata } from './semantic-extractor';
import type { StyleFingerprint } from './style-analyzer';
import type { LLMMessage, LLMResponse } from './llm-orchestrator';
import { buildEditingPrompt } from './llm-orchestrator';

// ─── Suggestion Types ───────────────────────────────────────────

/** Suggestion category */
export type SuggestionCategory =
  | 'creative'      // Creative editing proposals
  | 'style-match'   // Style-conformant proposals
  | 'platform'      // Platform-optimized proposals
  | 'efficiency'    // Time-saving shortcuts
  | 'experimentation'; // Experimental/unconventional ideas

/** A single editing suggestion */
export interface EditingSuggestion {
  id: string;
  /** Suggestion category */
  category: SuggestionCategory;
  /** Short title */
  title: string;
  /** Detailed description */
  description: string;
  /** Confidence score 0-1 */
  confidence: number;
  /** Creative rationale */
  rationale: string;
  /** Preview instructions (lightweight edit plan for preview) */
  previewInstructions: SuggestionInstruction[];
  /** Tags for filtering */
  tags: string[];
  /** Which style fingerprint was used (if any) */
  styleId?: string;
  /** User feedback score (set after review) */
  feedbackScore?: number;
  /** User feedback notes */
  feedbackNotes?: string;
}

/** A single instruction within a suggestion */
export interface SuggestionInstruction {
  action: string;
  target: {
    materialIndex?: number;
    startSec?: number;
    endSec?: number;
    trackIndex?: number;
  };
  params: Record<string, unknown>;
  reason: string;
}

/** Request for generating suggestions */
export interface SuggestionRequest {
  /** Material metadata to analyze */
  materials: MaterialMetadata[];
  /** User's style fingerprints to consider */
  styles: StyleFingerprint[];
  /** Target platform (if any) */
  platform?: string;
  /** User's natural language guidance */
  userGuidance?: string;
  /** Max suggestions to generate */
  maxSuggestions?: number;
  /** Preferred categories */
  categories?: SuggestionCategory[];
}

/** Response containing suggestions */
export interface SuggestionResponse {
  suggestions: EditingSuggestion[];
  /** Overall analysis notes from LLM */
  analysisNotes: string;
  /** Token usage */
  usage: { inputTokens: number; outputTokens: number };
  /** Latency in ms */
  latencyMs: number;
}

/** Suggestion comparison view */
export interface SuggestionComparison {
  suggestions: EditingSuggestion[];
  /** Comparison matrix: which suggestion is better for which dimension */
  dimensions: Array<{
    name: string;
    description: string;
    scores: Record<string, number>; // suggestionId → score
  }>;
}

// ─── Prompt Construction ────────────────────────────────────────

const SYSTEM_PROMPT_SUGGESTION = `You are a creative video editing advisor. You analyze media metadata and propose MULTIPLE distinct editing approaches.

IMPORTANT RULES:
1. You receive structured metadata (JSON) only - no raw media.
2. Generate 3-5 DISTINCT suggestions, each with a different creative angle.
3. Each suggestion must be a valid JSON object matching the schema below.
4. Suggestions should vary in style: one conservative, one creative, one experimental.
5. If a style fingerprint is provided, at least one suggestion should conform to that style.
6. Always explain your creative rationale for each suggestion.
7. Suggestions are PROPOSALS, not commands. The user will review and selectively apply.

Output JSON schema:
{
  "suggestions": [
    {
      "id": "string - unique id",
      "category": "creative|style-match|platform|efficiency|experimentation",
      "title": "string - short descriptive title",
      "description": "string - detailed description of the editing approach",
      "confidence": "number 0-1",
      "rationale": "string - why this approach works for the content",
      "previewInstructions": [
        {
          "action": "string - edit action type",
          "target": { "materialIndex": "number (optional)", "startSec": "number (optional)", "endSec": "number (optional)" },
          "params": {},
          "reason": "string"
        }
      ],
      "tags": ["string"]
    }
  ],
  "analysisNotes": "string - overall content analysis"
}`;

function buildSuggestionPrompt(request: SuggestionRequest): LLMMessage[] {
  const systemMessage: LLMMessage = {
    role: 'system',
    content: SYSTEM_PROMPT_SUGGESTION,
  };

  // Compact material summary
  const materialSummaries = request.materials.map((m, i) => ({
    index: i,
    fileName: m.source.fileName,
    duration: m.source.durationSec,
    resolution: `${m.source.width}x${m.source.height}`,
    fps: m.source.fps,
    tags: m.tags,
    transcript: m.transcriptText.substring(0, 1500),
    keyFrameCount: m.keyFrames.length,
    audioProfile: m.audioProfile,
    visualProfile: m.visualProfile,
    summary: m.summary,
  }));

  // Compact style summary
  const styleSummaries = request.styles.map((s) => ({
    id: s.id,
    name: s.name,
    rhythm: {
      avgClipDurationSec: s.rhythm.avgClipDurationSec,
      cutsPerMinute: s.rhythm.cutsPerMinute,
      regularity: s.rhythm.regularity,
    },
    colorGrading: {
      temperatureTendency: s.colorGrading.temperatureTendency,
      saturationMean: s.colorGrading.saturation.mean,
      contrastMean: s.colorGrading.contrast.mean,
    },
    topTransitions: s.transitions.slice(0, 3).map((t) => ({
      type: t.type,
      ratio: t.ratio,
    })),
    tags: s.tags,
  }));

  const parts: string[] = [
    `## Materials\n\n${JSON.stringify(materialSummaries, null, 2)}`,
  ];

  if (styleSummaries.length > 0) {
    parts.push(`## User Style Profiles\n\n${JSON.stringify(styleSummaries, null, 2)}`);
  }

  if (request.platform) {
    parts.push(`## Target Platform: ${request.platform}`);
  }

  if (request.categories && request.categories.length > 0) {
    parts.push(`## Preferred Categories: ${request.categories.join(', ')}`);
  }

  const maxSuggestions = request.maxSuggestions ?? 4;
  parts.push(`## Generate ${maxSuggestions} distinct editing suggestions in JSON format.`);

  if (request.userGuidance) {
    parts.push(`## User Guidance\n\n${request.userGuidance}`);
  }

  const userMessage: LLMMessage = {
    role: 'user',
    content: parts.join('\n\n'),
  };

  return [systemMessage, userMessage];
}

// ─── Response Parsing ───────────────────────────────────────────

function generateSuggestionId(): string {
  return `sug-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

const VALID_CATEGORIES: SuggestionCategory[] = [
  'creative', 'style-match', 'platform', 'efficiency', 'experimentation',
];

/**
 * Parse suggestion response from LLM JSON output.
 */
export function parseSuggestionResponse(jsonStr: string): SuggestionResponse | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    return null;
  }

  if (!parsed || typeof parsed !== 'object') return null;
  const obj = parsed as Record<string, unknown>;

  if (!Array.isArray(obj.suggestions)) return null;

  const suggestions: EditingSuggestion[] = [];
  for (const raw of obj.suggestions) {
    if (!raw || typeof raw !== 'object') continue;
    const s = raw as Record<string, unknown>;

    const category = typeof s.category === 'string' && VALID_CATEGORIES.includes(s.category as SuggestionCategory)
      ? s.category as SuggestionCategory
      : 'creative';

    const previewInstructions: SuggestionInstruction[] = Array.isArray(s.previewInstructions)
      ? (s.previewInstructions as unknown[])
          .filter((i): i is Record<string, unknown> => i != null && typeof i === 'object')
          .map((i) => ({
            action: typeof i.action === 'string' ? i.action : 'unknown',
            target: typeof i.target === 'object' && i.target !== null
              ? i.target as SuggestionInstruction['target']
              : {},
            params: typeof i.params === 'object' && i.params !== null
              ? i.params as Record<string, unknown>
              : {},
            reason: typeof i.reason === 'string' ? i.reason : '',
          }))
      : [];

    suggestions.push({
      id: typeof s.id === 'string' ? s.id : generateSuggestionId(),
      category,
      title: typeof s.title === 'string' ? s.title : 'Untitled Suggestion',
      description: typeof s.description === 'string' ? s.description : '',
      confidence: typeof s.confidence === 'number' ? Math.max(0, Math.min(1, s.confidence)) : 0.5,
      rationale: typeof s.rationale === 'string' ? s.rationale : '',
      previewInstructions,
      tags: Array.isArray(s.tags) ? s.tags.filter((t: unknown): t is string => typeof t === 'string') : [],
    });
  }

  return {
    suggestions,
    analysisNotes: typeof obj.analysisNotes === 'string' ? obj.analysisNotes : '',
    usage: { inputTokens: 0, outputTokens: 0 },
    latencyMs: 0,
  };
}

// ─── Suggestion Generation ──────────────────────────────────────

/**
 * Build suggestion prompt messages for LLM.
 * Use this with your existing LLM client, then parse with parseSuggestionResponse().
 */
export function buildSuggestionMessages(request: SuggestionRequest): LLMMessage[] {
  return buildSuggestionPrompt(request);
}

/**
 * Apply a style fingerprint to suggestion instructions.
 * Enriches instructions with style-specific parameters.
 */
export function enrichSuggestionWithStyle(
  suggestion: EditingSuggestion,
  style: StyleFingerprint,
  strength: number = 0.7,
): EditingSuggestion {
  const clampedStrength = Math.max(0, Math.min(1, strength));

  const enrichedInstructions = suggestion.previewInstructions.map((inst) => {
    const params = { ...inst.params };

    if (inst.action === 'add_transition' && style.transitions.length > 0) {
      const top = style.transitions[0];
      if (!params.type) params.type = top.type;
      if (params.duration === undefined) {
        params.duration = top.avgDurationSec * clampedStrength;
      }
    }

    if (inst.action === 'adjust_audio') {
      if (params.fadeIn === undefined && style.audioProcessing.avgFadeInSec > 0) {
        params.fadeIn = style.audioProcessing.avgFadeInSec * clampedStrength;
      }
      if (params.fadeOut === undefined && style.audioProcessing.avgFadeOutSec > 0) {
        params.fadeOut = style.audioProcessing.avgFadeOutSec * clampedStrength;
      }
    }

    return { ...inst, params };
  });

  return {
    ...suggestion,
    previewInstructions: enrichedInstructions,
    styleId: style.id,
    tags: [...new Set([...suggestion.tags, ...style.tags])],
  };
}

/**
 * Generate a comparison matrix for a set of suggestions.
 */
export function generateComparison(
  suggestions: EditingSuggestion[],
): SuggestionComparison {
  const dimensions = [
    {
      name: 'creativity',
      description: 'How creative and unconventional the approach is',
      scores: Object.fromEntries(suggestions.map((s) => [
        s.id,
        s.category === 'experimentation' ? 0.9 :
        s.category === 'creative' ? 0.7 :
        s.category === 'style-match' ? 0.5 :
        s.category === 'platform' ? 0.4 : 0.3,
      ])),
    },
    {
      name: 'confidence',
      description: 'How confident the AI is in this suggestion',
      scores: Object.fromEntries(suggestions.map((s) => [s.id, s.confidence])),
    },
    {
      name: 'complexity',
      description: 'How many edits are involved',
      scores: Object.fromEntries(suggestions.map((s) => [
        s.id,
        Math.min(1, s.previewInstructions.length / 10),
      ])),
    },
  ];

  return { suggestions, dimensions };
}

/**
 * Record user feedback on a suggestion.
 */
export function recordFeedback(
  suggestion: EditingSuggestion,
  score: number,
  notes?: string,
): EditingSuggestion {
  return {
    ...suggestion,
    feedbackScore: Math.max(-1, Math.min(1, score)),
    feedbackNotes: notes,
  };
}

/**
 * Filter suggestions by category, confidence threshold, or tags.
 */
export function filterSuggestions(
  suggestions: EditingSuggestion[],
  filters: {
    categories?: SuggestionCategory[];
    minConfidence?: number;
    tags?: string[];
  },
): EditingSuggestion[] {
  return suggestions.filter((s) => {
    if (filters.categories && filters.categories.length > 0) {
      if (!filters.categories.includes(s.category)) return false;
    }
    if (filters.minConfidence !== undefined) {
      if (s.confidence < filters.minConfidence) return false;
    }
    if (filters.tags && filters.tags.length > 0) {
      if (!filters.tags.some((t) => s.tags.includes(t))) return false;
    }
    return true;
  });
}

/**
 * Rank suggestions by weighted score combining confidence, category preference, and feedback.
 */
export function rankSuggestions(
  suggestions: EditingSuggestion[],
  weights: {
    confidence?: number;
    categoryPreference?: Partial<Record<SuggestionCategory, number>>;
    feedbackWeight?: number;
  } = {},
): EditingSuggestion[] {
  const w = {
    confidence: weights.confidence ?? 0.4,
    feedbackWeight: weights.feedbackWeight ?? 0.3,
  };
  const catPref = weights.categoryPreference ?? {};

  const scored = suggestions.map((s) => {
    const catScore = catPref[s.category] ?? 0.5;
    const feedbackScore = s.feedbackScore !== undefined ? (s.feedbackScore + 1) / 2 : 0.5;
    const totalScore = w.confidence * s.confidence + 0.3 * catScore + w.feedbackWeight * feedbackScore;
    return { suggestion: s, score: totalScore };
  });

  return scored.sort((a, b) => b.score - a.score).map((s) => s.suggestion);
}
