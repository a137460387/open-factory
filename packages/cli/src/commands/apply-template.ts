/**
 * CLI `apply-template` command — apply a template to media files.
 */

import type { Command } from 'commander';
import { withCliOutput, createLogger } from '../core/output.js';

export function registerApplyTemplateCommand(program: Command): void {
  program
    .command('apply-template')
    .description('Apply a template to source media files and optionally render')
    .requiredOption('-t, --template <path>', 'Path to template file (.json)')
    .requiredOption('-m, --media <files...>', 'Source media files')
    .requiredOption('-o, --output <path>', 'Output project file path')
    .option('--render', 'Also render the result to video', false)
    .option('--render-output <path>', 'Render output video path (required if --render)')
    .option('--ffmpeg <path>', 'Path to ffmpeg binary', 'ffmpeg')
    .action(async (opts) => {
      await withCliOutput('apply-template', async () => {
        const logger = createLogger(program.opts().logLevel ?? 'info');

        logger.info(`Applying template ${opts.template} to ${opts.media.length} media files`);

        const { applyTemplate } = await import('@open-factory/editor-core/headless');

        const result = await applyTemplate({
          templatePath: opts.template,
          mediaFiles: opts.media,
          outputProjectPath: opts.output,
          render: opts.render,
          renderOutputPath: opts.renderOutput,
          onProgress: (progress) => {
            logger.info(`[${progress.phase}] ${progress.percent}%${progress.message ? ' - ' + progress.message : ''}`);
          },
        });

        if (!result.success) {
          throw new Error(result.error ?? 'Template application failed');
        }

        logger.info(`Project created: ${result.projectPath}`);
        if (result.renderResult) {
          logger.info(`Render ${result.renderResult.success ? 'succeeded' : 'failed'}: ${result.renderResult.outputPath}`);
        }

        return {
          data: {
            projectPath: result.projectPath,
            renderResult: result.renderResult,
          },
          warnings: result.warnings,
        };
      });
    });
}
