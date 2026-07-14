export type MusicTempo = 'fast' | 'medium' | 'slow';

export interface MusicMatchResult {
  mood: string;
  tempo: MusicTempo;
  genres: string[];
  keywords: string[];
  searchSuggestions: string[];
}

export interface MusicMatchMediaInfo {
  mediaId: string;
  filename: string;
  type: string;
  duration: number;
  mood?: string;
}

export function buildMusicMatchSystemPrompt(): string {
  return [
    '你是一个专业的音乐推荐助手。用户会给你视频的整体内容、情绪和风格信息。',
    '请分析视频内容，返回一个严格JSON对象，格式如下:',
    '{',
    '  "mood": "整体氛围描述",',
    '  "tempo": "fast|medium|slow",',
    '  "genres": ["推荐音乐风格1", "推荐音乐风格2"],',
    '  "keywords": ["搜索关键词1", "搜索关键词2"],',
    '  "searchSuggestions": ["建议在免版权音乐平台搜索的完整关键词1", "关键词2"]',
    '}',
    '只返回JSON对象，不要其他内容。',
  ].join('\n');
}

export function buildMusicMatchUserPrompt(description: string, mediaInfo: MusicMatchMediaInfo[]): string {
  const lines = [`视频描述: ${description}`];
  lines.push('');
  lines.push('视频素材信息:');
  for (const m of mediaInfo) {
    const parts = [`文件: ${m.filename}`, `类型: ${m.type}`, `时长: ${m.duration}秒`];
    if (m.mood) parts.push(`氛围: ${m.mood}`);
    lines.push(parts.join(' | '));
  }
  return lines.join('\n');
}

export function parseMusicMatchResponse(json: unknown): MusicMatchResult | null {
  if (!json || typeof json !== 'object') return null;
  const input = json as Record<string, unknown>;
  const mood = typeof input.mood === 'string' ? input.mood.trim() : '';
  if (!mood) return null;
  const validTempos = new Set<string>(['fast', 'medium', 'slow']);
  const tempoRaw = typeof input.tempo === 'string' ? input.tempo.trim().toLowerCase() : 'medium';
  const tempo: MusicTempo = validTempos.has(tempoRaw) ? (tempoRaw as MusicTempo) : 'medium';
  const genres = Array.isArray(input.genres)
    ? (input.genres as unknown[])
        .filter((g): g is string => typeof g === 'string')
        .map((g) => g.trim())
        .filter(Boolean)
    : [];
  const keywords = Array.isArray(input.keywords)
    ? (input.keywords as unknown[])
        .filter((k): k is string => typeof k === 'string')
        .map((k) => k.trim())
        .filter(Boolean)
    : [];
  const searchSuggestions = Array.isArray(input.searchSuggestions)
    ? (input.searchSuggestions as unknown[])
        .filter((s): s is string => typeof s === 'string')
        .map((s) => s.trim())
        .filter(Boolean)
    : [];
  return { mood, tempo, genres, keywords, searchSuggestions };
}

export function scoreMediaAudioSimilarity(targetMood: string, audioMood: string): number {
  if (!targetMood || !audioMood) return 0;
  const targetWords = new Set(
    targetMood
      .toLowerCase()
      .split(/[\s,，、;；]+/)
      .filter(Boolean),
  );
  const audioWords = audioMood
    .toLowerCase()
    .split(/[\s,，、;；]+/)
    .filter(Boolean);
  if (targetWords.size === 0 || audioWords.length === 0) return 0;
  let matches = 0;
  for (const word of audioWords) {
    if (targetWords.has(word)) matches++;
  }
  return matches / Math.max(targetWords.size, audioWords.length);
}

export function calculateAudioLoopOrTrimToDuration(
  audioDuration: number,
  targetDuration: number,
): { loops: number; trimEnd: number } {
  if (audioDuration <= 0 || targetDuration <= 0) {
    return { loops: 0, trimEnd: 0 };
  }
  const loops = Math.ceil(targetDuration / audioDuration);
  const totalLooped = loops * audioDuration;
  const trimEnd = totalLooped - targetDuration;
  return { loops, trimEnd: Math.round(trimEnd * 100) / 100 };
}

export interface AudioRecommendation {
  mediaId: string;
  filename: string;
  mood?: string;
  similarity: number;
}

export function rankAudioByMoodSimilarity(
  targetMood: string,
  audioAssets: Array<{ id: string; name: string; aiAnalysis?: { mood?: string } }>,
): AudioRecommendation[] {
  return audioAssets
    .map((a) => ({
      mediaId: a.id,
      filename: a.name,
      mood: a.aiAnalysis?.mood,
      similarity: a.aiAnalysis?.mood ? scoreMediaAudioSimilarity(targetMood, a.aiAnalysis.mood) : 0,
    }))
    .sort((a, b) => b.similarity - a.similarity);
}
