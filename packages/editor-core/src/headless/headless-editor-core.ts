/**
 * Headless editor core — DOM-free abstraction over editor-core logic.
 *
 * Reuses the pure-logic layers (model, timeline, export pipeline) without
 * requiring a browser environment. Designed for CLI rendering, CI/CD
 * pipelines, and server-side processing.
 */

import type { Timeline, MediaAsset } from '../model';
import type { ProjectFile } from '../project/project-types';
import { getTimelinePlaybackDuration, getRenderableTracks } from '../timeline';
import { round } from '../time';

// ==================== Types ====================

export interface HeadlessExportSettings {
  width?: number;
  height?: number;
  fps?: number;
  videoBitrate?: string;
  audioBitrate?: string;
  format?: string;
}

export interface HeadlessConfig {
  /** Path to ffmpeg binary */
  ffmpegPath: string;
  /** Working directory for temp files */
  tempDir: string;
  /** Max concurrent render threads */
  concurrency: number;
  /** Log level */
  logLevel: 'silent' | 'error' | 'warn' | 'info' | 'debug';
  /** ONNX Runtime execution provider (node/cpu/cuda) */
  aiProvider: 'cpu' | 'cuda' | 'auto';
}

export interface HeadlessRenderRequest {
  /** Path to project file (.ofp) */
  projectPath: string;
  /** Output file path */
  outputPath: string;
  /** Export settings override */
  settings?: Partial<HeadlessExportSettings>;
  /** Render range in seconds [start, end] */
  range?: [number, number];
  /** Progress callback */
  onProgress?: (progress: HeadlessProgress) => void;
}

export interface HeadlessProgress {
  phase: 'loading' | 'analyzing' | 'rendering' | 'muxing' | 'done' | 'error';
  percent: number;
  frame?: number;
  totalFrames?: number;
  fps?: number;
  eta?: number;
  message?: string;
}

export interface HeadlessRenderResult {
  success: boolean;
  outputPath: string;
  duration: number;
  fileSize: number;
  warnings: string[];
  error?: string;
}

export interface HeadlessAnalyzeRequest {
  /** Path to video file */
  inputPath: string;
  /** Analysis type */
  type: 'quality' | 'semantic' | 'compliance' | 'full';
  /** Output format */
  format: 'json';
  /** Target platform for compliance checks */
  platform?: string;
  /** Progress callback */
  onProgress?: (progress: HeadlessProgress) => void;
}

export interface HeadlessAnalyzeResult {
  success: boolean;
  report: QualityReport | SemanticReport | ComplianceReport | FullReport;
  error?: string;
}

export interface QualityReport {
  type: 'quality';
  resolution: { width: number; height: number };
  frameRate: number;
  bitrate: number;
  codec: string;
  audioCodec: string;
  audioChannels: number;
  audioSampleRate: number;
  loudness: { integrated: number; truePeak: number; range: number };
  issues: QualityIssue[];
  score: number;
}

export interface QualityIssue {
  severity: 'critical' | 'warning' | 'info';
  code: string;
  message: string;
  timestamp?: number;
}

export interface SemanticReport {
  type: 'semantic';
  scenes: SceneInfo[];
  duration: number;
  summary: string;
}

export interface SceneInfo {
  index: number;
  startTime: number;
  endTime: number;
  keyframePath?: string;
  description?: string;
  tags: string[];
}

export interface ComplianceReport {
  type: 'compliance';
  platform: string;
  passed: boolean;
  checks: ComplianceCheck[];
}

export interface ComplianceCheck {
  name: string;
  passed: boolean;
  expected: string;
  actual: string;
}

export type FullReport = {
  type: 'full';
  quality: QualityReport;
  semantic: SemanticReport;
  compliance: ComplianceReport[];
};

// ==================== Default Config ====================

export const DEFAULT_HEADLESS_CONFIG: HeadlessConfig = {
  ffmpegPath: 'ffmpeg',
  tempDir: '/tmp/open-factory',
  concurrency: 4,
  logLevel: 'info',
  aiProvider: 'auto',
};

// ==================== HeadlessEditorCore ====================

export class HeadlessEditorCore {
  private readonly config: HeadlessConfig;

  constructor(config: Partial<HeadlessConfig> = {}) {
    this.config = { ...DEFAULT_HEADLESS_CONFIG, ...config };
  }

