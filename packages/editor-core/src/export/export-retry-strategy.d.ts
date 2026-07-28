import type { ExportRecoveryErrorKind } from './export-types';
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
export declare const DEFAULT_RETRY_CONFIG: ExportRetryConfig;
/** 最大允许重试次数 */
export declare const MAX_ALLOWED_RETRIES = 5;
/**
 * 计算指数退避间隔（毫秒）。
 * 第 N 次重试间隔 = baseIntervalMs * 2^(N-1)
 * 固定模式下始终返回 baseIntervalMs。
 */
export declare function calculateRetryInterval(config: Pick<ExportRetryConfig, 'backoffMode' | 'baseIntervalMs'>, attempt: number): number;
/**
 * 判断指定错误类型是否应该自动重试。
 * 崩溃类错误（ffmpeg-crash）不自动重试。
 */
export declare function shouldAutoRetry(config: Pick<ExportRetryConfig, 'retryableErrorKinds' | 'maxRetries'>, errorKind: ExportRecoveryErrorKind, currentAttempt: number): boolean;
/**
 * 根据重试次数决定是否需要降级以及降级类型。
 * - 第 2 次重试（attempt=2）：降低并行数
 * - 第 3 次重试（attempt=3）：切换软件编码
 * - 之后：不再降级
 */
export declare function decideRetryDegrade(attempt: number): RetryDegradeDecision;
/**
 * 创建重试历史时间线的渲染数据。
 */
export declare function buildRetryTimelineData(entries: RetryHistoryEntry[]): Array<{
    label: string;
    timestamp: string;
    status: 'success' | 'failed' | 'pending';
    detail: string;
}>;
/**
 * 规范化重试配置，确保值在合理范围内。
 */
export declare function normalizeRetryConfig(config: Partial<ExportRetryConfig>): ExportRetryConfig;
//# sourceMappingURL=export-retry-strategy.d.ts.map