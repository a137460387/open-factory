import { describe, test, expect, vi } from 'vitest';
import { hasStdinData } from '../src/core/stdin';

describe('Stdin Support', () => {
  test('hasStdinData returns boolean', () => {
    // In test environment, stdin is typically a TTY
    const result = hasStdinData();
    expect(typeof result).toBe('boolean');
  });
});

describe('CLI Integration', () => {
  test('createCli returns a Command instance', async () => {
    const { createCli } = await import('../src/cli');
    const cli = createCli();
    expect(cli).toBeDefined();
    expect(cli.name()).toBe('of');
    expect(cli.version()).toBe('0.1.0');
  });

  test('CLI has all expected commands', async () => {
    const { createCli } = await import('../src/cli');
    const cli = createCli();
    const commands = cli.commands.map((c: { name: () => string }) => c.name());

    expect(commands).toContain('render');
    expect(commands).toContain('analyze');
    expect(commands).toContain('apply-template');
    expect(commands).toContain('workflow');
  });

  test('render command has expected options', async () => {
    const { createCli } = await import('../src/cli');
    const cli = createCli();
    const renderCmd = cli.commands.find((c: { name: () => string }) => c.name() === 'render');
    expect(renderCmd).toBeDefined();

    const optionNames = renderCmd!.options.map((o: { attributeName: () => string }) => o.attributeName());
    expect(optionNames).toContain('input');
    expect(optionNames).toContain('output');
    expect(optionNames).toContain('format');
    expect(optionNames).toContain('width');
    expect(optionNames).toContain('height');
    expect(optionNames).toContain('fps');
    expect(optionNames).toContain('stdin');
  });

  test('analyze command has expected options', async () => {
    const { createCli } = await import('../src/cli');
    const cli = createCli();
    const analyzeCmd = cli.commands.find((c: { name: () => string }) => c.name() === 'analyze');
    expect(analyzeCmd).toBeDefined();

    const optionNames = analyzeCmd!.options.map((o: { attributeName: () => string }) => o.attributeName());
    expect(optionNames).toContain('input');
    expect(optionNames).toContain('type');
    expect(optionNames).toContain('platform');
    expect(optionNames).toContain('stdin');
  });

  test('workflow command has subcommands', async () => {
    const { createCli } = await import('../src/cli');
    const cli = createCli();
    const workflowCmd = cli.commands.find((c: { name: () => string }) => c.name() === 'workflow');
    expect(workflowCmd).toBeDefined();

    const subcommands = workflowCmd!.commands.map((c: { name: () => string }) => c.name());
    expect(subcommands).toContain('run');
    expect(subcommands).toContain('validate');
  });
});
