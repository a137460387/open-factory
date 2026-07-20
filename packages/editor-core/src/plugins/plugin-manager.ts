/**
 * Plugin manager for lifecycle management.
 *
 * Handles loading, activating, deactivating, and unloading plugins.
 * Coordinates with the plugin registry for state management.
 * All side effects are explicitly managed through the PluginContext.
 */

import type {
  AnyPlugin,
  PluginContext,
  PluginEventEmitter,
  PluginLifecycle,
  PluginLogger,
  PluginManifest,
  PluginRegistration,
  PluginStatus,
  PluginStorage,
} from './plugin-types';
import { PluginRegistry } from './plugin-registry';

// --- Types ---

/** Plugin manager event types. */
export type PluginManagerEvent =
  | 'plugin-registered'
  | 'plugin-loaded'
  | 'plugin-activated'
  | 'plugin-deactivated'
  | 'plugin-unloaded'
  | 'plugin-error';

/** Event payload for plugin manager events. */
export interface PluginManagerEventPayload {
  /** Event type. */
  event: PluginManagerEvent;
  /** Plugin ID. */
  pluginId: string;
  /** Plugin manifest. */
  manifest: PluginManifest;
  /** Error if applicable. */
  error?: Error;
  /** Timestamp. */
  timestamp: number;
}

/** Plugin manager options. */
export interface PluginManagerOptions {
  /** Maximum concurrent plugin loads (default 3). */
  maxConcurrentLoads?: number;
  /** Load timeout in milliseconds (default 10000). */
  loadTimeoutMs?: number;
  /** Whether to auto-activate plugins after loading (default true). */
  autoActivate?: boolean;
}

/** Event listener type. */
type EventListener = (payload: PluginManagerEventPayload) => void;

// --- Plugin Manager ---

/**
 * Plugin manager for lifecycle management.
 *
 * Orchestrates the full plugin lifecycle:
 * register -> load -> activate -> deactivate -> unload -> unregister
 */
export class PluginManager {
  private readonly registry: PluginRegistry;
  private readonly options: Required<PluginManagerOptions>;
  private readonly listeners = new Map<string, Set<EventListener>>();
  private readonly contexts = new Map<string, PluginContext>();
  private readonly loadQueue: string[] = [];
  private loading = 0;

  constructor(registry?: PluginRegistry, options: PluginManagerOptions = {}) {
    this.registry = registry ?? new PluginRegistry();
    this.options = {
      maxConcurrentLoads: options.maxConcurrentLoads ?? 3,
      loadTimeoutMs: options.loadTimeoutMs ?? 10000,
      autoActivate: options.autoActivate ?? true,
    };
  }

  // --- Registration ---

  /**
   * Register a plugin.
   *
   * @param manifest - Plugin manifest.
   * @param plugin - Plugin implementation.
   * @returns Registration entry.
   */
  register(manifest: PluginManifest, plugin: AnyPlugin): PluginRegistration {
    const registration = this.registry.register(manifest, plugin);
    this.emit('plugin-registered', manifest);
    return registration;
  }

  /**
   * Unregister a plugin.
   *
   * @param pluginId - Plugin ID.
   * @returns Whether the plugin was found and removed.
   */
  async unregister(pluginId: string): Promise<boolean> {
    const entry = this.registry.get(pluginId);
    if (!entry) {
      return false;
    }

    // Ensure plugin is unloaded before unregistering.
    if (entry.status === 'active' || entry.status === 'loaded') {
      await this.deactivate(pluginId);
      await this.unload(pluginId);
    }

    this.contexts.delete(pluginId);
    return this.registry.unregister(pluginId);
  }

  // --- Lifecycle ---

