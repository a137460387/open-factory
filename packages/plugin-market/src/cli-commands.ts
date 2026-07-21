// CLI Command Registration
// Manages plugin-contributed CLI commands: registration, lookup, and execution dispatch.

import type { CliCommandDefinition, CliOptionDefinition } from './types.js';

/** Result of parsing CLI arguments against a command definition. */
export interface ParsedCliArgs {
  readonly command: string;
  readonly options: Readonly<Record<string, string | boolean | number>>;
  readonly positional: readonly string[];
}

/** Resolved CLI command with its owning plugin. */
export interface RegisteredCliCommand {
  readonly pluginId: string;
  readonly definition: CliCommandDefinition;
}

/**
 * Registry for plugin-contributed CLI commands.
 * Supports registration, lookup, argument parsing, and help generation.
 */
export class CliCommandRegistry {
  private readonly commands = new Map<string, RegisteredCliCommand>();

  /** Register CLI commands from a plugin manifest. */
  register(pluginId: string, definitions: readonly CliCommandDefinition[]): void {
    for (const def of definitions) {
      const key = def.name.toLowerCase();
      if (this.commands.has(key)) {
        const existing = this.commands.get(key)!;
        throw new Error(
          `CLI command '${def.name}' already registered by plugin '${existing.pluginId}'`,
        );
      }
      this.commands.set(key, { pluginId, definition: def });
    }
  }

  /** Unregister all CLI commands for a plugin. */
  unregister(pluginId: string): void {
    for (const [key, cmd] of this.commands) {
      if (cmd.pluginId === pluginId) {
        this.commands.delete(key);
      }
    }
  }

  /** Look up a command by name. */
  get(name: string): RegisteredCliCommand | undefined {
    return this.commands.get(name.toLowerCase());
  }

  /** List all registered commands. */
  listAll(): readonly RegisteredCliCommand[] {
    return [...this.commands.values()];
  }

  /** List commands registered by a specific plugin. */
  listByPlugin(pluginId: string): readonly RegisteredCliCommand[] {
    return [...this.commands.values()].filter((c) => c.pluginId === pluginId);
  }

  /** Parse raw CLI arguments against a command definition. */
  parseArgs(commandName: string, rawArgs: readonly string[]): ParsedCliArgs {
    const cmd = this.commands.get(commandName.toLowerCase());
    if (!cmd) {
      throw new Error(`Unknown command: ${commandName}`);
    }

    const options: Record<string, string | boolean | number> = {};
    const positional: string[] = [];

    // Set defaults
    for (const opt of cmd.definition.options) {
      if (opt.default !== undefined) {
        options[opt.flag] = opt.default;
      }
    }

    let i = 0;
    while (i < rawArgs.length) {
      const arg = rawArgs[i];

      if (arg.startsWith('--')) {
        const flagName = arg.slice(2);
        const optDef = cmd.definition.options.find(
          (o) => o.flag === flagName,
        );

        if (!optDef) {
          throw new Error(`Unknown option '--${flagName}' for command '${commandName}'`);
        }

        if (optDef.type === 'boolean') {
          options[flagName] = true;
        } else {
          i++;
          if (i >= rawArgs.length) {
            throw new Error(`Option '--${flagName}' requires a value`);
          }
          const raw = rawArgs[i];
          if (optDef.type === 'number') {
            const num = Number(raw);
            if (isNaN(num)) {
              throw new Error(`Option '--${flagName}' expects a number, got '${raw}'`);
            }
            options[flagName] = num;
          } else {
            options[flagName] = raw;
          }
        }
      } else {
        positional.push(arg);
      }

      i++;
    }

    // Validate required options
    for (const opt of cmd.definition.options) {
      if (opt.required && !(opt.flag in options)) {
        throw new Error(`Required option '--${opt.flag}' is missing`);
      }
    }

    return { command: commandName, options, positional };
  }

  /** Generate help text for a specific command. */
  getHelp(commandName: string): string {
    const cmd = this.commands.get(commandName.toLowerCase());
    if (!cmd) {
      return `Unknown command: ${commandName}`;
    }

    const d = cmd.definition;
    const lines: string[] = [
      `${d.name} - ${d.description}`,
      '',
      `Usage: ${d.usage}`,
      '',
    ];

    if (d.options.length > 0) {
      lines.push('Options:');
      for (const opt of d.options) {
        const required = opt.required ? ' (required)' : '';
        const def = opt.default !== undefined ? ` [default: ${opt.default}]` : '';
        lines.push(`  --${opt.flag}  ${opt.description}${required}${def}`);
      }
    }

    return lines.join('\n');
  }

  /** Generate help text listing all commands. */
  getGlobalHelp(): string {
    const cmds = this.listAll();
    if (cmds.length === 0) return 'No plugin commands registered.';

    const lines: string[] = ['Plugin Commands:', ''];
    for (const cmd of cmds) {
      lines.push(`  ${cmd.definition.name.padEnd(20)} ${cmd.definition.description} (from ${cmd.pluginId})`);
    }
    return lines.join('\n');
  }

  /** Get the number of registered commands. */
  get size(): number {
    return this.commands.size;
  }

  /** Clear all registered commands. */
  clear(): void {
    this.commands.clear();
  }
}

/** Validate a CLI command definition for well-formedness. */
export function validateCliCommand(def: CliCommandDefinition): string[] {
  const errors: string[] = [];

  if (!def.name || def.name.trim().length === 0) {
    errors.push('Command name cannot be empty');
  }
  if (def.name.includes(' ')) {
    errors.push('Command name cannot contain spaces');
  }
  if (!def.description || def.description.trim().length === 0) {
    errors.push('Command description cannot be empty');
  }
  if (!def.usage || def.usage.trim().length === 0) {
    errors.push('Command usage cannot be empty');
  }
  if (!def.handler || def.handler.trim().length === 0) {
    errors.push('Command handler cannot be empty');
  }

  // Validate options
  for (let i = 0; i < def.options.length; i++) {
    const opt = def.options[i];
    if (!opt.flag || opt.flag.trim().length === 0) {
      errors.push(`Option[${i}]: flag cannot be empty`);
    }
    if (opt.flag.includes(' ')) {
      errors.push(`Option[${i}]: flag cannot contain spaces`);
    }
    if (!['string', 'boolean', 'number'].includes(opt.type)) {
      errors.push(`Option[${i}]: invalid type '${opt.type}'`);
    }
  }

  return errors;
}
