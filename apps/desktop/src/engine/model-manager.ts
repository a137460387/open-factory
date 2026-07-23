/**
 * AI Model Lazy Loading Manager
 *
 * Sprint AU: Loads AI models on demand and unloads them after idle timeout.
 * Unused engines don't consume memory. Supports model hot-swapping and
 * memory-aware loading decisions.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ModelStatus = 'unloaded' | 'loading' | 'loaded' | 'unloading' | 'error';

export interface ModelEntry {
  id: string;
  name: string;
  status: ModelStatus;
  /** The loaded model instance (type depends on the engine) */
  model: unknown | null;
  /** Estimated memory usage in bytes */
  estimatedMemoryBytes: number;
  /** Timestamp when the model was last accessed */
  lastAccessedAt: number;
  /** Timestamp when the model was loaded */
  loadedAt: number;
  /** Number of active users of this model */
  refCount: number;
  /** Loader function */
  loader: () => Promise<unknown>;
  /** Unloader function (cleanup) */
  unloader?: (model: unknown) => void;
  /** Error if loading failed */
  error?: Error;
}

export interface ModelManagerConfig {
  /** Maximum total memory for all loaded models (bytes) */
  maxTotalMemory: number;
  /** How long unused models stay loaded (ms) */
  idleTimeoutMs: number;
  /** How often to check for idle models (ms) */
  cleanupIntervalMs: number;
}

const DEFAULT_CONFIG: ModelManagerConfig = {
  maxTotalMemory: 2 * 1024 * 1024 * 1024, // 2 GB
  idleTimeoutMs: 60_000, // 60 seconds
  cleanupIntervalMs: 15_000, // 15 seconds
};

// ---------------------------------------------------------------------------
// ModelManager
// ---------------------------------------------------------------------------

export class ModelManager {
  private models = new Map<string, ModelEntry>();
  private config: ModelManagerConfig;
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;
  private listeners = new Set<(event: ModelManagerEvent) => void>();

  constructor(config?: Partial<ModelManagerConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.startCleanup();
  }

  /**
   * Register a model with its loader function.
   */
  register(
    id: string,
    name: string,
    estimatedMemoryBytes: number,
    loader: () => Promise<unknown>,
    unloader?: (model: unknown) => void,
  ): void {
    this.models.set(id, {
      id,
      name,
      status: 'unloaded',
      model: null,
      estimatedMemoryBytes,
      lastAccessedAt: 0,
      loadedAt: 0,
      refCount: 0,
      loader,
      unloader,
    });
  }

  /**
   * Load a model (or return it if already loaded).
   * Increments the reference count.
   */
  async load(id: string): Promise<unknown> {
    const entry = this.models.get(id);
    if (!entry) {
      throw new Error(`Model ${id} not registered`);
    }

    entry.refCount++;
    entry.lastAccessedAt = Date.now();

    if (entry.status === 'loaded' && entry.model !== null) {
      return entry.model;
    }

    if (entry.status === 'loading') {
      // Wait for existing load to complete
      return this.waitForLoad(id);
    }

    // Check if we need to evict other models
    this.evictIfNeeded(entry.estimatedMemoryBytes);

    // Load the model
    entry.status = 'loading';
    this.notify({ type: 'loading', modelId: id });

    try {
      const model = await entry.loader();
      entry.model = model;
      entry.status = 'loaded';
      entry.loadedAt = Date.now();
      entry.lastAccessedAt = Date.now();
      this.notify({ type: 'loaded', modelId: id });
      return model;
    } catch (error) {
      entry.status = 'error';
      entry.error = error instanceof Error ? error : new Error(String(error));
      entry.refCount--;
      this.notify({ type: 'error', modelId: id, error: entry.error });
      throw entry.error;
    }
  }

  /**
   * Release a reference to a model.
   * When refCount reaches 0, the model becomes eligible for unloading.
   */
  release(id: string): void {
    const entry = this.models.get(id);
    if (!entry) return;

    entry.refCount = Math.max(0, entry.refCount - 1);
    entry.lastAccessedAt = Date.now();
  }

