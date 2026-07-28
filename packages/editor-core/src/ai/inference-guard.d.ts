/**
 * Inference feature guard — prevents downstream features from crashing
 * when the inference engine is not ready.
 *
 * Every feature that depends on inference must call `withInferenceGuard()`
 * before invoking any inference method. The guard returns a safe result
 * or throws a user-friendly error instead of a raw NotImplementedError.
 */
import type { InferenceProvider, InferenceCapability } from './inference-provider';
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
/** Initialize the global inference guard with a provider. */
export declare function initInferenceGuard(provider: InferenceProvider | null): void;
/** Get current provider (for testing/diagnostics). */
export declare function getActiveProvider(): InferenceProvider | null;
/**
 * Check if a feature is available without invoking it.
 * Use this in UI layers to show/hide feature entry points.
 */
export declare function checkFeatureStatus(options: InferenceGuardOptions): FeatureStatus;
/**
 * Execute an inference operation with guard protection.
 * Returns the result if available, or throws a user-friendly error.
 *
 * @param options - Guard configuration.
 * @param operation - The actual inference operation to execute.
 * @returns The inference result.
 * @throws Error with user-friendly message if feature is not available.
 */
export declare function withInferenceGuard<T>(options: InferenceGuardOptions, operation: (provider: InferenceProvider) => Promise<T>): Promise<T>;
/**
 * Synchronous version of withInferenceGuard for non-async operations.
 */
export declare function withInferenceGuardSync<T>(options: InferenceGuardOptions, operation: (provider: InferenceProvider) => T): T;
/** Error thrown when an inference feature is not available. */
export declare class InferenceFeatureDegradedError extends Error {
    readonly featureName: string;
    constructor(featureName: string, reason: string);
}
/** Pre-configured guard for ASR features. */
export declare const ASR_GUARD: InferenceGuardOptions;
/** Pre-configured guard for semantic features. */
export declare const SEMANTIC_GUARD: InferenceGuardOptions;
/** Pre-configured guard for vision features. */
export declare const VISION_GUARD: InferenceGuardOptions;
/** Pre-configured guard for scene detection. */
export declare const SCENE_DETECTION_GUARD: InferenceGuardOptions;
/** Pre-configured guard for face detection. */
export declare const FACE_DETECTION_GUARD: InferenceGuardOptions;
/** Pre-configured guard for noise reduction. */
export declare const NOISE_REDUCTION_GUARD: InferenceGuardOptions;
/** Pre-configured guard for style transfer. */
export declare const STYLE_TRANSFER_GUARD: InferenceGuardOptions;
//# sourceMappingURL=inference-guard.d.ts.map