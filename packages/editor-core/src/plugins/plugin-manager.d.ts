/**
 * Plugin manager for lifecycle management.
 *
 * Handles loading, activating, deactivating, and unloading plugins.
 * Coordinates with the plugin registry for state management.
 * All side effects are explicitly managed through the PluginContext.
 */
import type { AnyPlugin, PluginCategory, PluginManifest, PluginRegistration } from './plugin-types';
import { PluginRegistry } from './plugin-registry';
/** Plugin manager event types. */
export type PluginManagerEvent = 'plugin-registered' | 'plugin-loaded' | 'plugin-activated' | 'plugin-deactivated' | 'plugin-unloaded' | 'plugin-error';
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
/**
 * Plugin manager for lifecycle management.
 *
 * Orchestrates the full plugin lifecycle:
 * register -> load -> activate -> deactivate -> unload -> unregister
 */
export declare class PluginManager {
    private readonly registry;
    private readonly options;
    private readonly listeners;
    private readonly contexts;
    private readonly loadQueue;
    private loading;
    constructor(registry?: PluginRegistry, options?: PluginManagerOptions);
    /**
     * Register a plugin.
     *
     * @param manifest - Plugin manifest.
     * @param plugin - Plugin implementation.
     * @returns Registration entry.
     */
    register(manifest: PluginManifest, plugin: AnyPlugin): PluginRegistration;
    /**
     * Unregister a plugin.
     *
     * @param pluginId - Plugin ID.
     * @returns Whether the plugin was found and removed.
     */
    unregister(pluginId: string): Promise<boolean>;
    /**
     * Load a plugin (calls onLoad).
     *
     * @param pluginId - Plugin ID.
     * @returns Whether the load was successful.
     */
    load(pluginId: string): Promise<boolean>;
    /**
     * Activate a plugin (calls onActivate).
     *
     * @param pluginId - Plugin ID.
     * @returns Whether the activation was successful.
     */
    activate(pluginId: string): Promise<boolean>;
    /**
     * Deactivate a plugin (calls onDeactivate).
     *
     * @param pluginId - Plugin ID.
     * @returns Whether the deactivation was successful.
     */
    deactivate(pluginId: string): Promise<boolean>;
    /**
     * Unload a plugin (calls onUnload).
     *
     * @param pluginId - Plugin ID.
     * @returns Whether the unload was successful.
     */
    unload(pluginId: string): Promise<boolean>;
    /**
     * Get the plugin registry.
     */
    getRegistry(): PluginRegistry;
    /**
     * Get a plugin registration by ID.
     */
    getPlugin(pluginId: string): PluginRegistration | undefined;
    /**
     * Get all active plugins.
     */
    getActivePlugins(): PluginRegistration[];
    /**
     * Get plugins by category.
     */
    getPluginsByCategory(category: PluginCategory): PluginRegistration[];
    /**
     * Add an event listener.
     *
     * @param event - Event type to listen for.
     * @param listener - Event listener function.
     * @returns Unsubscribe function.
     */
    on(event: PluginManagerEvent | '*', listener: EventListener): () => void;
    /**
     * Remove all event listeners.
     */
    removeAllListeners(): void;
    private emit;
    private getOrCreateContext;
    private withTimeout;
    private processQueue;
}
export {};
//# sourceMappingURL=plugin-manager.d.ts.map