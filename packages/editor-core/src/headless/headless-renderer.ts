/**
 * Headless FFmpeg renderer — direct synthesis without preview window.
 *
 * Builds FFmpeg commands from project data and executes them in a
 * child process, reporting progress via callbacks.
 */

import type { HeadlessConfig, HeadlessProgress, HeadlessRenderRequest, HeadlessRenderResult } from './headless-editor-core';
import { HeadlessEditorCore } from './headless-editor-core';

export interface FfmpegRenderOptions {
  config: HeadlessConfig;
  args: string[];
  outputPath: string;
  duration: number;
  onProgress?: (progress: HeadlessProgress) => void;
}

/** Delay before force-killing the FFmpeg child process after abort. */
export const FFMPEG_ABORT_KILL_DELAY_MS = 3000;

/**
 * Wire an AbortSignal to terminate an FFmpeg child process.
 *
 * Sends SIGTERM first (graceful), then force-kills with SIGKILL after
 * FFMPEG_ABORT_KILL_DELAY_MS if the process has not exited. Returns a cleanup
 * function that removes the abort listener and clears the forced-kill timer;
 * call it once the child process has exited so no timer or listener leaks.
 */
export function terminateFfmpegChildProcess(
  proc: { kill: (signal?: NodeJS.Signals | number) => boolean },
  signal: AbortSignal,
): () => void {
  let forceKillTimer: ReturnType<typeof setTimeout> | undefined;
  const onAbort = () => {
    if (!proc.kill('SIGTERM')) {
      return;
    }
    forceKillTimer = setTimeout(() => {
      if (signal.aborted) {
        proc.kill('SIGKILL');
      }
    }, FFMPEG_ABORT_KILL_DELAY_MS);
  };
  if (signal.aborted) {
    onAbort();
  } else {
    signal.addEventListener('abort', onAbort, { once: true });
  }
  return () => {
    signal.removeEventListener('abort', onAbort);
    if (forceKillTimer) {
      clearTimeout(forceKillTimer);
    }
  };
}

/**
 * Parse FFmpeg stderr output for progress information.
 */
export function parseFfmpegProgress(
  line: string,
  totalDuration: number,
): Partial<HeadlessProgress> | null {
  // Match frame=  123 fps= 30 ...
  const frameMatch = line.match(/frame=\s*(\d+)/);
  const fpsMatch = line.match(/fps=\s*([\d.]+)/);
  const timeMatch = line.match(/time=(\d{2}):(\d{2}):(\d{2}\.\d{2})/);

  if (!timeMatch) return null;

  const hours = Number(timeMatch[1]);
  const minutes = Number(timeMatch[2]);
  const seconds = Number(timeMatch[3]);
  const currentTime = hours * 3600 + minutes * 60 + seconds;
  const percent = totalDuration > 0 ? Math.min((currentTime / totalDuration) * 100, 100) : 0;

  const result: Partial<HeadlessProgress> = {
    phase: 'rendering',
    percent: Math.round(percent * 10) / 10,
  };

  if (frameMatch) {
    result.frame = Number(frameMatch[1]);
  }
  if (fpsMatch) {
    result.fps = Number(fpsMatch[1]);
  }

  if (totalDuration > 0 && currentTime > 0) {
    const remaining = totalDuration - currentTime;
    if (result.fps && result.fps > 0) {
      result.eta = Math.round(remaining);
    }
  }

  return result;
}

/**
 * Execute FFmpeg render in a child process.
 */
