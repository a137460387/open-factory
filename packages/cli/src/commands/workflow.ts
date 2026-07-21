/**
 * CLI `workflow` command — run workflow definition files.
 */

import type { Command } from 'commander';
import { withCliOutput, createLogger } from '../core/output.js';

export function registerWorkflowCommand(program: Command): void {
  const wf = program
    .command('workflow')
    .description('Workflow orchestration — run, validate, or list workflow definitions');

  wf.command('run')
    .description('Execute a workflow definition file')
    .requiredOption('-f, --file <path>', 'Path to workflow file (.json or .yaml)')
    .option('--var <pairs...>', 'Override workflow variables (key=value)')
    .action(async (opts) => {
      await withCliOutput('workflow:run', async () => {
        const logger = createLogger(program.opts().logLevel ?? 'info');

        logger.info(`Running workflow: ${opts.file}`);

        const { runWorkflow, loadWorkflowDefinition } = await import('../core/workflow-engine.js');

        const definition = await loadWorkflowDefinition(opts.file);

        // Parse variable overrides
        const variables: Record<string, string> = {};
        if (opts.var) {
          for (const pair of opts.var) {
            const [key, value] = pair.split('=');
            if (key && value !== undefined) {
              variables[key] = value;
            }
          }
        }

        const result = await runWorkflow(definition, {
          variables,
          logger,
          onStepComplete: (step, stepResult) => {
            logger.info(`Step "${step}" completed: ${stepResult.success ? 'OK' : 'FAILED'}`);
          },
        });

        if (!result.success) {
          throw new Error(`Workflow failed at step "${result.failedStep}": ${result.error}`);
        }

        logger.info(`Workflow completed: ${result.completedSteps}/${result.totalSteps} steps`);

        return {
          data: {
            completedSteps: result.completedSteps,
            totalSteps: result.totalSteps,
            stepResults: result.stepResults,
          },
          warnings: result.warnings,
        };
      });
    });

  wf.command('validate')
    .description('Validate a workflow definition file')
    .requiredOption('-f, --file <path>', 'Path to workflow file')
    .action(async (opts) => {
      await withCliOutput('workflow:validate', async () => {
        const { loadWorkflowDefinition, validateWorkflow } = await import('../core/workflow-engine.js');
        const definition = await loadWorkflowDefinition(opts.file);
        const validation = validateWorkflow(definition);

        if (!validation.valid) {
          throw new Error(`Invalid workflow: ${validation.errors.join(', ')}`);
        }

        return {
          data: { valid: true, stepCount: definition.steps.length },
          warnings: validation.warnings,
        };
      });
    });
}