  /**
   * Load a plugin (calls onLoad).
   *
   * @param pluginId - Plugin ID.
   * @returns Whether the load was successful.
   */
  async load(pluginId: string): Promise<boolean> {
    const entry = this.registry.get(pluginId);
    if (!entry) {
      return false;
    }

    if (entry.status === 'loaded' || entry.status === 'active') {
      return true; // Already loaded.
    }

    if (entry.status === 'loading') {
      return false; // Already loading.
    }

    // Check concurrent load limit.
    if (this.loading >= this.options.maxConcurrentLoads) {
      this.loadQueue.push(pluginId);
      return new Promise<boolean>((resolve) => {
        const check = () => {
          if (this.loading < this.options.maxConcurrentLoads) {
            const idx = this.loadQueue.indexOf(pluginId);
            if (idx >= 0) {
              this.loadQueue.splice(idx, 1);
            }
            this.load(pluginId).then(resolve);
          } else {
            setTimeout(check, 100);
          }
        };
        check();
      });
    }

    this.registry.updateStatus(pluginId, 'loading');
    this.loading++;

    try {
      const context = this.getOrCreateContext(entry);
      const lifecycle = entry.plugin as PluginLifecycle;

      // Load with timeout.
      await this.withTimeout(
        lifecycle.onLoad?.(context) ?? Promise.resolve(),
        this.options.loadTimeoutMs,
        `Plugin '${pluginId}' load timed out`,
      );

      this.registry.updateStatus(pluginId, 'loaded');
      this.contexts.set(pluginId, context);
      this.emit('plugin-loaded', entry.manifest);

      // Auto-activate if configured.
      if (this.options.autoActivate) {
        await this.activate(pluginId);
      }

      return true;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.registry.updateStatus(pluginId, 'error', err);
      this.emit('plugin-error', entry.manifest, err);

      // Call onError if available.
      try {
        const lifecycle = entry.plugin as PluginLifecycle;
        const context = this.contexts.get(pluginId) ?? this.getOrCreateContext(entry);
        lifecycle.onError?.(err, context);
      } catch {
        // Ignore errors in error handler.
      }

      return false;
    } finally {
      this.loading--;
      this.processQueue();
    }
  }

  /**
   * Activate a plugin (calls onActivate).
   *
   * @param pluginId - Plugin ID.
   * @returns Whether the activation was successful.
   */
  async activate(pluginId: string): Promise<boolean> {
    const entry = this.registry.get(pluginId);
    if (!entry) {
      return false;
    }

    if (entry.status === 'active') {
      return true; // Already active.
    }

    if (entry.status !== 'loaded') {
      // Must load first.
      const loaded = await this.load(pluginId);
      if (!loaded) {
        return false;
      }
    }

    try {
      const context = this.contexts.get(pluginId);
      if (!context) {
        return false;
      }

      const lifecycle = entry.plugin as PluginLifecycle;
      await lifecycle.onActivate?.(context);

      this.registry.updateStatus(pluginId, 'active');
      this.emit('plugin-activated', entry.manifest);
      return true;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.registry.updateStatus(pluginId, 'error', err);
      this.emit('plugin-error', entry.manifest, err);
      return false;
    }
  }

  /**
   * Deactivate a plugin (calls onDeactivate).
   *
   * @param pluginId - Plugin ID.
   * @returns Whether the deactivation was successful.
   */
  async deactivate(pluginId: string): Promise<boolean> {
    const entry = this.registry.get(pluginId);
    if (!entry) {
      return false;
    }

    if (entry.status !== 'active') {
      return true; // Nothing to deactivate.
    }

    try {
      const context = this.contexts.get(pluginId);
      if (!context) {
        return false;
      }

      const lifecycle = entry.plugin as PluginLifecycle;
      await lifecycle.onDeactivate?.(context);

      this.registry.updateStatus(pluginId, 'loaded');
      this.emit('plugin-deactivated', entry.manifest);
      return true;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.registry.updateStatus(pluginId, 'error', err);
      this.emit('plugin-error', entry.manifest, err);
      return false;
    }
  }

  /**
   * Unload a plugin (calls onUnload).
   *
   * @param pluginId - Plugin ID.
   * @returns Whether the unload was successful.
   */
  async unload(pluginId: string): Promise<boolean> {
    const entry = this.registry.get(pluginId);
    if (!entry) {
      return false;
    }

    if (entry.status === 'registered' || entry.status === 'unloaded') {
      return true; // Nothing to unload.
    }

    // Deactivate first if active.
    if (entry.status === 'active') {
      await this.deactivate(pluginId);
    }

    try {
      const context = this.contexts.get(pluginId);
      if (context) {
        const lifecycle = entry.plugin as PluginLifecycle;
        await lifecycle.onUnload?.(context);
      }

      this.registry.updateStatus(pluginId, 'unloaded');
      this.emit('plugin-unloaded', entry.manifest);
      return true;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.registry.updateStatus(pluginId, 'error', err);
      this.emit('plugin-error', entry.manifest, err);
      return false;
    }
  }

  // --- Query ---

  /**
   * Get the plugin registry.
   */
  getRegistry(): PluginRegistry {
    return this.registry;
  }

  /**
   * Get a plugin registration by ID.
   */
  getPlugin(pluginId: string): PluginRegistration | undefined {
    return this.registry.get(pluginId);
  }

  /**
   * Get all active plugins.
   */
  getActivePlugins(): PluginRegistration[] {
    return this.registry.query({ status: 'active' });
  }

  /**
   * Get plugins by category.
   */
  getPluginsByCategory(category: string): PluginRegistration[] {
    return this.registry.query({ category: category as any });
  }