export async function executeFfmpegRender(
  options: FfmpegRenderOptions,
  signal?: AbortSignal,
): Promise<HeadlessRenderResult> {
  const { spawn } = await import('node:child_process');
  const { stat } = await import('node:fs/promises');
  const startTime = Date.now();

  return new Promise<HeadlessRenderResult>((resolve) => {
    const args = [...options.args, '-y'];
    const proc = spawn(options.config.ffmpegPath, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stderrBuffer = '';
    const warnings: string[] = [];
    const cleanupAbort = signal ? terminateFfmpegChildProcess(proc, signal) : undefined;

    proc.stderr.on('data', (chunk: Buffer) => {
      stderrBuffer += chunk.toString();
      const lines = stderrBuffer.split('\r');
      stderrBuffer = lines.pop() ?? '';

      for (const line of lines) {
        const progress = parseFfmpegProgress(line.trim(), options.duration);
        if (progress) {
          options.onProgress?.({
            phase: 'rendering',
            percent: progress.percent ?? 0,
            frame: progress.frame,
            fps: progress.fps,
            eta: progress.eta,
          });
        }
      }
    });

    proc.on('close', async (code) => {
      cleanupAbort?.();
      const duration = (Date.now() - startTime) / 1000;

      if (signal?.aborted) {
        resolve({
          success: false,
          outputPath: '',
          duration,
          fileSize: 0,
          warnings,
          error: 'FFmpeg render aborted',
        });
        return;
      }

      if (code !== 0) {
        resolve({
          success: false,
          outputPath: '',
          duration,
          fileSize: 0,
          warnings,
          error: `FFmpeg exited with code ${code}: ${stderrBuffer.slice(-500)}`,
        });
        return;
      }

      // Use explicit output path instead of fragile arg extraction
      const outputPath = options.outputPath;
      let fileSize = 0;
      try {
        const stats = await stat(outputPath);
        fileSize = stats.size;
      } catch {
        warnings.push('Could not stat output file');
      }

      options.onProgress?.({
        phase: 'done',
        percent: 100,
        message: 'Render complete',
      });

      resolve({
        success: true,
        outputPath,
        duration,
        fileSize,
        warnings,
      });
    });

    proc.on('error', (err) => {
      cleanupAbort?.();
      resolve({
        success: false,
        outputPath: '',
        duration: (Date.now() - startTime) / 1000,
        fileSize: 0,
        warnings,
        error: `Failed to start FFmpeg: ${err.message}`,
      });
    });
  });
}

/**
 * Render a project file to video using headless FFmpeg pipeline.
 */
export async function headlessRender(
  request: HeadlessRenderRequest,
  config: Partial<HeadlessConfig> = {},
  signal?: AbortSignal,
): Promise<HeadlessRenderResult> {
  const core = new HeadlessEditorCore(config);
  const effectiveConfig = core.getConfig();

  request.onProgress?.({ phase: 'loading', percent: 0, message: 'Loading project' });

  // Check ffmpeg availability
  const ffmpegCheck = await core.checkFfmpeg();
  if (!ffmpegCheck.available) {
    return {
      success: false,
      outputPath: '',
      duration: 0,
      fileSize: 0,
      warnings: [],
      error: `FFmpeg not found: ${ffmpegCheck.error}`,
    };
  }

  // Load project
  let projectFile;
  try {
    projectFile = await core.loadProject(request.projectPath);
  } catch (err) {
    return {
      success: false,
      outputPath: '',
      duration: 0,
      fileSize: 0,
      warnings: [],
      error: `Failed to load project: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  request.onProgress?.({ phase: 'analyzing', percent: 20, message: 'Building render args' });

  // Build FFmpeg args
  let args: string[];
  try {
    args = await core.buildRenderArgs(projectFile, request.outputPath, request.settings ?? {}, request.range);
  } catch (err) {
    return {
      success: false,
      outputPath: '',
      duration: 0,
      fileSize: 0,
      warnings: [],
      error: `Failed to build render args: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  const duration = core.getTimelineDuration(projectFile);

  request.onProgress?.({ phase: 'rendering', percent: 30, message: 'Starting FFmpeg render' });

  return executeFfmpegRender({
    config: effectiveConfig,
    args,
    outputPath: request.outputPath,
    duration,
    onProgress: request.onProgress,
  }, signal);
}
