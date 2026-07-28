import type { AIVisionAnalysisResult } from './types';

export function calculateExtractFrameTimes(duration: number, maxFrames = 5): number[] {
  if (duration <= 0 || maxFrames <= 0) {
    return [];
  }
  const frameCount = Math.min(maxFrames, Math.max(1, Math.floor(duration / 6)));
  const interval = duration / (frameCount + 1);
  const times: number[] = [];
  for (let i = 1; i <= frameCount; i++) {
    times.push(Math.round(interval * i * 100) / 100);
  }
  return times;
}

export function parseVisionAnalysisResponse(json: unknown): AIVisionAnalysisResult {
  if (!json || typeof json !== 'object') {
    return { tags: [], scene: '', mood: '', objects: [] };
  }
  const input = json as Record<string, unknown>;
  const tags = Array.isArray(input.tags)
    ? (input.tags as unknown[])
        .filter((t): t is string => typeof t === 'string')
        .map((t) => t.trim())
        .filter(Boolean)
    : [];
  const scene = typeof input.scene === 'string' ? input.scene.trim() : '';
  const mood = typeof input.mood === 'string' ? input.mood.trim() : '';
  const objects = Array.isArray(input.objects)
    ? (input.objects as unknown[])
        .filter((o): o is string => typeof o === 'string')
        .map((o) => o.trim())
        .filter(Boolean)
    : [];
  return { tags, scene, mood, objects };
}

export function mergeAITags(existing: string[], newTags: string[]): string[] {
  const seen = new Set(existing.map((t) => t.toLowerCase()));
  const merged = [...existing];
  for (const tag of newTags) {
    const lower = tag.toLowerCase();
    if (!seen.has(lower)) {
      seen.add(lower);
      merged.push(tag);
    }
  }
  return merged;
}

export function estimateVisionCost(frameCount: number, model: string): { tokens: number; costCny: number } {
  const baseTokensPerFrame = 800;
  const totalTokens = frameCount * baseTokensPerFrame + 500;
  let costPer1k = 0.01;
  const lower = model.toLowerCase();
  if (lower.includes('gpt-4o')) {
    costPer1k = 0.02;
  } else if (lower.includes('gemini')) {
    costPer1k = 0.005;
  } else if (lower.includes('qwen-vl')) {
    costPer1k = 0.008;
  }
  const estimatedCostCny = Math.round((totalTokens / 1000) * costPer1k * 100) / 100;
  return { tokens: totalTokens, costCny: estimatedCostCny };
}
