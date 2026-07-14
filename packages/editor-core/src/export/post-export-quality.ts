export type PostExportQualityCheckId = 'duration' | 'blackFrames' | 'silence' | 'fileSize' | 'resolution';
export type PostExportQualityStatus = 'pass' | 'warning' | 'fail';

export interface PostExportQualityAssuranceSettings {
  enabled: boolean;
  duration: boolean;
  blackFrames: boolean;
  silence: boolean;
  fileSize: boolean;
  resolution: boolean;
  minFileSizeBytes?: number;
  maxFileSizeBytes?: number;
  blackFrameDurationSeconds: number;
  silenceThresholdDb: number;
  silenceDurationSeconds: number;
  autoRetry: boolean;
}

export interface DetectedMediaRange {
  start: number;
  end: number;
  duration: number;
}

export interface PostExportQualityCheckResult {
  id: PostExportQualityCheckId;
  status: PostExportQualityStatus;
  message: string;
  expected?: string | number;
  actual?: string | number;
  ranges?: DetectedMediaRange[];
}

export interface PostExportQualityAssuranceResult {
  status: PostExportQualityStatus;
  checks: PostExportQualityCheckResult[];
  retryRecommended: boolean;
  completedAt: string;
}

export interface PostExportQualityMeasurements {
  expectedDuration?: number;
  actualDuration?: number;
  fps?: number;
  expectedWidth?: number;
  expectedHeight?: number;
  actualWidth?: number;
  actualHeight?: number;
  fileSizeBytes?: number;
  blackFrames?: DetectedMediaRange[];
  silence?: DetectedMediaRange[];
}

export const DEFAULT_POST_EXPORT_QUALITY_ASSURANCE_SETTINGS: PostExportQualityAssuranceSettings = {
  enabled: false,
  duration: false,
  blackFrames: false,
  silence: false,
  fileSize: false,
  resolution: false,
  blackFrameDurationSeconds: 0.5,
  silenceThresholdDb: -50,
  silenceDurationSeconds: 2,
  autoRetry: false,
};

export function normalizePostExportQualityAssuranceSettings(
  settings: Partial<PostExportQualityAssuranceSettings> | undefined,
): PostExportQualityAssuranceSettings {
  return {
    enabled: settings?.enabled === true,
    duration: settings?.duration === true,
    blackFrames: settings?.blackFrames === true,
    silence: settings?.silence === true,
    fileSize: settings?.fileSize === true,
    resolution: settings?.resolution === true,
    minFileSizeBytes: normalizeOptionalBytes(settings?.minFileSizeBytes),
    maxFileSizeBytes: normalizeOptionalBytes(settings?.maxFileSizeBytes),
    blackFrameDurationSeconds: normalizePositiveNumber(
      settings?.blackFrameDurationSeconds,
      DEFAULT_POST_EXPORT_QUALITY_ASSURANCE_SETTINGS.blackFrameDurationSeconds,
    ),
    silenceThresholdDb: normalizeFiniteNumber(
      settings?.silenceThresholdDb,
      DEFAULT_POST_EXPORT_QUALITY_ASSURANCE_SETTINGS.silenceThresholdDb,
    ),
    silenceDurationSeconds: normalizePositiveNumber(
      settings?.silenceDurationSeconds,
      DEFAULT_POST_EXPORT_QUALITY_ASSURANCE_SETTINGS.silenceDurationSeconds,
    ),
    autoRetry: settings?.autoRetry === true,
  };
}

export function hasEnabledPostExportQualityChecks(settings: PostExportQualityAssuranceSettings): boolean {
  return (
    settings.enabled &&
    (settings.duration || settings.blackFrames || settings.silence || settings.fileSize || settings.resolution)
  );
}

export function buildPostExportBlackDetectArgs(
  outputPath: string,
  minDurationSeconds = DEFAULT_POST_EXPORT_QUALITY_ASSURANCE_SETTINGS.blackFrameDurationSeconds,
): string[] {
  return [
    '-hide_banner',
    '-i',
    outputPath,
    '-vf',
    `blackdetect=d=${formatNumber(minDurationSeconds)}`,
    '-an',
    '-f',
    'null',
    '-',
  ];
}

export function buildPostExportSilenceDetectArgs(
  outputPath: string,
  thresholdDb = DEFAULT_POST_EXPORT_QUALITY_ASSURANCE_SETTINGS.silenceThresholdDb,
  minDurationSeconds = DEFAULT_POST_EXPORT_QUALITY_ASSURANCE_SETTINGS.silenceDurationSeconds,
): string[] {
  return [
    '-hide_banner',
    '-i',
    outputPath,
    '-af',
    `silencedetect=n=${formatNumber(thresholdDb)}dB:d=${formatNumber(minDurationSeconds)}`,
    '-vn',
    '-f',
    'null',
    '-',
  ];
}

export function parseBlackDetectOutput(text: string): DetectedMediaRange[] {
  return text.split(/\r?\n/).flatMap((line) => {
    const start = parseNamedNumber(line, 'black_start');
    const end = parseNamedNumber(line, 'black_end');
    const duration =
      parseNamedNumber(line, 'black_duration') ?? (start !== undefined && end !== undefined ? end - start : undefined);
    return start !== undefined && end !== undefined && duration !== undefined ? [{ start, end, duration }] : [];
  });
}

export function parseSilenceDetectOutput(text: string): DetectedMediaRange[] {
  const ranges: DetectedMediaRange[] = [];
  let currentStart: number | undefined;
  for (const line of text.split(/\r?\n/)) {
    const start = parseNamedNumber(line, 'silence_start');
    if (start !== undefined) {
      currentStart = start;
    }
    const end = parseNamedNumber(line, 'silence_end');
    if (end !== undefined) {
      const duration =
        parseNamedNumber(line, 'silence_duration') ?? (currentStart !== undefined ? end - currentStart : 0);
      ranges.push({ start: currentStart ?? Math.max(0, end - duration), end, duration });
      currentStart = undefined;
    }
  }
  return ranges;
}

