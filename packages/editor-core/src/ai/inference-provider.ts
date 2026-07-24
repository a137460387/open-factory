/**
 * Inference Provider abstraction layer.
 *
 * Defines a unified interface for AI inference backends (local, remote, heuristic).
 * All downstream features depend on this interface instead of directly calling
 * InferenceEngine, enabling clean degradation when no real inference is available.
 */

import type { ComputeBackend, InferenceConfig, TensorDescriptor, InferenceResult } from './inference-engine';

// ==================== Provider Interface ====================

/** Capability flags that a provider can declare. */
export type InferenceCapability =
  | 'asr'
  | 'semantic'
  | 'vision'
  | 'llm'
  | 'scene-detection'
  | 'object-detection'
  | 'face-detection'
  | 'speech-to-text'
  | 'noise-reduction'
  | 'style-transfer'
  | 'super-resolution';

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
  infer(modelType: string, input: TensorDescriptor): Promise<InferenceResult>;
  /** Check if a specific capability is available. */
  hasCapability(capability: InferenceCapability): boolean;
  /** Release all resources. */
  destroy(): void;
}

// ==================== Provider Registry ====================

/** Provider factory function type. */
export type ProviderFactory = (config?: Partial<InferenceConfig>) => InferenceProvider;

const providerRegistry = new Map<string, ProviderFactory>();

/** Register a provider factory. */
export function registerProvider(id: string, factory: ProviderFactory): void {
  providerRegistry.set(id, factory);
}

/** Create a provider by ID. Returns undefined if not registered. */
export function createProvider(id: string, config?: Partial<InferenceConfig>): InferenceProvider | undefined {
  return providerRegistry.get(id)?.(config);
}

/** List all registered provider IDs. */
export function listRegisteredProviders(): string[] {
  return Array.from(providerRegistry.keys());
}

// ==================== Local Inference Provider ====================

import { InferenceEngine } from './inference-engine';

/** Local inference provider using browser-side compute (WebGPU/WebGL2/WASM/CPU). */
export class LocalInferenceProvider implements InferenceProvider {
  readonly id = 'local';
  readonly name = 'Local Inference Provider';
  readonly version = '1.0.0';

  private engine: InferenceEngine;
  private _isReady = false;
  private _health: ProviderHealth = 'not-ready';
  private _capabilities: Set<InferenceCapability>;

  constructor(config: Partial<InferenceConfig> = {}) {
    this.engine = new InferenceEngine(config);
    // Local provider declares all capabilities, but actual availability
    // depends on GPU and model loading.
    this._capabilities = new Set<InferenceCapability>([
      'asr',
      'semantic',
      'vision',
      'llm',
      'scene-detection',
      'object-detection',
      'face-detection',
      'speech-to-text',
      'noise-reduction',
      'style-transfer',
      'super-resolution',
    ]);
  }

  get isReady(): boolean {
    return this._isReady;
  }

  get health(): ProviderHealth {
    return this._health;
  }

  get capabilities(): ReadonlySet<InferenceCapability> {
    return this._capabilities;
  }

  get backend(): ComputeBackend {
    return this.engine.getBackend();
  }

  async initialize(): Promise<boolean> {
    try {
      const ok = await this.engine.initialize();
      this._isReady = ok;
      this._health = ok
        ? (this.engine.isGPUAccelerated() ? 'ready' : 'degraded')
        : 'not-ready';
      return ok;
    } catch (err) {
      this._health = 'error';
      this._isReady = false;
      console.error('[LocalInferenceProvider] initialization failed:', err);
      return false;
    }
  }

  async infer(modelType: string, input: TensorDescriptor): Promise<InferenceResult> {
    if (!this._isReady) {
      throw new Error(`Provider '${this.id}' is not ready (health: ${this._health})`);
    }
    return this.engine.infer(modelType as any, input);
  }

  hasCapability(capability: InferenceCapability): boolean {
    return this._capabilities.has(capability);
  }

  destroy(): void {
    this.engine.destroy();
    this._isReady = false;
    this._health = 'not-ready';
  }
}

// Auto-register
registerProvider('local', (config) => new LocalInferenceProvider(config));

// ==================== Remote Inference Provider ====================

/** Remote inference provider — connects to a cloud inference service. */
export class RemoteInferenceProvider implements InferenceProvider {
  readonly id = 'remote';
  readonly name = 'Remote Inference Provider';
  readonly version = '1.0.0';

  private _isReady = false;
  private _health: ProviderHealth = 'not-ready';
  private _capabilities = new Set<InferenceCapability>();
  private readonly endpoint: string;

  constructor(config: { endpoint: string; capabilities?: InferenceCapability[] } & Partial<InferenceConfig>) {
    this.endpoint = config.endpoint;
    if (config.capabilities) {
      for (const cap of config.capabilities) {
        this._capabilities.add(cap);
      }
    }
  }

  get isReady(): boolean {
    return this._isReady;
  }

  get health(): ProviderHealth {
    return this._health;
  }

  get capabilities(): ReadonlySet<InferenceCapability> {
    return this._capabilities;
  }

  get backend(): ComputeBackend {
    return 'cpu'; // remote backend is abstracted away
  }