  /**
   * Force unload a model immediately.
   */
  unload(id: string): void {
    const entry = this.models.get(id);
    if (!entry || entry.status !== 'loaded') return;

    if (entry.refCount > 0) {
      // Still in use, just mark for later unloading
      return;
    }

    entry.status = 'unloading';
    this.notify({ type: 'unloading', modelId: id });

    if (entry.unloader && entry.model !== null) {
      entry.unloader(entry.model);
    }

    entry.model = null;
    entry.status = 'unloaded';
    entry.loadedAt = 0;
    this.notify({ type: 'unloaded', modelId: id });
  }

  /**
   * Get the current status of a model.
   */
  getStatus(id: string): ModelStatus {
    return this.models.get(id)?.status ?? 'unloaded';
  }

  /**
   * Check if a model is loaded.
   */
  isLoaded(id: string): boolean {
    const entry = this.models.get(id);
    return entry?.status === 'loaded' && entry.model !== null;
  }

  /**
   * Get all registered model IDs.
   */
  getRegisteredIds(): string[] {
    return Array.from(this.models.keys());
  }

  /**
   * Get total estimated memory usage of all loaded models.
   */
  getTotalMemoryUsage(): number {
    let total = 0;
    for (const entry of this.models.values()) {
      if (entry.status === 'loaded') {
        total += entry.estimatedMemoryBytes;
      }
    }
    return total;
  }

  /**
   * Get manager statistics.
   */
  getStats(): {
    totalRegistered: number;
    totalLoaded: number;
    totalMemoryBytes: number;
    maxMemoryBytes: number;
  } {
    let totalLoaded = 0;
    let totalMemoryBytes = 0;
    for (const entry of this.models.values()) {
      if (entry.status === 'loaded') {
        totalLoaded++;
        totalMemoryBytes += entry.estimatedMemoryBytes;
      }
    }
    return {
      totalRegistered: this.models.size,
      totalLoaded,
      totalMemoryBytes,
      maxMemoryBytes: this.config.maxTotalMemory,
    };
  }

  /**
   * Subscribe to model manager events.
   */
  subscribe(listener: (event: ModelManagerEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Destroy the manager and unload all models.
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }

    for (const id of this.models.keys()) {
      this.unload(id);
    }
    this.models.clear();
  }

  // ---------------------------------------------------------------------------
  // Internal
  // ---------------------------------------------------------------------------

  private async waitForLoad(id: string): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const check = () => {
        const entry = this.models.get(id);
        if (!entry) {
          reject(new Error(`Model ${id} not found`));
          return;
        }
        if (entry.status === 'loaded' && entry.model !== null) {
          resolve(entry.model);
        } else if (entry.status === 'error') {
          reject(entry.error ?? new Error(`Model ${id} failed to load`));
        } else {
          setTimeout(check, 50);
        }
      };
      check();
    });
  }

  private evictIfNeeded(neededBytes: number): void {
    const currentUsage = this.getTotalMemoryUsage();
    if (currentUsage + neededBytes <= this.config.maxTotalMemory) {
      return;
    }

    // LRU eviction: unload oldest unused models
    const candidates: ModelEntry[] = [];
    for (const entry of this.models.values()) {
      if (entry.status === 'loaded' && entry.refCount === 0) {
        candidates.push(entry);
      }
    }

    candidates.sort((a, b) => a.lastAccessedAt - b.lastAccessedAt);

    for (const entry of candidates) {
      if (currentUsage + neededBytes <= this.config.maxTotalMemory) {
        break;
      }
      this.unload(entry.id);
    }
  }

  private startCleanup(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.config.cleanupIntervalMs);
  }

  private cleanup(): void {
    const now = Date.now();
    for (const entry of this.models.values()) {
      if (
        entry.status === 'loaded' &&
        entry.refCount === 0 &&
        now - entry.lastAccessedAt > this.config.idleTimeoutMs
      ) {
        this.unload(entry.id);
      }
    }
  }

  private notify(event: ModelManagerEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

export type ModelManagerEvent =
  | { type: 'loading'; modelId: string }
  | { type: 'loaded'; modelId: string }
  | { type: 'unloading'; modelId: string }
  | { type: 'unloaded'; modelId: string }
  | { type: 'error'; modelId: string; error: Error };

// ---------------------------------------------------------------------------
// Singleton instance
// ---------------------------------------------------------------------------

export const modelManager = new ModelManager();
