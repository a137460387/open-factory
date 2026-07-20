/**
 * Plugin Lifecycle Manager
 *
 * Manages plugin loading, unloading, enabling, disabling, and updating.
 * Ensures proper initialization order and dependency resolution.
 */

import type {
  OpenFactoryPlugin,
  OpenFactoryPluginManifest,
  OpenFactoryPluginModule,
  PluginHooks,
  PluginPermission,
} from './index';

// ─── Plugin States ────────────────────────────────────────────

export type PluginState =
  | 'registered'
  | 'loading'
  | 'loaded'
  | 'enabled'
  | 'disabled'
  | 'error'
  | 'unloading'
  | 'unloaded';

export interface PluginInstance {
  id: string;
  manifest: OpenFactoryPluginManifest;
  state: PluginState;
  hooks: PluginHooks;
  loadedAt: number;
  enabledAt?: number;
  error?: string;
  metadata: PluginMetadata;
}

export interface PluginMetadata {
  author?: string;
  homepage?: string;
  repository?: string;
  license?: string;
  keywords?: string[];
  minAppVersion?: string;
  dependencies?: string[];
}

export interface PluginRegistryEntry {
  manifest: OpenFactoryPluginManifest;
  module: OpenFactoryPluginModule;
  metadata: PluginMetadata;
}

// ─── Lifecycle Events ────────────────────────────────────────────

export type PluginLifecycleEvent =
  | 'registered'
  | 'loading'
  | 'loaded'
  | 'enabled'
  | 'disabled'
  | 'error'
  | 'unloaded'
  | 'updated';

export interface PluginLifecycleEventData {
  pluginId: string;
  event: PluginLifecycleEvent;
  timestamp: number;
  error?: string;
  previousVersion?: string;
}

export type PluginLifecycleListener = (data: PluginLifecycleEventData) => void;

// ─── Plugin Lifecycle Manager ────────────────────────────────────────────

export class PluginLifecycleManager {
  private plugins = new Map<string, PluginInstance>();
  private registry = new Map<string, PluginRegistryEntry>();
  private listeners: PluginLifecycleListener[] = [];
  private loadOrder: string[] = [];

  /** Register a plugin module without loading it */
  register(entry: PluginRegistryEntry): void {
    const { manifest } = entry;
    if (this.registry.has(manifest.id)) {
      throw new Error(`Plugin ${manifest.id} is already registered`);
    }
    this.registry.set(manifest.id, entry);
    this.emit(manifest.id, 'registered');
  }

  /** Load a registered plugin: resolve dependencies, instantiate, call onLoad */
  async load(pluginId: string): Promise<void> {
    const entry = this.registry.get(pluginId);
    if (!entry) throw new Error(`Plugin ${pluginId} is not registered`);

    const instance = this.plugins.get(pluginId);
    if (instance && instance.state !== 'unloaded' && instance.state !== 'error') {
      throw new Error(`Plugin ${pluginId} is already loaded (state: ${instance.state})`);
    }

    // Check dependencies
    await this.resolveDependencies(entry.manifest);

    this.setPluginState(pluginId, 'loading');

    try {
      const plugin = this.instantiatePlugin(entry);
      this.plugins.set(pluginId, plugin);
      this.loadOrder.push(pluginId);
      this.setPluginState(pluginId, 'loaded');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.setPluginState(pluginId, 'error', message);
      throw new Error(`Failed to load plugin ${pluginId}: ${message}`);
    }
  }

  /** Enable a loaded plugin: activate hooks */
  async enable(pluginId: string): Promise<void> {
    const plugin = this.getPlugin(pluginId);
    if (plugin.state !== 'loaded' && plugin.state !== 'disabled') {
      throw new Error(`Plugin ${pluginId} cannot be enabled (state: ${plugin.state})`);
    }

    plugin.state = 'enabled';
    plugin.enabledAt = Date.now();
    this.emit(pluginId, 'enabled');
  }

  /** Disable an enabled plugin: deactivate hooks without unloading */
  async disable(pluginId: string): Promise<void> {
    const plugin = this.getPlugin(pluginId);
    if (plugin.state !== 'enabled') {
      throw new Error(`Plugin ${pluginId} is not enabled (state: ${plugin.state})`);
    }

    plugin.state = 'disabled';
    plugin.enabledAt = undefined;
    this.emit(pluginId, 'disabled');
  }

