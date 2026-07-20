/**
 * Plugin Host
 *
 * The central orchestrator that integrates lifecycle management,
 * sandbox security, API provision, and marketplace features
 * into a unified plugin system.
 */

import type { OpenFactoryPluginManifest, PluginPermission } from './index';
import { PluginLifecycleManager, type PluginMetadata, type PluginRegistryEntry } from './lifecycle';
import { PluginSandbox, type SandboxPolicy } from './sandbox';
import { PluginEditorAPIImpl } from './api/editor-api';
import { PluginAIAPIImpl } from './api/ai-api';
import { PluginUIAPIImpl } from './api/ui-api';
import { PluginStorageAPIImpl } from './api/storage-api';
import { PluginNetworkAPIImpl } from './api/network-api';
import { PluginMarketplace, type MarketplacePlugin } from './marketplace';

// ─── Host Configuration ────────────────────────────────────────────

export interface PluginHostConfig {
  /** Maximum number of concurrent plugins */
  maxPlugins?: number;
  /** Default sandbox policy */
  defaultSandboxPolicy?: Partial<SandboxPolicy>;
  /** Plugin data directory */
  dataDir?: string;
}

// ─── Plugin Host ────────────────────────────────────────────

export class PluginHost {
  readonly lifecycle: PluginLifecycleManager;
  readonly sandbox: PluginSandbox;
  readonly marketplace: PluginMarketplace;
  readonly editorApi: PluginEditorAPIImpl;
  readonly aiApi: PluginAIAPIImpl;
  readonly uiApi: PluginUIAPIImpl;

  private storageApis = new Map<string, PluginStorageAPIImpl>();
  private config: Required<PluginHostConfig>;

  constructor(config: PluginHostConfig = {}) {
    this.config = {
      maxPlugins: config.maxPlugins ?? 50,
      defaultSandboxPolicy: config.defaultSandboxPolicy ?? {},
      dataDir: config.dataDir ?? './plugin-data',
    };

    this.lifecycle = new PluginLifecycleManager();
    this.sandbox = new PluginSandbox();
    this.marketplace = new PluginMarketplace();
    this.editorApi = new PluginEditorAPIImpl();
    this.aiApi = new PluginAIAPIImpl();
    this.uiApi = new PluginUIAPIImpl();

    // Wire up sandbox violation logging
    this.sandbox.onViolation((violation) => {
      console.warn(`[PluginSandbox] ${violation.type}: ${violation.message}`);
    });
  }

  /** Install and load a plugin from the marketplace */
  async installPlugin(pluginId: string): Promise<void> {
    // Install from marketplace
    this.marketplace.install(pluginId);

    // Load the plugin
    await this.loadPlugin(pluginId);
  }

  /** Load a plugin with full sandbox and API setup */
  async loadPlugin(
    pluginId: string,
    manifest?: OpenFactoryPluginManifest,
    metadata?: PluginMetadata,
  ): Promise<void> {
    const pluginCount = this.lifecycle.getLoadedPlugins().length;
    if (pluginCount >= this.config.maxPlugins) {
      throw new Error(`Maximum plugin limit reached (${this.config.maxPlugins})`);
    }

    // Use manifest from marketplace or provided
    const pluginManifest: OpenFactoryPluginManifest = manifest ?? {
      id: pluginId,
      name: pluginId,
      version: '1.0.0',
    };

    // Register sandbox policy
    const policy: SandboxPolicy = {
      permissions: pluginManifest.permissions ?? [],
      ...this.config.defaultSandboxPolicy,
    };
    this.sandbox.register(pluginId, policy);

    // Create storage API for this plugin
    const storageApi = new PluginStorageAPIImpl(pluginId);
    this.storageApis.set(pluginId, storageApi);

    // Register with lifecycle manager
    const entry: PluginRegistryEntry = {
      manifest: pluginManifest,
      module: {
        manifest: pluginManifest,
        hooks: {},
      },
      metadata: metadata ?? {},
    };
    this.lifecycle.register(entry);
    await this.lifecycle.load(pluginId);
    await this.lifecycle.enable(pluginId);
  }

  /** Unload and optionally uninstall a plugin */
  async unloadPlugin(pluginId: string, uninstall = false): Promise<void> {
    await this.lifecycle.disable(pluginId);
    await this.lifecycle.unload(pluginId);
    this.sandbox.unregister(pluginId);
    this.storageApis.delete(pluginId);

    if (uninstall) {
      this.marketplace.uninstall(pluginId);
    }
  }

  /** Get the API surface for a specific plugin */
  getPluginApi(pluginId: string) {
    const storageApi = this.storageApis.get(pluginId);
    if (!storageApi) throw new Error(`Plugin ${pluginId} is not loaded`);

    const networkApi = new PluginNetworkAPIImpl(
      (host) => this.sandbox.enforceHostAccess(pluginId, host),
      () => this.sandbox.enforceRateLimit(pluginId),
    );

    return {
      editor: this.sandbox.wrapApi(pluginId, this.editorApi as unknown as Record<string, (...args: unknown[]) => unknown>, 'read-project'),
      ai: this.sandbox.wrapApi(pluginId, this.aiApi as unknown as Record<string, (...args: unknown[]) => unknown>, 'read-project'),
      ui: this.sandbox.wrapApi(pluginId, this.uiApi as unknown as Record<string, (...args: unknown[]) => unknown>, 'menu-register'),
      storage: storageApi,
      network: networkApi,
    };
  }

  /** Get system status */
  getStatus() {
    return {
      loadedPlugins: this.lifecycle.getLoadedPlugins().length,
      enabledPlugins: this.lifecycle.getEnabledPlugins().length,
      installedMarketplacePlugins: this.marketplace.getInstalled().length,
      availableUpdates: this.marketplace.checkUpdates().length,
    };
  }
}
