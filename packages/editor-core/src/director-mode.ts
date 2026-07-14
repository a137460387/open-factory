export type DirectorModeStyle = 'energetic' | 'calm' | 'documentary' | 'social-short';

export interface DirectorModeSegment {
  mediaId: string;
  trimStart: number;
  duration: number;
  trackIndex: number;
  order: number;
  reason: string;
}

export interface DirectorModeMarker {
  time: number;
  label: string;
}

export interface DirectorModePlan {
  segments: DirectorModeSegment[];
  markers: DirectorModeMarker[];
  musicTrackPlaceholder: boolean;
}

export interface DirectorModeMediaInfo {
  mediaId: string;
  filename: string;
  type: string;
  duration: number;
  tags?: string[];
  scene?: string;
  mood?: string;
}

const DIRECTOR_MODE_MAX_BATCH = 50;

/**
 * Pack media for director-mode AI calls.
 * When media has aiAnalysis, tags/scene/mood are included; otherwise filename is the only hint.
 */
export function buildDirectorModeMediaInfo(
  media: Array<{
    id: string;
    name: string;
    type: string;
    duration: number;
    aiAnalysis?: { tags?: string[]; scene?: string; mood?: string };
  }>,
): DirectorModeMediaInfo[] {
  return media.map((m) => ({
    mediaId: m.id,
    filename: m.name,
    type: m.type,
    duration: m.duration,
    tags: m.aiAnalysis?.tags,
    scene: m.aiAnalysis?.scene,
    mood: m.aiAnalysis?.mood,
  }));
}

/**
 * Split media info into batches of at most `maxBatch` items.
 * Used to avoid exceeding model context limits when media count > 100.
 */
export function splitDirectorModeMediaBatches(
  mediaInfo: DirectorModeMediaInfo[],
  maxBatch = DIRECTOR_MODE_MAX_BATCH,
): DirectorModeMediaInfo[][] {
  if (mediaInfo.length === 0) return [];
  const batches: DirectorModeMediaInfo[][] = [];
  for (let i = 0; i < mediaInfo.length; i += maxBatch) {
    batches.push(mediaInfo.slice(i, i + maxBatch));
  }
  return batches;
}

export function buildDirectorModeSystemPrompt(
  style: DirectorModeStyle,
  addMarkers: boolean,
  addMusicPlaceholder: boolean,
): string {
  const styleMap: Record<DirectorModeStyle, string> = {
    energetic: '节奏明快',
    calm: '舒缓叙事',
    documentary: '纪录片',
    'social-short': '社媒短视频',
  };
  const lines = [
    '你是一个专业的视频导演助手。用户会给你一段视频目标描述、目标时长、风格偏好，以及媒体库中可用素材的信息。',
    `风格偏好: ${styleMap[style]}`,
    '请根据描述和素材信息，返回一个导演规划的严格JSON对象。格式如下:',
    '{',
    '  "segments": [{',
    '    "mediaId": "素材ID",',
    '    "trimStart": 0,',
    '    "duration": 5,',
    '    "trackIndex": 0,',
    '    "order": 0,',
    '    "reason": "选择理由"',
    '  }],',
  ];
  if (addMarkers) {
    lines.push('  "markers": [{ "time": 0, "label": "章节标题" }],');
  } else {
    lines.push('  "markers": [],');
  }
  lines.push(`  "musicTrackPlaceholder": ${addMusicPlaceholder}`);
  lines.push('}');
  lines.push('');
  lines.push('segments中所有片段的duration之和必须 ≤ 目标时长。');
  lines.push('每个segment的mediaId必须来自提供的素材列表。');
  lines.push('order从0开始递增，表示播放顺序。');
  lines.push('请优先使用有aiAnalysis标签的素材以获得更精准的匹配；如果没有aiAnalysis，根据文件名推断。');
  lines.push('只返回JSON对象，不要其他内容。');
  return lines.join('\n');
}