  /** Unload a plugin: cleanup, remove from memory */
  async unload(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) return;

    this.setPluginState(pluginId, 'unloading');

    try {
      // Clean up hooks
      plugin.hooks = {};
      this.plugins.delete(pluginId);
      this.loadOrder = this.loadOrder.filter((id) => id !== pluginId);
      this.setPluginState(pluginId, 'unloaded');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.setPluginState(pluginId, 'error', message);
      throw err;
    }
  }

  /** Update a plugin to a new version */
  async update(pluginId: string, newEntry: PluginRegistryEntry): Promise<void> {
    const oldPlugin = this.plugins.get(pluginId);
    const previousVersion = oldPlugin?.manifest.version;

    if (oldPlugin) {
      await this.unload(pluginId);
    }

    this.registry.set(pluginId, newEntry);
    await this.load(pluginId);
    this.emit(pluginId, 'updated', undefined, previousVersion);
  }

  /** Get a loaded plugin instance */
  getPlugin(pluginId: string): PluginInstance {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) throw new Error(`Plugin ${pluginId} is not loaded`);
    return plugin;
  }

  /** Get all loaded plugins */
  getLoadedPlugins(): PluginInstance[] {
    return Array.from(this.plugins.values());
  }

  /** Get plugins in a specific state */
  getPluginsByState(state: PluginState): PluginInstance[] {
    return Array.from(this.plugins.values()).filter((p) => p.state === state);
  }

  /** Get all enabled plugins (ready to receive hooks) */
  getEnabledPlugins(): PluginInstance[] {
    return this.getPluginsByState('enabled');
  }

  /** Get the load order */
  getLoadOrder(): string[] {
    return [...this.loadOrder];
  }

  /** Check if a plugin is registered */
  isRegistered(pluginId: string): boolean {
    return this.registry.has(pluginId);
  }

  /** Check if a plugin is loaded */
  isLoaded(pluginId: string): boolean {
    return this.plugins.has(pluginId);
  }

  /** Subscribe to lifecycle events */
  on(listener: PluginLifecycleListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  /** Resolve plugin dependencies */
  private async resolveDependencies(manifest: OpenFactoryPluginManifest): Promise<void> {
    const deps = manifest.permissions ?? [];
    // Permissions are not hard dependencies, just capability declarations
    // But we validate they are known
    const knownPermissions: PluginPermission[] = [
      'read-project',
      'write-project',
      'export-hook',
      'menu-register',
    ];
    for (const perm of deps) {
      if (!knownPermissions.includes(perm)) {
        throw new Error(`Unknown permission: ${perm}`);
      }
    }
  }

  /** Instantiate a plugin from registry entry */
  private instantiatePlugin(entry: PluginRegistryEntry): PluginInstance {
    const { manifest, module, metadata } = entry;

    let hooks: PluginHooks = {};
    if ('hooks' in module && module.hooks) {
      hooks = module.hooks;
    } else if ('id' in module) {
      // OpenFactoryPlugin directly
      const plugin = module as OpenFactoryPlugin;
      hooks = plugin.hooks ?? {};
    }

    return {
      id: manifest.id,
      manifest,
      state: 'registered',
      hooks,
      loadedAt: Date.now(),
      metadata,
    };
  }

  /** Set plugin state and emit event */
  private setPluginState(pluginId: string, state: PluginState, error?: string): void {
    const plugin = this.plugins.get(pluginId);
    if (plugin) {
      plugin.state = state;
      if (error) plugin.error = error;
    }
    this.emit(pluginId, state === 'error' ? 'error' : (state as PluginLifecycleEvent), error);
  }

  /** Emit a lifecycle event */
  private emit(
    pluginId: string,
    event: PluginLifecycleEvent,
    error?: string,
    previousVersion?: string,
  ): void {
    const data: PluginLifecycleEventData = {
      pluginId,
      event,
      timestamp: Date.now(),
      error,
      previousVersion,
    };
    for (const listener of this.listeners) {
      listener(data);
    }
  }
}
