/**
 * Inference Provider abstraction layer.
 *
 * Defines a unified interface for AI inference backends (local, remote, heuristic).
 * All downstream features depend on this interface instead of directly calling
 * InferenceEngine, enabling clean degradation when no real inference is available.
 */
import type { ComputeBackend, InferenceConfig, TensorDescriptor, InferenceResult, ModelType } from './inference-engine';
/** Capability flags that a provider can declare. */
export type InferenceCapability = 'asr' | 'semantic' | 'vision' | 'llm' | 'scene-detection' | 'object-detection' | 'face-detection' | 'speech-to-text' | 'noise-reduction' | 'style-transfer' | 'super-resolution';
/** Provider health status. */
export type ProviderHealth = 'ready' | 'degraded' | 'not-ready' | 'error';
/** Unified inference provider interface. */
export interface InferenceProvider {
    /** Unique provider identifier. */
    readonly id: string;
    /** Human-readable name. */
    readonly name: string;
    /** Provider version string. */
    readonly version: string;
    /** Whether the provider is ready to accept inference requests. */
    readonly isReady: boolean;
    /** Current health status. */
    readonly health: ProviderHealth;
    /** Declared capabilities. */
    readonly capabilities: ReadonlySet<InferenceCapability>;
    /** Active compute backend. */
    readonly backend: ComputeBackend;
    /** Initialize the provider. Returns true if ready. */
    initialize(): Promise<boolean>;
    /** Run inference for a given model type. */
    infer(modelType: ModelType, input: TensorDescriptor): Promise<InferenceResult>;
    /** Check if a specific capability is available. */
    hasCapability(capability: InferenceCapability): boolean;
    /** Release all resources. */
    destroy(): void;
}
/** Provider factory function type. */
export type ProviderFactory = (config?: Partial<InferenceConfig>) => InferenceProvider;
/** Register a provider factory. */
export declare function registerProvider(id: string, factory: ProviderFactory): void;
/** Create a provider by ID. Returns undefined if not registered. */
export declare function createProvider(id: string, config?: Partial<InferenceConfig>): InferenceProvider | undefined;
/** List all registered provider IDs. */
export declare function listRegisteredProviders(): string[];
/** Local inference provider using browser-side compute (WebGPU/WebGL2/WASM/CPU). */
export declare class LocalInferenceProvider implements InferenceProvider {
    readonly id = "local";
    readonly name = "Local Inference Provider";
    readonly version = "1.0.0";
    private engine;
    private _isReady;
    private _health;
    private _capabilities;
    constructor(config?: Partial<InferenceConfig>);
    get isReady(): boolean;
    get health(): ProviderHealth;
    get capabilities(): ReadonlySet<InferenceCapability>;
    get backend(): ComputeBackend;
    initialize(): Promise<boolean>;
    infer(modelType: ModelType, input: TensorDescriptor): Promise<InferenceResult>;
    hasCapability(capability: InferenceCapability): boolean;
    destroy(): void;
}
/** Remote inference provider — connects to a cloud inference service. */
export declare class RemoteInferenceProvider implements InferenceProvider {
    readonly id = "remote";
    readonly name = "Remote Inference Provider";
    readonly version = "1.0.0";
    private _isReady;
    private _health;
    private _capabilities;
    private readonly endpoint;
    constructor(config: {
        endpoint: string;
        capabilities?: InferenceCapability[];
    } & Partial<InferenceConfig>);
    get isReady(): boolean;
    get health(): ProviderHealth;
    get capabilities(): ReadonlySet<InferenceCapability>;
    get backend(): ComputeBackend;
    initialize(): Promise<boolean>;
    infer(modelType: ModelType, input: TensorDescriptor): Promise<InferenceResult>;
    hasCapability(capability: InferenceCapability): boolean;
    destroy(): void;
}
/** Heuristic fallback provider — no real ML, uses simple algorithms. */
export declare class HeuristicProvider implements InferenceProvider {
    readonly id = "heuristic";
    readonly name = "Heuristic Fallback Provider";
    readonly version = "1.0.0";
    readonly isReady = true;
    readonly health: ProviderHealth;
    readonly backend: ComputeBackend;
    private _capabilities;
    get capabilities(): ReadonlySet<InferenceCapability>;
    initialize(): Promise<boolean>;
    infer(modelType: ModelType, input: TensorDescriptor): Promise<InferenceResult>;
    hasCapability(capability: InferenceCapability): boolean;
    destroy(): void;
}
/** Manages the active inference provider and provides fallback chain. */
export declare class InferenceProviderManager {
    private providers;
    private activeProviderId;
    private fallbackChain;
    /** Register a provider instance. */
    addProvider(provider: InferenceProvider): void;
    /** Set the fallback chain (ordered list of provider IDs). */
    setFallbackChain(chain: string[]): void;
    /** Initialize all registered providers and select the best one. */
    initialize(): Promise<InferenceProvider>;
    /** Get the currently active provider. */
    getActiveProvider(): InferenceProvider | null;
    /** Get a specific provider by ID. */
    getProvider(id: string): InferenceProvider | undefined;
    /** List all registered providers with their status. */
    listProviders(): Array<{
        id: string;
        name: string;
        health: ProviderHealth;
        isReady: boolean;
    }>;
    /** Destroy all providers. */
    destroy(): void;
}
//# sourceMappingURL=inference-provider.d.ts.map