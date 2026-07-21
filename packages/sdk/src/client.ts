import type { Result, ProjectConfig, ExportConfig } from './types.js';
import { EventEmitter } from './events.js';
import { ProjectAPI } from './project.js';
import { TimelineAPI } from './timeline.js';
import { EffectsAPI } from './effects.js';
import { ExportAPI } from './export.js';
import { PluginsAPI } from './plugins.js';

/**
 * OpenFactory SDK client
 *
 * Provides a unified API for interacting with the Open Factory video editor engine.
 *
 * @example
 * ```typescript
 * const client = new OpenFactoryClient();
 * client.project.create({ name: 'My Video', width: 1920, height: 1080, fps: 30 });
 * client.timeline.addTrack('Main', 'video');
 * ```
 */
export class OpenFactoryClient extends EventEmitter {
  readonly project: ProjectAPI;
  readonly timeline: TimelineAPI;
  readonly effects: EffectsAPI;
  readonly export: ExportAPI;
  readonly plugins: PluginsAPI;

  constructor() {
    super();
    this.project = new ProjectAPI();
    this.timeline = new TimelineAPI();
    this.effects = new EffectsAPI();
    this.export = new ExportAPI();
    this.plugins = new PluginsAPI();

    // Forward events from sub-APIs
    this.project.on('project:loaded', (e) => this.emit('project:loaded', e.payload));
    this.project.on('project:saved', (e) => this.emit('project:saved', e.payload));
    this.timeline.on('timeline:changed', (e) => this.emit('timeline:changed', e.payload));
    this.effects.on('effect:applied', (e) => this.emit('effect:applied', e.payload));
    this.export.on('export:started', (e) => this.emit('export:started', e.payload));
    this.export.on('export:progress', (e) => this.emit('export:progress', e.payload));
    this.export.on('export:completed', (e) => this.emit('export:completed', e.payload));
    this.export.on('export:error', (e) => this.emit('export:error', e.payload));
  }

  /**
   * Quick setup: create project and add default tracks
   */
  quickSetup(
    name: string,
    options?: { width?: number; height?: number; fps?: number },
  ): Result<void> {
    const result = this.project.create({
      name,
      width: options?.width ?? 1920,
      height: options?.height ?? 1080,
      fps: options?.fps ?? 30,
    });
    if (!result.ok) return result;

    this.timeline.addTrack('Video 1', 'video');
    this.timeline.addTrack('Audio 1', 'audio');
    return { ok: true, value: undefined };
  }

  /**
   * Dispose the client and clean up resources
   */
  dispose(): void {
    this.project.removeAllListeners();
    this.timeline.removeAllListeners();
    this.effects.removeAllListeners();
    this.export.removeAllListeners();
    this.removeAllListeners();
  }
}
