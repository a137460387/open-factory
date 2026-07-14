/** AI版本对比摘要：快照diff算法 + AI摘要解析 */

/** 单个diff项 */
export interface SnapshotDiffItem {
  type: 'added' | 'removed' | 'modified' | 'track-count-changed';
  clipId?: string;
  trackId?: string;
  detail: string;
  /** 修剪点变化量（秒），仅modified类型有值 */
  delta?: number;
}

/** 版本diff结果 */
export interface VersionDiffResult {
  fromSnapshotId: string;
  toSnapshotId: string;
  items: SnapshotDiffItem[];
  summary: string;
  highlights: string[];
  generatedAt: string;
}

/** AI摘要响应 */
export interface VersionDiffAiResponse {
  summary: string;
  highlights: string[];
}

/** 版本对比摘要（用于数据结构） */
export interface VersionDiffSummary {
  fromSnapshotId: string;
  toSnapshotId: string;
  diff: SnapshotDiffItem[];
  aiSummary: string;
  generatedAt: string;
}

/** 简化剪辑信息（用于diff比较） */
interface ClipSnapshot {
  id: string;
  start: number;
  duration: number;
  trimStart: number;
  trimEnd: number;
  trackId: string;
  mediaId?: string;
}

/** 简化时间线快照 */
interface TimelineSnapshot {
  tracks: Array<{
    id: string;
    type: string;
    clips: ClipSnapshot[];
  }>;
}

/** 修剪点变化阈值（秒） */
export const TRIM_DELTA_THRESHOLD = 0.1;

/**
 * 对比两个时间线快照，生成结构化diff。
 */
export function diffVersionSnapshots(from: TimelineSnapshot, to: TimelineSnapshot): SnapshotDiffItem[] {
  const items: SnapshotDiffItem[] = [];

  // 轨道数量变化
  const fromTrackCount = from.tracks.length;
  const toTrackCount = to.tracks.length;
  if (fromTrackCount !== toTrackCount) {
    items.push({
      type: 'track-count-changed',
      detail: `轨道数量从 ${fromTrackCount} 变为 ${toTrackCount}`,
    });
  }

  // 收集所有clip id
  const fromClips = new Map<string, ClipSnapshot>();
  const toClips = new Map<string, ClipSnapshot>();

  for (const track of from.tracks) {
    for (const clip of track.clips) {
      fromClips.set(clip.id, clip);
    }
  }
  for (const track of to.tracks) {
    for (const clip of track.clips) {
      toClips.set(clip.id, clip);
    }
  }

  // 检测新增
  for (const [id, clip] of toClips) {
    if (!fromClips.has(id)) {
      items.push({
        type: 'added',
        clipId: id,
        detail: `新增剪辑 ${id}（时长${clip.duration.toFixed(1)}秒）`,
      });
    }
  }

  // 检测删除
  for (const [id] of fromClips) {
    if (!toClips.has(id)) {
      items.push({
        type: 'removed',
        clipId: id,
        detail: `删除剪辑 ${id}`,
      });
    }
  }

  // 检测修剪点变化
  for (const [id, fromClip] of fromClips) {
    const toClip = toClips.get(id);
    if (!toClip) continue;

    const trimStartDelta = Math.abs(fromClip.trimStart - toClip.trimStart);
    const trimEndDelta = Math.abs(fromClip.trimEnd - toClip.trimEnd);
    const startDelta = Math.abs(fromClip.start - toClip.start);

    if (trimStartDelta > TRIM_DELTA_THRESHOLD || trimEndDelta > TRIM_DELTA_THRESHOLD) {
      const maxDelta = Math.max(trimStartDelta, trimEndDelta);
      items.push({
        type: 'modified',
        clipId: id,
        detail: `剪辑 ${id} 修剪点变化（最大变化 ${maxDelta.toFixed(2)}秒）`,
        delta: maxDelta,
      });
    } else if (startDelta > TRIM_DELTA_THRESHOLD) {
      items.push({
        type: 'modified',
        clipId: id,
        detail: `剪辑 ${id} 位置变化（移动 ${startDelta.toFixed(2)}秒）`,
        delta: startDelta,
      });
    }
  }

  return items;
}

/**
 * 将diff结果序列化为AI提示词用的JSON字符串。
 */
export function serializeDiffForAi(items: SnapshotDiffItem[]): string {
  return JSON.stringify(
    items.map((item) => ({
      type: item.type,
      clipId: item.clipId,
      detail: item.detail,
      delta: item.delta,
    })),
  );
}

/**
 * 解析AI返回的版本对比摘要响应。
 */
export function parseVersionDiffAiResponse(json: unknown): VersionDiffAiResponse {
  const empty: VersionDiffAiResponse = { summary: '', highlights: [] };
  if (!json || typeof json !== 'object') return empty;
  const obj = json as Record<string, unknown>;
  const summary = typeof obj.summary === 'string' ? obj.summary.trim() : '';
  const highlights = Array.isArray(obj.highlights)
    ? obj.highlights.filter((h: unknown): h is string => typeof h === 'string')
    : [];
  return { summary, highlights };
}

/**
 * 创建VersionDiffSummary对象。
 */
export function createVersionDiffSummary(
  fromId: string,
  toId: string,
  items: SnapshotDiffItem[],
  aiResponse: VersionDiffAiResponse,
): VersionDiffSummary {
  return {
    fromSnapshotId: fromId,
    toSnapshotId: toId,
    diff: items,
    aiSummary: aiResponse.summary,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * 规范化VersionDiffSummary，处理旧项目兼容。
 */
export function normalizeVersionDiffSummary(input: unknown): VersionDiffSummary | undefined {
  if (!input || typeof input !== 'object') return undefined;
  const obj = input as Record<string, unknown>;
  if (typeof obj.fromSnapshotId !== 'string' || typeof obj.toSnapshotId !== 'string') return undefined;
  return {
    fromSnapshotId: obj.fromSnapshotId,
    toSnapshotId: obj.toSnapshotId,
    diff: Array.isArray(obj.diff) ? (obj.diff as SnapshotDiffItem[]) : [],
    aiSummary: typeof obj.aiSummary === 'string' ? obj.aiSummary : '',
    generatedAt: typeof obj.generatedAt === 'string' ? obj.generatedAt : '',
  };
}
