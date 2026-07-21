/**
 * CLI `render` command — render a project file to video.
 */

import type { Command } from 'commander';
import { withCliOutput, createLogger } from '../core/output.js';

export function registerRenderCommand(program: Command): void {
  program
    .command('render')
    .description('Render a project file to video using headless FFmpeg pipeline')
    .requiredOption('-i, --input <path>', 'Path to project file (.ofp/.json)')
    .requiredOption('-o, --output <path>', 'Output video file path')
    .option('-f, --format <format>', 'Output format (mp4|webm|mov)', 'mp4')
    .option('--width <pixels>', 'Output width', '1920')
    .option('--height <pixels>', 'Output height', '1080')
    .option('--fps <rate>', 'Frame rate', '30')
    .option('--bitrate <rate>', 'Video bitrate (e.g. 8M)', '8M')
    .option('--audio-bitrate <rate>', 'Audio bitrate (e.g. 192k)', '192k')
    .option('--range <start-end>', 'Render range in seconds (e.g. 10-30)')
    .option('--ffmpeg <path>', 'Path to ffmpeg binary', 'ffmpeg')
    .option('--temp-dir <path>', 'Temp directory for intermediate files')
    .option('--concurrency <n>', 'Max concurrent render threads', '4')
    .action(async (opts) => {
      await withCliOutput('render', async () => {
        const logger = createLogger(program.opts().logLevel ?? 'info');

        logger.info(`Rendering ${opts.input} -> ${opts.output}`);

        // Dynamic import to avoid loading headless module when not needed
        const { HeadlessEditorCore } = await import('@open-factory/editor-core/headless');
        const { headlessRender } = await import('@open-factory/editor-core/headless');

        // Parse range
        let range: [number, number] | undefined;
        if (opts.range) {
          const parts = opts.range.split('-').map(Number);
          if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
            range = [parts[0], parts[1]];
          }
        }

        const result = await headlessRender({
          projectPath: opts.input,
          outputPath: opts.output,
          settings: {
            format: opts.format,
            width: Number(opts.width),
            height: Number(opts.height),
            fps: Number(opts.fps),
            videoBitrate: opts.bitrate,
            audioBitrate: opts.audioBitrate,
          },
          range,
          onProgress: (progress) => {
            logger.info(`[${progress.phase}] ${progress.percent}%${progress.message ? ' - ' + progress.message : ''}`);
          },
        }, {
          ffmpegPath: opts.ffmpeg,
          tempDir: opts.tempDir ?? '/tmp/open-factory',
          concurrency: Number(opts.concurrency),
          logLevel: program.opts().logLevel ?? 'info',
          aiProvider: 'auto',
        });

        if (!result.success) {
          throw new Error(result.error ?? 'Render failed');
        }

        logger.info(`Render complete: ${result.outputPath} (${result.fileSize} bytes, ${result.duration.toFixed(1)}s)`);

        return {
          data: {
            outputPath: result.outputPath,
            fileSize: result.fileSize,
            duration: result.duration,
          },
          warnings: result.warnings,
        };
      });
    });
}
