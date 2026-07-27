/**
 * Plugin registry for registration and discovery.
 *
 * Manages the collection of registered plugins and provides
 * lookup, filtering, and categorization capabilities.
 * All operations are synchronous and side-effect-free.
 */
// --- Registry implementation ---
/**
 * Plugin registry for managing plugin registrations.
 *
 * This is a pure data structure with no side effects.
 * All operations return new objects rather than mutating state.
 */
export class PluginRegistry {
    entries = new Map();
    /**
     * Register a new plugin.
     *
     * @param manifest - Plugin manifest.
     * @param plugin - Plugin implementation.
     * @returns Registration entry.
     * @throws If a plugin with the same ID is already registered.
     */
    register(manifest, plugin) {
        if (this.entries.has(manifest.id)) {
            throw new Error(`Plugin '${manifest.id}' is already registered`);
        }
        validateManifest(manifest);
        const now = Date.now();
        const registration = {
            manifest: { ...manifest },
            plugin,
            status: 'registered',
            registeredAt: now,
            lastStatusChange: now,
        };
        this.entries.set(manifest.id, registration);
        return registration;
    }
    /**
     * Unregister a plugin.
     *
     * @param pluginId - Plugin ID to unregister.
     * @returns Whether the plugin was found and removed.
     */
    unregister(pluginId) {
        return this.entries.delete(pluginId);
    }
    /**
     * Get a plugin registration by ID.
     *
     * @param pluginId - Plugin ID.
     * @returns Registration entry, or undefined if not found.
     */
    get(pluginId) {
        const entry = this.entries.get(pluginId);
        return entry ? { ...entry } : undefined;
    }
    /**
     * Check if a plugin is registered.
     *
     * @param pluginId - Plugin ID.
     * @returns Whether the plugin is registered.
     */
    has(pluginId) {
        return this.entries.has(pluginId);
    }
    /**
     * Update a plugin's status.
     *
     * @param pluginId - Plugin ID.
     * @param status - New status.
     * @param error - Error if status is 'error'.
     * @returns Whether the update was successful.
     */
    updateStatus(pluginId, status, error) {
        const entry = this.entries.get(pluginId);
        if (!entry) {
            return false;
        }
        entry.status = status;
        entry.lastStatusChange = Date.now();
        if (error) {
            entry.error = error;
        }
        else if (status !== 'error') {
            entry.error = undefined;
        }
        return true;
    }
    /**
     * Query plugins with filters.
     *
     * @param query - Query options.
     * @returns Matching registrations.
     */
    query(query = {}) {
        let results = Array.from(this.entries.values());
        // Apply filters.
        if (query.category) {
            results = results.filter((r) => r.manifest.category === query.category);
        }
        if (query.status) {
            results = results.filter((r) => r.status === query.status);
        }
        if (query.permission) {
            results = results.filter((r) => r.manifest.permissions?.includes(query.permission));
        }
        if (query.search) {
            const searchLower = query.search.toLowerCase();
            results = results.filter((r) => r.manifest.id.toLowerCase().includes(searchLower) ||
                r.manifest.name.toLowerCase().includes(searchLower) ||
                (r.manifest.description?.toLowerCase().includes(searchLower) ?? false));
        }
        // Apply sorting.
        const sortBy = query.sortBy ?? 'name';
        const sortDir = query.sortDirection ?? 'asc';
        const multiplier = sortDir === 'asc' ? 1 : -1;
        results.sort((a, b) => {
            let cmp = 0;
            switch (sortBy) {
                case 'name':
                    cmp = a.manifest.name.localeCompare(b.manifest.name);
                    break;
                case 'version':
                    cmp = a.manifest.version.localeCompare(b.manifest.version);
                    break;
                case 'registeredAt':
                    cmp = a.registeredAt - b.registeredAt;
                    break;
                case 'category':
                    cmp = a.manifest.category.localeCompare(b.manifest.category);
                    break;
            }
            return cmp * multiplier;
        });
        return results;
    }
    /**
     * Get all registered plugin IDs.
     *
     * @returns Array of plugin IDs.
     */
    getIds() {
        return Array.from(this.entries.keys());
    }
    /**
     * Get all registrations.
     *
     * @returns Array of all registrations.
     */
    getAll() {
        return Array.from(this.entries.values());
    }
    /**
     * Get registry statistics.
     *
     * @returns Statistics about registered plugins.
     */
    getStats() {
        const all = this.getAll();
        const byCategory = {
            effect: 0,
            export: 0,
            workflow: 0,
            'ai-model': 0,
        };
        const byStatus = {
            registered: 0,
            loading: 0,
            loaded: 0,
            active: 0,
            error: 0,
            unloaded: 0,
        };
        for (const reg of all) {
            byCategory[reg.manifest.category]++;
            byStatus[reg.status]++;
        }
        return {
            total: all.length,
            byCategory,
            byStatus,
        };
    }
    /**
     * Get the number of registered plugins.
     */
    get size() {
        return this.entries.size;
    }
    /**
     * Clear all registrations.
     */
    clear() {
        this.entries.clear();
    }
}
// --- Validation ---
/** Validate a plugin manifest. */
function validateManifest(manifest) {
    if (!manifest.id || typeof manifest.id !== 'string') {
        throw new Error('Plugin manifest must have a valid id');
    }
    if (!manifest.name || typeof manifest.name !== 'string') {
        throw new Error('Plugin manifest must have a valid name');
    }
    if (!manifest.version || typeof manifest.version !== 'string') {
        throw new Error('Plugin manifest must have a valid version');
    }
    if (!isValidCategory(manifest.category)) {
        throw new Error(`Invalid plugin category: ${manifest.category}`);
    }
    if (!isValidSemver(manifest.version)) {
        throw new Error(`Invalid semver version: ${manifest.version}`);
    }
}
function isValidCategory(value) {
    return value === 'effect' || value === 'export' || value === 'workflow' || value === 'ai-model';
}
function isValidSemver(version) {
    return /^\d+\.\d+\.\d+(-[\w.]+)?(\+[\w.]+)?$/.test(version);
}
//# sourceMappingURL=plugin-registry.js.map