import type { ExportRecoveryErrorKind, FfmpegExportPlan } from './export-types';

/** 重试间隔模式 */
export type RetryBackoffMode = 'fixed' | 'exponential';

/** 重试策略配置 */
export interface ExportRetryConfig {
  maxRetries: number;
  backoffMode: RetryBackoffMode;
  baseIntervalMs: number;
  retryableErrorKinds: ExportRecoveryErrorKind[];
  autoDegradeOnRetry: boolean;
}

/** 重试历史条目 */
export interface RetryHistoryEntry {
  attempt: number;
  timestamp: string;
  action: 'initial-fail' | 'retry' | 'manual-retry';
  degraded: boolean;
  degradeReason?: string;
  errorKind?: ExportRecoveryErrorKind;
  errorMessage?: string;
  result: 'pending' | 'success' | 'failed';
}

/** 重试降级决策 */
export interface RetryDegradeDecision {
  shouldDegrade: boolean;
  degradeType: 'reduce-concurrency' | 'fallback-codec' | 'none';
  reason: string;
}

export const DEFAULT_RETRY_CONFIG: ExportRetryConfig = {
  maxRetries: 3,
  backoffMode: 'exponential',
  baseIntervalMs: 2000,
  retryableErrorKinds: ['out-of-memory', 'unsupported-codec', 'disk-space'],
  autoDegradeOnRetry: true,
};

/** 最大允许重试次数 */
export const MAX_ALLOWED_RETRIES = 5;

/**
 * 计算指数退避间隔（毫秒）。
 * 第 N 次重试间隔 = baseIntervalMs * 2^(N-1)
 * 固定模式下始终返回 baseIntervalMs。
 */
export function calculateRetryInterval(
  config: Pick<ExportRetryConfig, 'backoffMode' | 'baseIntervalMs'>,
  attempt: number,
): number {
  if (attempt <= 0) return 0;
  if (config.backoffMode === 'fixed') return config.baseIntervalMs;
  return config.baseIntervalMs * Math.pow(2, attempt - 1);
}

/**
 * 判断指定错误类型是否应该自动重试。
 * 崩溃类错误（ffmpeg-crash）不自动重试。
 */
export function shouldAutoRetry(
  config: Pick<ExportRetryConfig, 'retryableErrorKinds' | 'maxRetries'>,
  errorKind: ExportRecoveryErrorKind,
  currentAttempt: number,
): boolean {
  if (currentAttempt >= config.maxRetries) return false;
  if (errorKind === 'ffmpeg-crash') return false;
  if (errorKind === 'unknown') return false;
  return config.retryableErrorKinds.includes(errorKind);
}

/**
 * 根据重试次数决定是否需要降级以及降级类型。
 * - 第 2 次重试（attempt=2）：降低并行数
 * - 第 3 次重试（attempt=3）：切换软件编码
 * - 之后：不再降级
 */
export function decideRetryDegrade(attempt: number): RetryDegradeDecision {
  if (attempt === 2) {
    return {
      shouldDegrade: true,
      degradeType: 'reduce-concurrency',
      reason: '第二次重试，自动降低并行数以减少资源竞争',
    };
  }
  if (attempt === 3) {
    return {
      shouldDegrade: true,
      degradeType: 'fallback-codec',
      reason: '第三次重试，切换为软件编码以提高兼容性',
    };
  }
  return { shouldDegrade: false, degradeType: 'none', reason: '' };
}

/**
 * 创建重试历史时间线的渲染数据。
 */
export function buildRetryTimelineData(
  entries: RetryHistoryEntry[],
): Array<{ label: string; timestamp: string; status: 'success' | 'failed' | 'pending'; detail: string }> {
  return entries.map((entry) => {
    const degradeTag = entry.degraded ? `（降级: ${entry.degradeReason ?? '自动'}）` : '';
    let label: string;
    if (entry.action === 'initial-fail') {
      label = '首次失败';
    } else if (entry.action === 'retry') {
      label = `自动重试 ${entry.attempt - 1}`;
    } else {
      label = `手动重试`;
    }
    return {
      label: `${label}${degradeTag}`,
      timestamp: entry.timestamp,
      status: entry.result,
      detail: entry.errorMessage ?? '',
    };
  });
}

/**
 * 规范化重试配置，确保值在合理范围内。
 */
export function normalizeRetryConfig(config: Partial<ExportRetryConfig>): ExportRetryConfig {
  return {
    maxRetries: Math.min(MAX_ALLOWED_RETRIES, Math.max(0, config.maxRetries ?? DEFAULT_RETRY_CONFIG.maxRetries)),
    backoffMode: config.backoffMode === 'fixed' ? 'fixed' : 'exponential',
    baseIntervalMs: Math.max(500, config.baseIntervalMs ?? DEFAULT_RETRY_CONFIG.baseIntervalMs),
    retryableErrorKinds: Array.isArray(config.retryableErrorKinds)
      ? config.retryableErrorKinds
      : DEFAULT_RETRY_CONFIG.retryableErrorKinds,
    autoDegradeOnRetry: config.autoDegradeOnRetry !== false,
  };
}
