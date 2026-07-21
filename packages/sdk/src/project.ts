import type { Result, ProjectConfig } from './types.js';
import { EventEmitter, ok, err } from './events.js';

/**
 * Project management API
 */
export class ProjectAPI extends EventEmitter {
  private config: ProjectConfig | null = null;
  private dirty = false;

  /**
   * Create a new project
   */
  create(config: ProjectConfig): Result<ProjectConfig> {
    if (!config.name || config.name.trim().length === 0) {
      return err(new Error('Project name is required'));
    }
    if (config.width <= 0 || config.height <= 0) {
      return err(new Error('Invalid resolution'));
    }
    if (config.fps <= 0) {
      return err(new Error('Invalid FPS'));
    }
    this.config = { ...config };
    this.dirty = false;
    this.emit('project:loaded', this.config);
    return ok(this.config);
  }

  /**
   * Get current project config
   */
  getConfig(): ProjectConfig | null {
    return this.config ? { ...this.config } : null;
  }

  /**
   * Update project config
   */
  update(updates: Partial<ProjectConfig>): Result<ProjectConfig> {
    if (!this.config) {
      return err(new Error('No project loaded'));
    }
    this.config = { ...this.config, ...updates };
    this.dirty = true;
    return ok(this.config);
  }

  /**
   * Save project
   */
  save(): Result<void> {
    if (!this.config) {
      return err(new Error('No project loaded'));
    }
    this.dirty = false;
    this.emit('project:saved', this.config);
    return ok(undefined);
  }

  /**
   * Check if project has unsaved changes
   */
  isDirty(): boolean {
    return this.dirty;
  }
}
