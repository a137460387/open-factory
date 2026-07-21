import type { Result, ExportConfig, ExportProgress } from './types.js';
import { EventEmitter, ok, err } from './events.js';

/**
 * Export operations API
 */
export class ExportAPI extends EventEmitter {
  private exporting = false;
  private progress: ExportProgress | null = null;

  /**
   * Start export
   */
  start(config: ExportConfig): Result<void> {
    if (this.exporting) {
      return err(new Error('Export already in progress'));
    }
    if (!config.outputPath) {
      return err(new Error('Output path is required'));
    }
    this.exporting = true;
    this.progress = {
      percent: 0,
      currentFrame: 0,
      totalFrames: 0,
      eta: 0,
    };
    this.emit('export:started', config);
    return ok(undefined);
  }

  /**
   * Update export progress
   */
  updateProgress(progress: ExportProgress): void {
    this.progress = { ...progress };
    this.emit('export:progress', progress);
  }

  /**
   * Complete export
   */
  complete(): void {
    this.exporting = false;
    this.progress = null;
    this.emit('export:completed', null);
  }

  /**
   * Fail export
   */
  fail(error: Error): void {
    this.exporting = false;
    this.progress = null;
    this.emit('export:error', error);
  }

  /**
   * Get current progress
   */
  getProgress(): ExportProgress | null {
    return this.progress ? { ...this.progress } : null;
  }

  /**
   * Check if export is in progress
   */
  isExporting(): boolean {
    return this.exporting;
  }
}
