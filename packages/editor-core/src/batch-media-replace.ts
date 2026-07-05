import type { MediaAsset, Clip, ClipKeyframes, Keyframe } from './model-types';

/** 兼容性检查严重程度 */
export type CompatSeverity = 'ok' | 'warning' | 'error';

/** 兼容性问题类型 */
export type CompatIssueType = 'resolution' | 'duration' | 'codec' | 'missing';

/** 单个 clip 的兼容性检查结果 */
export interface ClipCompatResult {
  clipId: string;
  clipName: string;
  severity: CompatSeverity;
  issues: CompatIssue[];
}

export interface CompatIssue {
  type: CompatIssueType;
  severity: Exclude<CompatSeverity, 'ok'>;
  message: string;
  expected?: string;
  actual?: string;
}

/** 时长处理策略 */
export type DurationStrategy = 'trim' | 'stretch' | 'keep';

/** 替换映射条目 */
export interface ReplaceMapping {
  clipId: string;
  oldAssetId: string;
  newAssetId: string;
  newAsset: MediaAsset;
  durationStrategy: DurationStrategy;
}

/** 批量替换预检报告 */
export interface BatchReplacePrecheckReport {
  totalClips: number;
  compatibleClips: number;
  warningClips: number;
  errorClips: number;
  results: ClipCompatResult[];
  canProceed: boolean;
}

/** 替换后失效警告 */
export interface PostReplaceWarning {
  clipId: string;
  clipName: string;
  warningType: 'keyframe-out-of-range' | 'effect-duration-mismatch';
  message: string;
  detail: string;
}

/** 批量替换执行结果 */
export interface BatchReplaceResult {
  report: BatchReplacePrecheckReport;
  warnings: PostReplaceWarning[];
  replacedClipIds: string[];
}

/**
 * 检查单个 clip 与新媒体资产的兼容性。
 */
export function checkClipCompatibility(
  clip: Pick<Clip, 'id' | 'name'> & { duration: number },
  oldAsset: Pick<MediaAsset, 'id' | 'name' | 'width' | 'height' | 'duration' | 'videoCodec'> | undefined,
  newAsset: Pick<MediaAsset, 'id' | 'name' | 'width' | 'height' | 'duration' | 'videoCodec'>,
  durationStrategy: DurationStrategy = 'keep'
): ClipCompatResult {
  const issues: CompatIssue[] = [];

  if (!oldAsset) {
    issues.push({
      type: 'missing',
      severity: 'warning',
      message: `原始媒体资产未找到`
    });
  }

  // 分辨率检查
  if (oldAsset && (oldAsset.width !== newAsset.width || oldAsset.height !== newAsset.height)) {
    issues.push({
      type: 'resolution',
      severity: 'error',
      message: `分辨率不匹配: ${newAsset.width}x${newAsset.height} (原 ${oldAsset.width}x${oldAsset.height})`,
      expected: `${oldAsset.width}x${oldAsset.height}`,
      actual: `${newAsset.width}x${newAsset.height}`
    });
  }

  // 时长检查
  if (durationStrategy !== 'stretch' && oldAsset) {
    if (newAsset.duration < clip.duration) {
      const severity: CompatSeverity = durationStrategy === 'trim' ? 'warning' : 'error';
      issues.push({
        type: 'duration',
        severity,
        message: `新媒体时长不足: ${newAsset.duration.toFixed(2)}s < clip ${clip.duration.toFixed(2)}s`,
        expected: `>= ${clip.duration.toFixed(2)}s`,
        actual: `${newAsset.duration.toFixed(2)}s`
      });
    }
  }

  // 编解码器检查
  if (oldAsset) {
    const oldCodec = oldAsset.videoCodec;
    const newCodec = newAsset.videoCodec;
    if (oldCodec && newCodec && oldCodec !== newCodec) {
      issues.push({
        type: 'codec',
        severity: 'warning',
        message: `编解码器变更: ${newCodec} (原 ${oldCodec})`,
        expected: oldCodec,
        actual: newCodec
      });
    }
  }

  const severity = summarizeSeverity(issues);
  return { clipId: clip.id, clipName: clip.name, severity, issues };
}

/**
 * 按文件名匹配规则，在新目录中寻找同名文件。
 */
export function matchByFilename(
  oldAsset: Pick<MediaAsset, 'name'>,
  newAssets: MediaAsset[]
): MediaAsset | undefined {
  const oldBase = stripExtension(oldAsset.name).toLowerCase();
  return newAssets.find((a) => stripExtension(a.name).toLowerCase() === oldBase);
}

function stripExtension(name: string): string {
  const lastDot = name.lastIndexOf('.');
  return lastDot > 0 ? name.slice(0, lastDot) : name;
}

/**
 * 构建批量替换预检报告。
 */
export function buildBatchReplacePrecheckReport(
  mappings: ReplaceMapping[],
  getOldAsset: (assetId: string) => MediaAsset | undefined
): BatchReplacePrecheckReport {
  const results = mappings.map((mapping) => {
    const oldAsset = getOldAsset(mapping.oldAssetId);
    return checkClipCompatibility(
      { id: mapping.clipId, name: '', duration: 0 },
      oldAsset,
      mapping.newAsset,
      mapping.durationStrategy
    );
  });

  return {
    totalClips: results.length,
    compatibleClips: results.filter((r) => r.severity === 'ok').length,
    warningClips: results.filter((r) => r.severity === 'warning').length,
    errorClips: results.filter((r) => r.severity === 'error').length,
    results,
    canProceed: results.every((r) => r.severity !== 'error')
  };
}

/**
 * 检测替换后关键帧/特效因新媒体属性差异而失效的情况。
 */
export function detectPostReplaceWarnings(
 clip: { id: string; name: string; duration: number; keyframes?: ClipKeyframes },
 newAsset: Pick<MediaAsset, 'duration'>
): PostReplaceWarning[] {
  const warnings: PostReplaceWarning[] = [];
  if (!clip.keyframes) return warnings;

  const maxTime = newAsset.duration;
  const props: Array<keyof ClipKeyframes> = [
    'opacity', 'volume', 'x', 'y', 'scaleX', 'scaleY', 'speed',
    'yaw', 'pitch', 'roll', 'spatialX', 'spatialY',
    'spatialAzimuth', 'spatialElevation', 'spatialDistanceMeters', 'pathStartOffset'
  ];

  for (const prop of props) {
    const kfs = clip.keyframes[prop] as Keyframe<number>[] | undefined;
    if (!kfs || kfs.length === 0) continue;
    const outOfRange = kfs.filter((kf) => kf.time > maxTime);
    if (outOfRange.length > 0) {
      warnings.push({
        clipId: clip.id,
        clipName: clip.name,
        warningType: 'keyframe-out-of-range',
        message: `关键帧属性 "${prop}" 有 ${outOfRange.length} 个超出新媒体时长 (${maxTime.toFixed(2)}s)`,
        detail: outOfRange.map((kf) => `${prop}@${kf.time.toFixed(2)}s`).join(', ')
      });
    }
  }

  return warnings;
}

function summarizeSeverity(issues: CompatIssue[]): CompatSeverity {
  if (issues.some((i) => i.severity === 'error')) return 'error';
  if (issues.some((i) => i.severity === 'warning')) return 'warning';
  return 'ok';
}
