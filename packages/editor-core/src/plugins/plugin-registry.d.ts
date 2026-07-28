/**
 * Plugin registry for registration and discovery.
 *
 * Manages the collection of registered plugins and provides
 * lookup, filtering, and categorization capabilities.
 * All operations are synchronous and side-effect-free.
 */
import type { AnyPlugin, PluginCategory, PluginManifest, PluginRegistration, PluginStatus } from './plugin-types';
/** Registry query options. */
export interface PluginQuery {
    /** Filter by category. */
    category?: PluginCategory;
    /** Filter by status. */
    status?: PluginStatus;
    /** Filter by permission. */
    permission?: string;
    /** Search query (matches name, description, id). */
    search?: string;
    /** Sort field. */
    sortBy?: 'name' | 'version' | 'registeredAt' | 'category';
    /** Sort direction. */
    sortDirection?: 'asc' | 'desc';
}
/** Registry statistics. */
export interface PluginRegistryStats {
    /** Total registered plugins. */
    total: number;
    /** Plugins by category. */
    byCategory: Record<PluginCategory, number>;
    /** Plugins by status. */
    byStatus: Record<PluginStatus, number>;
}
/**
 * Plugin registry for managing plugin registrations.
 *
 * This is a pure data structure with no side effects.
 * All operations return new objects rather than mutating state.
 */
export declare class PluginRegistry {
    private readonly entries;
    /**
     * Register a new plugin.
     *
     * @param manifest - Plugin manifest.
     * @param plugin - Plugin implementation.
     * @returns Registration entry.
     * @throws If a plugin with the same ID is already registered.
     */
    register(manifest: PluginManifest, plugin: AnyPlugin): PluginRegistration;
    /**
     * Unregister a plugin.
     *
     * @param pluginId - Plugin ID to unregister.
     * @returns Whether the plugin was found and removed.
     */
    unregister(pluginId: string): boolean;
    /**
     * Get a plugin registration by ID.
     *
     * @param pluginId - Plugin ID.
     * @returns Registration entry, or undefined if not found.
     */
    get(pluginId: string): PluginRegistration | undefined;
    /**
     * Check if a plugin is registered.
     *
     * @param pluginId - Plugin ID.
     * @returns Whether the plugin is registered.
     */
    has(pluginId: string): boolean;
    /**
     * Update a plugin's status.
     *
     * @param pluginId - Plugin ID.
     * @param status - New status.
     * @param error - Error if status is 'error'.
     * @returns Whether the update was successful.
     */
    updateStatus(pluginId: string, status: PluginStatus, error?: Error): boolean;
    /**
     * Query plugins with filters.
     *
     * @param query - Query options.
     * @returns Matching registrations.
     */
    query(query?: PluginQuery): PluginRegistration[];
    /**
     * Get all registered plugin IDs.
     *
     * @returns Array of plugin IDs.
     */
    getIds(): string[];
    /**
     * Get all registrations.
     *
     * @returns Array of all registrations.
     */
    getAll(): PluginRegistration[];
    /**
     * Get registry statistics.
     *
     * @returns Statistics about registered plugins.
     */
    getStats(): PluginRegistryStats;
    /**
     * Get the number of registered plugins.
     */
    get size(): number;
    /**
     * Clear all registrations.
     */
    clear(): void;
}
//# sourceMappingURL=plugin-registry.d.ts.map