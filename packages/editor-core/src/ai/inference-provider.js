/**
 * Inference Provider abstraction layer.
 *
 * Defines a unified interface for AI inference backends (local, remote, heuristic).
 * All downstream features depend on this interface instead of directly calling
 * InferenceEngine, enabling clean degradation when no real inference is available.
 */
import { logger } from '../utils/logger.js';
const providerRegistry = new Map();
/** Register a provider factory. */
export function registerProvider(id, factory) {
    providerRegistry.set(id, factory);
}
/** Create a provider by ID. Returns undefined if not registered. */
export function createProvider(id, config) {
    return providerRegistry.get(id)?.(config);
}
/** List all registered provider IDs. */
export function listRegisteredProviders() {
    return Array.from(providerRegistry.keys());
}
// ==================== Local Inference Provider ====================
import { InferenceEngine } from './inference-engine';
/** Local inference provider using browser-side compute (WebGPU/WebGL2/WASM/CPU). */
export class LocalInferenceProvider {
    id = 'local';
    name = 'Local Inference Provider';
    version = '1.0.0';
    engine;
    _isReady = false;
    _health = 'not-ready';
    _capabilities;
    constructor(config = {}) {
        this.engine = new InferenceEngine(config);
        // Local provider declares all capabilities, but actual availability
        // depends on GPU and model loading.
        this._capabilities = new Set([
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
    get isReady() {
        return this._isReady;
    }
    get health() {
        return this._health;
    }
    get capabilities() {
        return this._capabilities;
    }
    get backend() {
        return this.engine.getBackend();
    }
    async initialize() {
        try {
            const ok = await this.engine.initialize();
            this._isReady = ok;
            this._health = ok
                ? (this.engine.isGPUAccelerated() ? 'ready' : 'degraded')
                : 'not-ready';
            return ok;
        }
        catch (err) {
            this._health = 'error';
            this._isReady = false;
            logger.error('[LocalInferenceProvider] initialization failed:', err);
            return false;
        }
    }
    async infer(modelType, input) {
        if (!this._isReady) {
            throw new Error(`Provider '${this.id}' is not ready (health: ${this._health})`);
        }
        return this.engine.infer(modelType, input);
    }
    hasCapability(capability) {
        return this._capabilities.has(capability);
    }
    destroy() {
        this.engine.destroy();
        this._isReady = false;
        this._health = 'not-ready';
    }
}
// Auto-register
registerProvider('local', (config) => new LocalInferenceProvider(config));
// ==================== Remote Inference Provider ====================
/** Remote inference provider — connects to a cloud inference service. */
export class RemoteInferenceProvider {
    id = 'remote';
    name = 'Remote Inference Provider';
    version = '1.0.0';
    _isReady = false;
    _health = 'not-ready';
    _capabilities = new Set();
    endpoint;
    constructor(config) {
        this.endpoint = config.endpoint;
        if (config.capabilities) {
            for (const cap of config.capabilities) {
                this._capabilities.add(cap);
            }
        }
    }
    get isReady() {
        return this._isReady;
    }
    get health() {
        return this._health;
    }
    get capabilities() {
        return this._capabilities;
    }
    get backend() {
        return 'cpu'; // remote backend is abstracted away
    }
    async initialize() {
        try {
            // Health check ping to remote endpoint
            const response = await fetch(`${this.endpoint}/health`, {
                method: 'GET',
                signal: AbortSignal.timeout(5000),
            });
            this._isReady = response.ok;
            this._health = response.ok ? 'ready' : 'degraded';
            return this._isReady;
        }
        catch {
            this._health = 'not-ready';
            this._isReady = false;
            return false;
        }
    }
    async infer(modelType, input) {
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
        const result = await response.json();
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
    hasCapability(capability) {
        return this._capabilities.has(capability);
    }
    destroy() {
        this._isReady = false;
        this._health = 'not-ready';
    }
}
// Auto-register
registerProvider('remote', (config) => new RemoteInferenceProvider({
    endpoint: config?.endpoint ?? 'http://localhost:8080',
    ...config,
}));
// ==================== Heuristic Provider ====================
/** Heuristic fallback provider — no real ML, uses simple algorithms. */
export class HeuristicProvider {
    id = 'heuristic';
    name = 'Heuristic Fallback Provider';
    version = '1.0.0';
    isReady = true;
    health = 'degraded';
    backend = 'cpu';
    _capabilities = new Set(['scene-detection']);
    get capabilities() {
        return this._capabilities;
    }
    async initialize() {
        return true;
    }
    async infer(modelType, input) {
        const startTime = performance.now();
        // Return a minimal valid result — downstream code must handle degraded quality
        const output = {
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
    hasCapability(capability) {
        return this._capabilities.has(capability);
    }
    destroy() {
        // nothing to clean up
    }
}
// Auto-register
registerProvider('heuristic', () => new HeuristicProvider());
// ==================== Provider Manager ====================
/** Manages the active inference provider and provides fallback chain. */
export class InferenceProviderManager {
    providers = new Map();
    activeProviderId = null;
    fallbackChain = ['local', 'heuristic'];
    /** Register a provider instance. */
    addProvider(provider) {
        this.providers.set(provider.id, provider);
    }
    /** Set the fallback chain (ordered list of provider IDs). */
    setFallbackChain(chain) {
        this.fallbackChain = chain;
    }
    /** Initialize all registered providers and select the best one. */
    async initialize() {
        const candidates = [];
        for (const id of this.fallbackChain) {
            const provider = this.providers.get(id);
            if (!provider)
                continue;
            try {
                const ok = await provider.initialize();
                if (ok) {
                    candidates.push({ id, priority: this.fallbackChain.indexOf(id) });
                }
            }
            catch {
                // Provider failed to initialize — skip
            }
        }
        // Also try any providers not in the fallback chain
        for (const [id, provider] of this.providers) {
            if (this.fallbackChain.includes(id))
                continue;
            try {
                const ok = await provider.initialize();
                if (ok) {
                    candidates.push({ id, priority: this.fallbackChain.length });
                }
            }
            catch {
                // skip
            }
        }
        // Sort by priority (lower = better)
        candidates.sort((a, b) => a.priority - b.priority);
        if (candidates.length > 0) {
            this.activeProviderId = candidates[0].id;
            return this.providers.get(this.activeProviderId);
        }
        throw new Error('No inference provider could be initialized');
    }
    /** Get the currently active provider. */
    getActiveProvider() {
        return this.activeProviderId ? this.providers.get(this.activeProviderId) ?? null : null;
    }
    /** Get a specific provider by ID. */
    getProvider(id) {
        return this.providers.get(id);
    }
    /** List all registered providers with their status. */
    listProviders() {
        return Array.from(this.providers.values()).map(p => ({
            id: p.id,
            name: p.name,
            health: p.health,
            isReady: p.isReady,
        }));
    }
    /** Destroy all providers. */
    destroy() {
        for (const provider of this.providers.values()) {
            provider.destroy();
        }
        this.providers.clear();
        this.activeProviderId = null;
    }
}
//# sourceMappingURL=inference-provider.js.map