  // --- Events ---

  /**
   * Add an event listener.
   *
   * @param event - Event type to listen for.
   * @param listener - Event listener function.
   * @returns Unsubscribe function.
   */
  on(event: PluginManagerEvent | '*', listener: EventListener): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener);

    return () => {
      this.listeners.get(event)?.delete(listener);
    };
  }

  /**
   * Remove all event listeners.
   */
  removeAllListeners(): void {
    this.listeners.clear();
  }

  // --- Internal ---

  private emit(event: PluginManagerEvent, manifest: PluginManifest, error?: Error): void {
    const payload: PluginManagerEventPayload = {
      event,
      pluginId: manifest.id,
      manifest,
      error,
      timestamp: Date.now(),
    };

    // Notify specific listeners.
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      for (const listener of eventListeners) {
        try {
          listener(payload);
        } catch {
          // Ignore listener errors.
        }
      }
    }

    // Notify wildcard listeners.
    const wildcardListeners = this.listeners.get('*');
    if (wildcardListeners) {
      for (const listener of wildcardListeners) {
        try {
          listener(payload);
        } catch {
          // Ignore listener errors.
        }
      }
    }
  }

  private getOrCreateContext(entry: PluginRegistration): PluginContext {
    const existing = this.contexts.get(entry.manifest.id);
    if (existing) {
      return existing;
    }

    const context = createPluginContext(entry.manifest);
    this.contexts.set(entry.manifest.id, context);
    return context;
  }

  private async withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
    return Promise.race([promise, new Promise<T>((_, reject) => setTimeout(() => reject(new Error(message)), ms))]);
  }

  private processQueue(): void {
    if (this.loadQueue.length > 0 && this.loading < this.options.maxConcurrentLoads) {
      const next = this.loadQueue.shift();
      if (next) {
        this.load(next);
      }
    }
  }
}

// --- Context factory ---

/** Create a plugin context for a given manifest. */
function createPluginContext(manifest: PluginManifest): PluginContext {
  return {
    manifest,
    logger: createLogger(manifest.id),
    storage: createStorage(manifest.id),
    events: createEventEmitter(),
  };
}

function createLogger(pluginId: string): PluginLogger {
  const prefix = `[plugin:${pluginId}]`;
  return {
    info: (message: string, ...args: unknown[]) => console.info(prefix, message, ...args),
    warn: (message: string, ...args: unknown[]) => console.warn(prefix, message, ...args),
    error: (message: string, ...args: unknown[]) => console.error(prefix, message, ...args),
    debug: (message: string, ...args: unknown[]) => console.debug(prefix, message, ...args),
  };
}

function createStorage(pluginId: string): PluginStorage {
  // In-memory storage implementation.
  // In production, this would use IndexedDB or file system.
  const store = new Map<string, unknown>();

  return {
    async get<T>(key: string): Promise<T | undefined> {
      return store.get(`${pluginId}:${key}`) as T | undefined;
    },
    async set<T>(key: string, value: T): Promise<void> {
      store.set(`${pluginId}:${key}`, value);
    },
    async delete(key: string): Promise<void> {
      store.delete(`${pluginId}:${key}`);
    },
    async clear(): Promise<void> {
      for (const key of store.keys()) {
        if (key.startsWith(`${pluginId}:`)) {
          store.delete(key);
        }
      }
    },
    async keys(): Promise<string[]> {
      const prefix = `${pluginId}:`;
      return Array.from(store.keys())
        .filter((k) => k.startsWith(prefix))
        .map((k) => k.slice(prefix.length));
    },
  };
}

function createEventEmitter(): PluginEventEmitter {
  const handlers = new Map<string, Set<(data: unknown) => void>>();

  return {
    emit(event: string, data?: unknown): void {
      const eventHandlers = handlers.get(event);
      if (eventHandlers) {
        for (const handler of eventHandlers) {
          try {
            handler(data);
          } catch {
            // Ignore handler errors.
          }
        }
      }
    },
    on(event: string, handler: (data: unknown) => void): () => void {
      if (!handlers.has(event)) {
        handlers.set(event, new Set());
      }
      handlers.get(event)!.add(handler);
      return () => {
        handlers.get(event)?.delete(handler);
      };
    },
    once(event: string, handler: (data: unknown) => void): () => void {
      const wrapped = (data: unknown) => {
        handler(data);
        handlers.get(event)?.delete(wrapped);
      };
      if (!handlers.has(event)) {
        handlers.set(event, new Set());
      }
      handlers.get(event)!.add(wrapped);
      return () => {
        handlers.get(event)?.delete(wrapped);
      };
    },
  };
}
