/**
 * CLI `analyze` command — analyze video quality/semantics/compliance.
 */

import type { Command } from 'commander';
import { withCliOutput, createLogger, ExitCode, exitWith, createOutput } from '../core/output.js';

export function registerAnalyzeCommand(program: Command): void {
  program
    .command('analyze')
    .description('Analyze video content and output quality/semantic/compliance report')
    .requiredOption('-i, --input <path>', 'Path to video file')
    .option('-t, --type <type>', 'Analysis type: quality|semantic|compliance|full', 'quality')
    .option('-p, --platform <name>', 'Target platform for compliance check', 'youtube')
    .option('--fail-on-low-score <threshold>', 'Exit with code 2 if quality score is below threshold')
    .action(async (opts) => {
      const startTime = Date.now();
      const logger = createLogger(program.opts().logLevel ?? 'info');

      try {
        logger.info(`Analyzing ${opts.input} (type: ${opts.type})`);

        const { headlessAnalyze } = await import('@open-factory/editor-core/headless');

        const result = await headlessAnalyze({
          inputPath: opts.input,
          type: opts.type,
          format: 'json',
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
