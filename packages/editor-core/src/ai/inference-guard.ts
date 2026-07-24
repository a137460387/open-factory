/**
 * Inference feature guard — prevents downstream features from crashing
 * when the inference engine is not ready.
 *
 * Every feature that depends on inference must call `withInferenceGuard()`
 * before invoking any inference method. The guard returns a safe result
 * or throws a user-friendly error instead of a raw NotImplementedError.
 */

import type { InferenceProvider, InferenceCapability } from './inference-provider';

// ==================== Types ====================

/** Feature degradation status. */
export interface FeatureStatus {
  /** Whether the feature is available. */
  available: boolean;
  /** Reason if not available. */
  reason?: string;
  /** Provider health if relevant. */
  providerHealth?: string;
}

/** Guard options. */
export interface InferenceGuardOptions {
  /** Required capability for this feature. */
  capability: InferenceCapability;
  /** Human-readable feature name (for error messages). */
  featureName: string;
  /** Whether to log degradation to console. */
  silent?: boolean;
}

// ==================== Guard Implementation ====================

/** Global provider reference — set by initInferenceGuard(). */
let globalProvider: InferenceProvider | null = null;

/** Initialize the global inference guard with a provider. */
export function initInferenceGuard(provider: InferenceProvider | null): void {
  globalProvider = provider;
  if (provider) {
    console.log(`[InferenceGuard] initialized with provider '${provider.id}' (health: ${provider.health})`);
  } else {
    console.warn('[InferenceGuard] no provider available — all inference features will be degraded');
  }
}

/** Get current provider (for testing/diagnostics). */
export function getActiveProvider(): InferenceProvider | null {
  return globalProvider;
}

/**
 * Check if a feature is available without invoking it.
 * Use this in UI layers to show/hide feature entry points.
 */
export function checkFeatureStatus(options: InferenceGuardOptions): FeatureStatus {
  if (!globalProvider) {
    return {
      available: false,
      reason: `${options.featureName}: 推理引擎未初始化`,
      providerHealth: 'not-ready',
    };
  }

  if (!globalProvider.isReady) {
    return {
      available: false,
      reason: `${options.featureName}: 推理引擎未就绪 (${globalProvider.health})`,
      providerHealth: globalProvider.health,
    };
  }

  if (!globalProvider.hasCapability(options.capability)) {
    return {
      available: false,
      reason: `${options.featureName}: 当前推理后端不支持此能力 (${options.capability})`,
      providerHealth: globalProvider.health,
    };
  }

  return { available: true, providerHealth: globalProvider.health };
}

/**
 * Execute an inference operation with guard protection.
 * Returns the result if available, or throws a user-friendly error.
 *
 * @param options - Guard configuration.
 * @param operation - The actual inference operation to execute.
 * @returns The inference result.
 * @throws Error with user-friendly message if feature is not available.
 */
export async function withInferenceGuard<T>(
  options: InferenceGuardOptions,
  operation: (provider: InferenceProvider) => Promise<T>,
): Promise<T> {
  const status = checkFeatureStatus(options);

  if (!status.available) {
    if (!options.silent) {
      console.warn(`[InferenceGuard] feature degraded: ${status.reason}`);
    }
    throw new InferenceFeatureDegradedError(options.featureName, status.reason ?? 'unknown');
  }

  try {
    return await operation(globalProvider!);
  } catch (err) {
    if (err instanceof InferenceFeatureDegradedError) throw err;
    // Wrap unexpected errors so callers get a consistent error type
    const message = err instanceof Error ? err.message : String(err);
    if (!options.silent) {
      console.error(`[InferenceGuard] inference failed for '${options.featureName}':`, message);
    }
    throw new InferenceFeatureDegradedError(options.featureName, `推理失败: ${message}`);
  }
}

/**
 * Synchronous version of withInferenceGuard for non-async operations.
 */
export function withInferenceGuardSync<T>(
  options: InferenceGuardOptions,
  operation: (provider: InferenceProvider) => T,
): T {
  const status = checkFeatureStatus(options);

  if (!status.available) {
    if (!options.silent) {
      console.warn(`[InferenceGuard] feature degraded: ${status.reason}`);
    }
    throw new InferenceFeatureDegradedError(options.featureName, status.reason ?? 'unknown');
  }

  try {
    return operation(globalProvider!);
  } catch (err) {
    if (err instanceof InferenceFeatureDegradedError) throw err;
    const message = err instanceof Error ? err.message : String(err);
    throw new InferenceFeatureDegradedError(options.featureName, `推理失败: ${message}`);
  }
}

// ==================== Error Class ====================

/** Error thrown when an inference feature is not available. */
export class InferenceFeatureDegradedError extends Error {
  readonly featureName: string;

  constructor(featureName: string, reason: string) {
    super(`${featureName} 不可用: ${reason}`);
    this.name = 'InferenceFeatureDegradedError';
    this.featureName = featureName;
  }
}

// ==================== Convenience Guards ====================

/** Pre-configured guard for ASR features. */
export const ASR_GUARD: InferenceGuardOptions = {
  capability: 'asr',
  featureName: '语音识别 (ASR)',
};

/** Pre-configured guard for semantic features. */
export const SEMANTIC_GUARD: InferenceGuardOptions = {
  capability: 'semantic',
  featureName: '语义分析',
};

/** Pre-configured guard for vision features. */
export const VISION_GUARD: InferenceGuardOptions = {
  capability: 'vision',
  featureName: '视觉分析',
};

/** Pre-configured guard for scene detection. */
export const SCENE_DETECTION_GUARD: InferenceGuardOptions = {
  capability: 'scene-detection',
  featureName: '场景检测',
};

/** Pre-configured guard for face detection. */
export const FACE_DETECTION_GUARD: InferenceGuardOptions = {
  capability: 'face-detection',
  featureName: '人脸识别',
};

/** Pre-configured guard for noise reduction. */
export const NOISE_REDUCTION_GUARD: InferenceGuardOptions = {
  capability: 'noise-reduction',
  featureName: '智能降噪',
};

/** Pre-configured guard for style transfer. */
export const STYLE_TRANSFER_GUARD: InferenceGuardOptions = {
  capability: 'style-transfer',
  featureName: '风格迁移',
};
