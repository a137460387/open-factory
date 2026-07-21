// Plugin Registry
// Manages plugin metadata: registration, lookup, listing, and state tracking.

import type {
  PluginRegistryEntry,
  PluginManifest,
  PluginStats,
  PluginRatingSummary,
  PluginCategory,
  PluginMarketEvent,
} from './types.js';

/** In-memory plugin registry with event-driven state management. */
export class PluginRegistry {
  private readonly entries = new Map<string, PluginRegistryEntry>();
  private readonly listeners: Array<(event: PluginMarketEvent) => void> = [];

  /** Register a listener for marketplace events. */
  onEvent(listener: (event: PluginMarketEvent) => void): () => void {
    this.listeners.push(listener);
    return () => {
      const idx = this.listeners.indexOf(listener);
      if (idx >= 0) this.listeners.splice(idx, 1);
    };
  }

  private emit(event: PluginMarketEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }

  /** Register or update a plugin in the registry. */
  register(manifest: PluginManifest): PluginRegistryEntry {
    const now = new Date().toISOString();
    const existing = this.entries.get(manifest.id);

    const stats: PluginStats = existing?.stats ?? {
      pluginId: manifest.id,
      downloads: 0,
      weeklyDownloads: 0,
      monthlyDownloads: 0,
      activeInstalls: 0,
      lastDownloadAt: now,
    };

    const rating: PluginRatingSummary = existing?.rating ?? {
      pluginId: manifest.id,
      averageRating: 0,
      totalReviews: 0,
      distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
    };

    const entry: PluginRegistryEntry = {
      manifest,
      stats,
      rating,
      publishedAt: existing?.publishedAt ?? now,
      updatedAt: now,
      verified: existing?.verified ?? false,
      deprecated: false,
    };

    this.entries.set(manifest.id, entry);
    return entry;
  }

  /** Unregister a plugin from the registry. */
  unregister(pluginId: string): boolean {
    const existed = this.entries.delete(pluginId);
    if (existed) {
      this.emit({ type: 'plugin:uninstalled', pluginId });
    }
    return existed;
  }

  /** Get a single plugin by ID. */
  get(pluginId: string): PluginRegistryEntry | undefined {
    return this.entries.get(pluginId);
  }

  /** List all registered plugins. */
  listAll(): readonly PluginRegistryEntry[] {
    return [...this.entries.values()];
  }

  /** List plugins filtered by category. */
  listByCategory(category: PluginCategory): readonly PluginRegistryEntry[] {
    return this.listAll().filter((e) => e.manifest.category === category);
  }

  /** List only verified plugins. */
  listVerified(): readonly PluginRegistryEntry[] {
    return this.listAll().filter((e) => e.verified);
  }

  /** List only deprecated plugins. */
  listDeprecated(): readonly PluginRegistryEntry[] {
    return this.listAll().filter((e) => e.deprecated);
  }

  /** Mark a plugin as verified. */
  verify(pluginId: string): boolean {
    const entry = this.entries.get(pluginId);
    if (!entry) return false;
    this.entries.set(pluginId, { ...entry, verified: true });
    return true;
  }

  /** Mark a plugin as deprecated. */
  deprecate(pluginId: string, message?: string): boolean {
    const entry = this.entries.get(pluginId);
    if (!entry) return false;
    this.entries.set(pluginId, { ...entry, deprecated: true, deprecationMessage: message });
    return true;
  }

  /** Increment download count for a plugin. */
  recordDownload(pluginId: string): boolean {
    const entry = this.entries.get(pluginId);
    if (!entry) return false;
    const now = new Date().toISOString();
    const updatedStats: PluginStats = {
      ...entry.stats,
      downloads: entry.stats.downloads + 1,
      weeklyDownloads: entry.stats.weeklyDownloads + 1,
      monthlyDownloads: entry.stats.monthlyDownloads + 1,
      lastDownloadAt: now,
    };
    this.entries.set(pluginId, { ...entry, stats: updatedStats });
    this.emit({ type: 'plugin:installed', pluginId, version: entry.manifest.version });
    return true;
  }

  /** Update rating summary after a new review. */
  updateRating(pluginId: string, newRating: 1 | 2 | 3 | 4 | 5): boolean {
    const entry = this.entries.get(pluginId);
    if (!entry) return false;

    const oldDist = entry.rating.distribution;
    const newDist = { ...oldDist, [newRating]: oldDist[newRating] + 1 } as Record<1 | 2 | 3 | 4 | 5, number>;
    const totalReviews = entry.rating.totalReviews + 1;
    const totalScore =
      entry.rating.averageRating * entry.rating.totalReviews + newRating;
    const averageRating = totalScore / totalReviews;

    const updatedRating: PluginRatingSummary = {
      pluginId,
      averageRating: Math.round(averageRating * 10) / 10,
      totalReviews,
      distribution: newDist,
    };

    this.entries.set(pluginId, { ...entry, rating: updatedRating });
    return true;
  }

  /** Get total count of registered plugins. */
  get size(): number {
    return this.entries.size;
  }

  /** Check if a plugin is registered. */
  has(pluginId: string): boolean {
    return this.entries.has(pluginId);
  }

  /** Clear all entries (useful for testing). */
  clear(): void {
    this.entries.clear();
  }
}