  async initialize(): Promise<boolean> {
    try {
      // Health check ping to remote endpoint
      const response = await fetch(`${this.endpoint}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });
      this._isReady = response.ok;
      this._health = response.ok ? 'ready' : 'degraded';
      return this._isReady;
    } catch {
      this._health = 'not-ready';
      this._isReady = false;
      return false;
    }
  }

  async infer(modelType: string, input: TensorDescriptor): Promise<InferenceResult> {
    if (!this._isReady) {
      throw new Error(`Provider '${this.id}' is not ready (health: ${this._health})`);
    }

    const startTime = performance.now();
    const response = await fetch(`${this.endpoint}/infer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ modelType, input: Array.from(new Float32Array(input.data)) }),
    });

    if (!response.ok) {
      throw new Error(`Remote inference failed: ${response.status} ${response.statusText}`);
    }

    const result = await response.json() as { output: number[]; shape: number[] };
    const outputData = new Float32Array(result.output);

    return {
      output: {
        shape: result.shape,
        dtype: 'float32',
        data: outputData.buffer,
      },
      inferenceTimeMs: performance.now() - startTime,
      backend: 'cpu',
      quantization: 'fp32',
      memoryUsedBytes: outputData.byteLength,
    };
  }

  hasCapability(capability: InferenceCapability): boolean {
    return this._capabilities.has(capability);
  }

  destroy(): void {
    this._isReady = false;
    this._health = 'not-ready';
  }
}

// Auto-register
registerProvider('remote', (config) => new RemoteInferenceProvider({
  endpoint: (config as any)?.endpoint ?? 'http://localhost:8080',
  ...config,
}));

// ==================== Heuristic Provider ====================

/** Heuristic fallback provider — no real ML, uses simple algorithms. */
export class HeuristicProvider implements InferenceProvider {
  readonly id = 'heuristic';
  readonly name = 'Heuristic Fallback Provider';
  readonly version = '1.0.0';
  readonly isReady = true;
  readonly health: ProviderHealth = 'degraded';
  readonly backend: ComputeBackend = 'cpu';

  private _capabilities = new Set<InferenceCapability>(['scene-detection']);

  get capabilities(): ReadonlySet<InferenceCapability> {
    return this._capabilities;
  }

  async initialize(): Promise<boolean> {
    return true;
  }

  async infer(modelType: string, input: TensorDescriptor): Promise<InferenceResult> {
    const startTime = performance.now();

    // Return a minimal valid result — downstream code must handle degraded quality
    const output: TensorDescriptor = {
      shape: [1],
      dtype: 'float32',
      data: new Float32Array([0]).buffer,
    };

    return {
      output,
      inferenceTimeMs: performance.now() - startTime,
      backend: 'cpu',
      quantization: 'fp32',
      memoryUsedBytes: output.data.byteLength,
    };
  }

  hasCapability(capability: InferenceCapability): boolean {
    return this._capabilities.has(capability);
  }

  destroy(): void {
    // nothing to clean up
  }
}

// Auto-register
registerProvider('heuristic', () => new HeuristicProvider());

// ==================== Provider Manager ====================

/** Manages the active inference provider and provides fallback chain. */
export class InferenceProviderManager {
  private providers = new Map<string, InferenceProvider>();
  private activeProviderId: string | null = null;
  private fallbackChain: string[] = ['local', 'heuristic'];

  /** Register a provider instance. */
  addProvider(provider: InferenceProvider): void {
    this.providers.set(provider.id, provider);
  }

  /** Set the fallback chain (ordered list of provider IDs). */
  setFallbackChain(chain: string[]): void {
    this.fallbackChain = chain;
  }

  /** Initialize all registered providers and select the best one. */
  async initialize(): Promise<InferenceProvider> {
    const candidates: Array<{ id: string; priority: number }> = [];

    for (const id of this.fallbackChain) {
      const provider = this.providers.get(id);
      if (!provider) continue;

      try {
        const ok = await provider.initialize();
        if (ok) {
          candidates.push({ id, priority: this.fallbackChain.indexOf(id) });
        }
      } catch {
        // Provider failed to initialize — skip
      }
    }

    // Also try any providers not in the fallback chain
    for (const [id, provider] of this.providers) {
      if (this.fallbackChain.includes(id)) continue;
      try {
        const ok = await provider.initialize();
        if (ok) {
          candidates.push({ id, priority: this.fallbackChain.length });
        }
      } catch {
        // skip
      }
    }

    // Sort by priority (lower = better)
    candidates.sort((a, b) => a.priority - b.priority);

    if (candidates.length > 0) {
      this.activeProviderId = candidates[0]!.id;
      return this.providers.get(this.activeProviderId)!;
    }

    throw new Error('No inference provider could be initialized');
  }

  /** Get the currently active provider. */
  getActiveProvider(): InferenceProvider | null {
    return this.activeProviderId ? this.providers.get(this.activeProviderId) ?? null : null;
  }

  /** Get a specific provider by ID. */
  getProvider(id: string): InferenceProvider | undefined {
    return this.providers.get(id);
  }

  /** List all registered providers with their status. */
  listProviders(): Array<{ id: string; name: string; health: ProviderHealth; isReady: boolean }> {
    return Array.from(this.providers.values()).map(p => ({
      id: p.id,
      name: p.name,
      health: p.health,
      isReady: p.isReady,
    }));
  }

  /** Destroy all providers. */
  destroy(): void {
    for (const provider of this.providers.values()) {
      provider.destroy();
    }
    this.providers.clear();
    this.activeProviderId = null;
  }
}