  getConfig(): Readonly<HeadlessConfig> {
    return { ...this.config };
  }

  /**
   * Load a project file from disk and return the parsed project.
   */
  async loadProject(projectPath: string): Promise<ProjectFile> {
    const fs = await import('node:fs/promises');
    const content = await fs.readFile(projectPath, 'utf-8');
    const parsed = JSON.parse(content) as ProjectFile;

    if (!this.isValidProjectFile(parsed)) {
      throw new Error(`Invalid project file: ${projectPath}`);
    }

    return parsed;
  }

  /**
   * Validate project file structure.
   */
  isValidProjectFile(data: unknown): data is ProjectFile {
    if (!data || typeof data !== 'object') return false;
    const obj = data as Record<string, unknown>;

    // V2 format
    if ('schemaVersion' in obj && obj.schemaVersion === 2) {
      const project = obj.project as Record<string, unknown>;
      return !!(project && typeof project === 'object' && 'timeline' in project);
    }

    // V1 format
    if ('version' in obj && obj.version === '0.1') {
      const project = obj.project as Record<string, unknown>;
      return !!(project && typeof project === 'object' && 'timeline' in project);
    }

    return false;
  }

  /**
   * Get renderable timeline duration in seconds.
   */
  getTimelineDuration(projectFile: ProjectFile): number {
    const timeline = this.extractTimeline(projectFile);
    return round(getTimelinePlaybackDuration(timeline), 3);
  }

  /**
   * Extract the primary timeline from a project file.
   */
  extractTimeline(projectFile: ProjectFile): Timeline {
    if ('schemaVersion' in projectFile && projectFile.schemaVersion === 2) {
      return projectFile.project.timeline;
    }
    return (projectFile as { project: { timeline: Timeline } }).project.timeline;
  }

  /**
   * Extract media assets from a project file.
   */
  extractAssets(projectFile: ProjectFile): MediaAsset[] {
    if ('schemaVersion' in projectFile && projectFile.schemaVersion === 2) {
      return projectFile.project.media;
    }
    return (projectFile as { assets: MediaAsset[] }).assets;
  }

  /**
   * Get the number of renderable tracks.
   */
  getRenderableTrackCount(projectFile: ProjectFile): number {
    const timeline = this.extractTimeline(projectFile);
    return getRenderableTracks(timeline).length;
  }

  /**
   * Build a simplified FFmpeg command set from a project file.
   * Returns input/output args that can be passed to the headless renderer.
   */
  async buildRenderArgs(
    projectFile: ProjectFile,
    outputPath: string,
    settings: Partial<HeadlessExportSettings> = {},
    range?: [number, number],
  ): Promise<string[]> {
    const timeline = this.extractTimeline(projectFile);
    const assets = this.extractAssets(projectFile);
    const duration = getTimelinePlaybackDuration(timeline);

    const width = settings.width ?? 1920;
    const height = settings.height ?? 1080;
    const fps = settings.fps ?? 30;
    const videoBitrate = settings.videoBitrate ?? '8M';
    const audioBitrate = settings.audioBitrate ?? '192k';

    const args: string[] = [];

    // Add input files from assets
    for (const asset of assets) {
      args.push('-i', asset.path);
    }

    // Video settings
    args.push('-c:v', 'libx264');
    args.push('-preset', 'medium');
    args.push('-b:v', videoBitrate);
    args.push('-r', String(fps));
    args.push('-s', `${width}x${height}`);

    // Audio settings
    args.push('-c:a', 'aac');
    args.push('-b:a', audioBitrate);
    args.push('-ar', '48000');

    // Range
    if (range) {
      args.push('-ss', String(range[0]));
      args.push('-t', String(range[1] - range[0]));
    }

    args.push(outputPath);
    return args;
  }

  /**
   * Check if ffmpeg is available and get its capabilities.
   */
  async checkFfmpeg(): Promise<{ available: boolean; version?: string; error?: string }> {
    const { execFile } = await import('node:child_process');
    return new Promise((resolve) => {
      execFile(this.config.ffmpegPath, ['-version'], (error, stdout) => {
        if (error) {
          resolve({ available: false, error: error.message });
          return;
        }
        const versionMatch = stdout.match(/ffmpeg version (\S+)/);
        resolve({
          available: true,
          version: versionMatch?.[1] ?? 'unknown',
        });
      });
    });
  }
}
