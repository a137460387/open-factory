import type { Result, PluginInfo } from './types.js';
import { ok, err } from './events.js';

/**
 * Plugin management API
 */
export class PluginsAPI {
  private plugins: Map<string, PluginInfo> = new Map();

  /**
   * Register a plugin
   */
  register(plugin: PluginInfo): Result<PluginInfo> {
    if (this.plugins.has(plugin.id)) {
      return err(new Error(`Plugin ${plugin.id} already registered`));
    }
    this.plugins.set(plugin.id, { ...plugin });
    return ok({ ...plugin });
  }

  /**
   * Unregister a plugin
   */
  unregister(pluginId: string): Result<void> {
    if (!this.plugins.has(pluginId)) {
      return err(new Error(`Plugin ${pluginId} not found`));
    }
    this.plugins.delete(pluginId);
    return ok(undefined);
  }

  /**
   * Enable a plugin
   */
  enable(pluginId: string): Result<PluginInfo> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      return err(new Error(`Plugin ${pluginId} not found`));
    }
    plugin.enabled = true;
    return ok({ ...plugin });
  }

  /**
   * Disable a plugin
   */
  disable(pluginId: string): Result<PluginInfo> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      return err(new Error(`Plugin ${pluginId} not found`));
    }
    plugin.enabled = false;
    return ok({ ...plugin });
  }

  /**
   * Get all plugins
   */
  getAll(): PluginInfo[] {
    return Array.from(this.plugins.values()).map((p) => ({ ...p }));
  }

  /**
   * Get enabled plugins
   */
  getEnabled(): PluginInfo[] {
    return this.getAll().filter((p) => p.enabled);
  }

  /**
   * Get plugin by ID
   */
  getById(pluginId: string): PluginInfo | null {
    const plugin = this.plugins.get(pluginId);
    return plugin ? { ...plugin } : null;
  }
}