export function buildDirectorModeUserPrompt(
  description: string,
  targetDuration: number,
  mediaInfo: DirectorModeMediaInfo[],
): string {
  const lines = [`视频目标描述: ${description}`];
  lines.push(`目标时长: ${targetDuration}秒`);
  lines.push('');
  lines.push('可用素材:');
  for (const m of mediaInfo) {
    const parts = [`ID: ${m.mediaId}`, `文件: ${m.filename}`, `类型: ${m.type}`, `时长: ${m.duration}秒`];
    if (m.tags && m.tags.length > 0) parts.push(`标签: ${m.tags.join(',')}`);
    if (m.scene) parts.push(`场景: ${m.scene}`);
    if (m.mood) parts.push(`氛围: ${m.mood}`);
    lines.push(parts.join(' | '));
  }
  return lines.join('\n');
}

export function parseDirectorModeResponse(json: unknown): DirectorModePlan {
  const empty: DirectorModePlan = { segments: [], markers: [], musicTrackPlaceholder: false };
  if (!json || typeof json !== 'object') return empty;
  const input = json as Record<string, unknown>;

  const segments: DirectorModeSegment[] = [];
  if (Array.isArray(input.segments)) {
    for (const item of input.segments) {
      if (!item || typeof item !== 'object') continue;
      const entry = item as Record<string, unknown>;
      if (typeof entry.mediaId !== 'string' || typeof entry.duration !== 'number') continue;
      const mediaId = (entry.mediaId as string).trim();
      if (!mediaId) continue;
      segments.push({
        mediaId,
        trimStart:
          typeof entry.trimStart === 'number' && Number.isFinite(entry.trimStart) ? Math.max(0, entry.trimStart) : 0,
        duration: Math.max(0.1, Number.isFinite(entry.duration) ? entry.duration : 3),
        trackIndex:
          typeof entry.trackIndex === 'number' && Number.isFinite(entry.trackIndex)
            ? Math.max(0, Math.round(entry.trackIndex))
            : 0,
        order:
          typeof entry.order === 'number' && Number.isFinite(entry.order) ? Math.max(0, Math.round(entry.order)) : 0,
        reason: typeof entry.reason === 'string' ? entry.reason.trim() : '',
      });
    }
  }

  const markers: DirectorModeMarker[] = [];
  if (Array.isArray(input.markers)) {
    for (const item of input.markers) {
      if (!item || typeof item !== 'object') continue;
      const entry = item as Record<string, unknown>;
      if (typeof entry.time !== 'number' || typeof entry.label !== 'string') continue;
      const label = (entry.label as string).trim();
      if (!label) continue;
      markers.push({
        time: Math.max(0, entry.time),
        label,
      });
    }
  }

  const musicTrackPlaceholder = input.musicTrackPlaceholder === true;

  return { segments, markers, musicTrackPlaceholder };
}

/**
 * Validate that the total duration of all segments does not exceed the target duration.
 * Returns true if valid (total ≤ target), false otherwise.
 */
export function validateDirectorModeTotalDuration(segments: DirectorModeSegment[], targetDuration: number): boolean {
  if (segments.length === 0) return true;
  const total = segments.reduce((sum, s) => sum + s.duration, 0);
  return total <= targetDuration + 0.01; // small epsilon for float comparison
}

export interface DirectorModeStoryboardCard {
  mediaId: string;
  mediaName: string;
  trimStart: number;
  duration: number;
  trackIndex: number;
  order: number;
  reason: string;
  deleted: boolean;
}

/**
 * Convert a DirectorModePlan into storyboard preview cards.
 * mediaById is used to resolve mediaId → display name.
 */
export function buildDirectorModeStoryboardCards(
  plan: DirectorModePlan,
  mediaById: Map<string, { name: string }>,
): DirectorModeStoryboardCard[] {
  return [...plan.segments]
    .sort((a, b) => a.order - b.order)
    .map((seg) => ({
      mediaId: seg.mediaId,
      mediaName: mediaById.get(seg.mediaId)?.name ?? seg.mediaId,
      trimStart: seg.trimStart,
      duration: seg.duration,
      trackIndex: seg.trackIndex,
      order: seg.order,
      reason: seg.reason,
      deleted: false,
    }));
}
