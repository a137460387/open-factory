export type AIProtocol = 'openai-compatible' | 'custom';

export interface AIProvider {
  id: string;
  name: string;
  protocol: AIProtocol;
  baseUrl: string;
  apiKey?: string;
  defaultModel: string;
  enabled: boolean;
  customHeaders?: Record<string, string>;
  isBuiltIn: boolean;
}

export interface AIUsageRecord {
  providerId: string;
  timestamp: number;
  inputTokens: number;
  outputTokens: number;
  estimatedCostCny: number;
  /** Which AI feature generated this record (optional for backward compat) */
  service?: string;
}

export interface AITestConnectionResult {
  ok: boolean;
  latencyMs?: number;
  error?: string;
}

export interface AISubtitlePolishItem {
  index: number;
  text: string;
}

export interface AIChapterResult {
  time: number;
  title: string;
}

export interface AIVisionAnalysisResult {
  tags: string[];
  scene: string;
  mood: string;
  objects: string[];
}

export interface MediaAIAnalysis {
  tags: string[];
  scene: string;
  mood: string;
  objects: string[];
  analysisTime: string;
  providerId: string;
}

export interface BuiltInProviderPreset {
  id: string;
  name: string;
  baseUrl: string;
  defaultModel: string;
  needsKey: boolean;
}

export interface AIColorGradingSuggestion {
  style: string;
  issues: string[];
  suggestions: AIColorGradingSuggestionItem[];
}

export interface AIColorGradingSuggestionItem {
  parameter: string;
  currentValue?: number;
  recommendedValue: number;
  reason: string;
}

export interface AIRoughCutClip {
  mediaId: string;
  startTime: number;
  duration: number;
  trackIndex: number;
  reason: string;
}

export interface AIRoughCutMediaInfo {
  mediaId: string;
  filename: string;
  type: string;
  duration: number;
  tags?: string[];
  scene?: string;
  mood?: string;
}

export type TTSEngine = 'elevenlabs' | 'openai' | 'compatible';

export interface TTSConfig {
  providerId: string;
  baseUrl: string;
  engine: TTSEngine;
  voiceId: string;
  speed: number;
  /** ElevenLabs stability parameter (0-1), ignored for other engines */
  stability?: number;
  model?: string;
}

export interface TTSTask {
  text: string;
  startTime: number;
  duration: number;
  clipId?: string;
}

export interface TTSResult {
  cachePath: string;
  text: string;
  startTime: number;
  duration: number;
}

export type AIExportSuggestionPriority = 'high' | 'medium' | 'low';

export interface AIExportSuggestion {
  parameter: string;
  currentValue: string;
  suggestedValue: string;
  reason: string;
  priority: AIExportSuggestionPriority;
}

export interface AIExportProjectInfo {
  durationSeconds: number;
  width: number;
  height: number;
  fps: number;
  trackCount: number;
  effectCount: number;
  hasSubtitle: boolean;
  hasHDR: boolean;
  clipCount: number;
}
