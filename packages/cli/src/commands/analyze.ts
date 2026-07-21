/**
 * CLI `analyze` command — analyze video quality/semantics/compliance.
 *
 * Supports stdin pipe input:
 *   cat video.mp4 | of analyze --stdin -t quality
 *   echo '{"inputPath":"./video.mp4","type":"full"}' | of analyze --stdin
 */

import type { Command } from 'commander';
import { withCliOutput, createLogger, ExitCode, exitWith, createOutput } from '../core/output.js';
import { hasStdinData, stdinToTempFile, readStdinJson } from '../core/stdin.js';

export function registerAnalyzeCommand(program: Command): void {
  program
    .command('analyze')
    .description('Analyze video content and output quality/semantic/compliance report')
    .option('-i, --input <path>', 'Path to video file (or use --stdin)')
    .option('-t, --type <type>', 'Analysis type: quality|semantic|compliance|full', 'quality')
    .option('-p, --platform <name>', 'Target platform for compliance check', 'youtube')
    .option('--fail-on-low-score <threshold>', 'Exit with code 2 if quality score is below threshold')
    .option('--stdin', 'Read video or JSON config from stdin pipe', false)
    .option('--stdin-format <format>', 'stdin input format: json|binary', 'binary')
    .action(async (opts) => {
      const startTime = Date.now();
      const logger = createLogger(program.opts().logLevel ?? 'info');

      try {
        let inputPath = opts.input;
        let analysisType = opts.type;

        // Handle stdin input
        if (opts.stdin && hasStdinData()) {
          if (opts.stdinFormat === 'binary' || (!opts.input && !opts.stdinFormat)) {
            // Binary mode: save stdin to temp file
            logger.info('Reading video from stdin...');
            inputPath = await stdinToTempFile('mp4');
            logger.info(`Saved stdin to temp file: ${inputPath}`);
          } else {
            // JSON mode: parse config from stdin
            const config = await readStdinJson<{ inputPath?: string; type?: string; platform?: string }>();
            inputPath = config.inputPath ?? inputPath;
            analysisType = config.type ?? analysisType;
          }
        }

        if (!inputPath) {
          throw new Error('No input file specified. Use -i <path> or pipe input with --stdin');
        }

        logger.info(`Analyzing ${inputPath} (type: ${analysisType})`);

        const { headlessAnalyze } = await import('@open-factory/editor-core/headless');

        const result = await headlessAnalyze({
          inputPath,
          type: analysisType,
          format: 'json',
          platform: opts.platform,
          onProgress: (progress) => {
            logger.info(`[${progress.phase}] ${progress.percent}%${progress.message ? ' - ' + progress.message : ''}`);
          },
        });

        if (!result.success) {
          const output = createOutput('analyze', false, null, result.error ?? 'Analysis failed', [], startTime);
          exitWith(output, ExitCode.GENERAL_ERROR);
          return;
        }

        // Check quality score threshold
        if (opts.failOnLowScore && result.report.type === 'quality') {
          const threshold = Number(opts.failOnLowScore);
          if (result.report.score < threshold) {
            logger.warn(`Quality score ${result.report.score} is below threshold ${threshold}`);
            const output = createOutput('analyze', true, result.report, null, [`Quality score below threshold: ${result.report.score} < ${threshold}`], startTime);
            exitWith(output, ExitCode.QUALITY_FAILED);
            return;
          }
        }

        const output = createOutput('analyze', true, result.report, null, [], startTime);
        exitWith(output, ExitCode.SUCCESS);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const output = createOutput('analyze', false, null, message, [], startTime);
        exitWith(output, ExitCode.GENERAL_ERROR);
      }
    });
}