export function buildPostExportQualityAssuranceResult(
  settings: PostExportQualityAssuranceSettings,
  measurements: PostExportQualityMeasurements,
  completedAt = new Date().toISOString(),
): PostExportQualityAssuranceResult {
  const checks: PostExportQualityCheckResult[] = [];
  if (settings.duration) {
    checks.push(checkDuration(measurements));
  }
  if (settings.blackFrames) {
    checks.push(
      checkRanges(
        'blackFrames',
        measurements.blackFrames ?? [],
        settings.blackFrameDurationSeconds,
        '检测到意外黑帧',
        '未检测到意外黑帧',
      ),
    );
  }
  if (settings.silence) {
    checks.push(
      checkRanges(
        'silence',
        measurements.silence ?? [],
        settings.silenceDurationSeconds,
        '检测到意外静音',
        '未检测到意外静音',
      ),
    );
  }
  if (settings.fileSize) {
    checks.push(checkFileSize(settings, measurements.fileSizeBytes));
  }
  if (settings.resolution) {
    checks.push(checkResolution(measurements));
  }
  const status = summarizePostExportQualityStatus(checks);
  return {
    status,
    checks,
    retryRecommended: status === 'fail' && settings.autoRetry,
    completedAt,
  };
}

export function summarizePostExportQualityStatus(checks: PostExportQualityCheckResult[]): PostExportQualityStatus {
  if (checks.some((check) => check.status === 'fail')) {
    return 'fail';
  }
  if (checks.some((check) => check.status === 'warning')) {
    return 'warning';
  }
  return 'pass';
}

export function shouldRetryPostExportQuality(
  result: Pick<PostExportQualityAssuranceResult, 'status'>,
  settings: Pick<PostExportQualityAssuranceSettings, 'autoRetry'>,
  retryAttempt: number,
): boolean {
  return settings.autoRetry === true && retryAttempt < 1 && result.status === 'fail';
}

function checkDuration(measurements: PostExportQualityMeasurements): PostExportQualityCheckResult {
  const expected = measurements.expectedDuration;
  const actual = measurements.actualDuration;
  const fps = Math.max(1, measurements.fps ?? 30);
  if (!isFiniteNumber(expected) || !isFiniteNumber(actual)) {
    return { id: 'duration', status: 'fail', message: '无法读取导出时长', expected, actual };
  }
  const tolerance = 1 / fps;
  const delta = Math.abs(actual - expected);
  return delta < tolerance
    ? { id: 'duration', status: 'pass', message: '导出时长在 1 帧误差内', expected, actual }
    : { id: 'duration', status: 'fail', message: `导出时长误差超过 1 帧 (${delta.toFixed(3)}s)`, expected, actual };
}

function checkRanges(
  id: Extract<PostExportQualityCheckId, 'blackFrames' | 'silence'>,
  ranges: DetectedMediaRange[],
  minDuration: number,
  warningMessage: string,
  passMessage: string,
): PostExportQualityCheckResult {
  const unexpected = ranges.filter((range) => range.duration >= minDuration);
  return unexpected.length > 0
    ? {
        id,
        status: 'warning',
        message: `${warningMessage} ${unexpected.length} 段`,
        actual: unexpected.length,
        ranges: unexpected,
      }
    : { id, status: 'pass', message: passMessage, actual: 0, ranges: [] };
}

function checkFileSize(
  settings: PostExportQualityAssuranceSettings,
  actual: number | undefined,
): PostExportQualityCheckResult {
  if (!isFiniteNumber(actual)) {
    return { id: 'fileSize', status: 'warning', message: '无法读取导出文件大小' };
  }
  const min = settings.minFileSizeBytes;
  const max = settings.maxFileSizeBytes;
  if (min !== undefined && actual < min) {
    return { id: 'fileSize', status: 'warning', message: '导出文件小于预期最小值', expected: min, actual };
  }
  if (max !== undefined && actual > max) {
    return { id: 'fileSize', status: 'warning', message: '导出文件大于预期最大值', expected: max, actual };
  }
  return { id: 'fileSize', status: 'pass', message: '导出文件大小在预期范围内', actual };
}

function checkResolution(measurements: PostExportQualityMeasurements): PostExportQualityCheckResult {
  const { expectedWidth, expectedHeight, actualWidth, actualHeight } = measurements;
  if (
    !isFiniteNumber(expectedWidth) ||
    !isFiniteNumber(expectedHeight) ||
    !isFiniteNumber(actualWidth) ||
    !isFiniteNumber(actualHeight)
  ) {
    return { id: 'resolution', status: 'fail', message: '无法读取导出分辨率' };
  }
  const expected = `${expectedWidth}x${expectedHeight}`;
  const actual = `${actualWidth}x${actualHeight}`;
  return expected === actual
    ? { id: 'resolution', status: 'pass', message: '输出分辨率与预设一致', expected, actual }
    : { id: 'resolution', status: 'fail', message: '输出分辨率与预设不一致', expected, actual };
}

function parseNamedNumber(line: string, name: string): number | undefined {
  const match = new RegExp(`${name}:\\s*([-+]?\\d+(?:\\.\\d+)?)`).exec(line);
  if (!match) {
    return undefined;
  }
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : undefined;
}

function normalizeOptionalBytes(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.round(value) : undefined;
}

function normalizePositiveNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback;
}

function normalizeFiniteNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(3).replace(/0+$/, '').replace(/\.$/, '');
}
