/**
 * CLI `render` command — render a project file to video.
 *
 * Supports stdin pipe input for project config:
 *   echo '{"projectPath":"./test.ofp","outputPath":"./out.mp4"}' | of render --stdin
 */

import type { Command } from 'commander';
import { withCliOutput, createLogger } from '../core/output.js';
import { hasStdinData, readStdinJson } from '../core/stdin.js';

export function registerRenderCommand(program: Command): void {
  program
    .command('render')
    .description('Render a project file to video using headless FFmpeg pipeline')
    .option('-i, --input <path>', 'Path to project file (.ofp/.json)')
    .option('-o, --output <path>', 'Output video file path')
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
    .option('--stdin', 'Read project config from stdin pipe', false)
    .action(async (opts) => {
      await withCliOutput('render', async () => {
        const logger = createLogger(program.opts().logLevel ?? 'info');

        let inputPath = opts.input;
        let outputPath = opts.output;

        // Handle stdin input
        if (opts.stdin && hasStdinData()) {
          const config = await readStdinJson<{
            projectPath?: string;
            outputPath?: string;
            format?: string;
            width?: number;
            height?: number;
            fps?: number;
          }>();
          inputPath = config.projectPath ?? inputPath;
          outputPath = config.outputPath ?? outputPath;
          if (config.format) opts.format = config.format;
          if (config.width) opts.width = String(config.width);
          if (config.height) opts.height = String(config.height);
          if (config.fps) opts.fps = String(config.fps);
        }

        if (!inputPath) throw new Error('No input file specified. Use -i <path> or pipe config with --stdin');
        if (!outputPath) throw new Error('No output file specified. Use -o <path> or pipe config with --stdin');

        logger.info(`Rendering ${inputPath} -> ${outputPath}`);

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
          projectPath: inputPath,
          outputPath,
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
