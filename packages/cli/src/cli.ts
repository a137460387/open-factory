/**
 * CLI entry point — commander-based CLI framework for Open Factory.
 *
 * Commands:
 *   render       Render a project file to video
 *   apply-template  Apply a template to media files
 *   analyze      Analyze video quality/semantics/compliance
 *   workflow     Run a workflow definition file
 */

import { Command } from 'commander';
import { createLogger } from './core/output.js';
import { registerRenderCommand } from './commands/render.js';
import { registerApplyTemplateCommand } from './commands/apply-template.js';
import { registerAnalyzeCommand } from './commands/analyze.js';
import { registerWorkflowCommand } from './commands/workflow.js';

const VERSION = '0.1.0';

export function createCli(): Command {
  const program = new Command();

  program
    .name('of')
    .description('Open Factory CLI — headless video editor engine')
    .version(VERSION);

  // Global options
  program
    .option('--log-level <level>', 'Log level: silent|error|warn|info|debug', 'info')
    .option('--json', 'Output as JSON (always true for structured output)', false);

  // Register commands
  registerRenderCommand(program);
  registerApplyTemplateCommand(program);
  registerAnalyzeCommand(program);
  registerWorkflowCommand(program);

  return program;
}

// Auto-execute when run directly
const isDirectRun =
  typeof process !== 'undefined' &&
  process.argv[1] &&
  (process.argv[1].endsWith('/cli.js') ||
    process.argv[1].endsWith('\\cli.js') ||
    process.argv[1].endsWith('/cli.ts') ||
    process.argv[1].endsWith('\\cli.ts'));

if (isDirectRun) {
  createCli().parseAsync(process.argv).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
