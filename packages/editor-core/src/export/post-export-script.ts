import type { ExportPostExportScriptSettings } from './export-types';

export interface PostExportScriptVariables {
  outputPath: string;
  projectName: string;
  durationSeconds: number;
  date: Date;
}

export function normalizeExportPostScript(value: unknown): ExportPostExportScriptSettings | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const command = (value as { command?: unknown }).command;
  if (typeof command !== 'string') {
    return null;
  }
  const trimmed = command.trim();
  return trimmed ? { command: trimmed } : null;
}

export function expandPostExportScriptCommand(command: string, variables: PostExportScriptVariables): string {
  return command
    .replaceAll('{output}', variables.outputPath)
    .replaceAll('{project}', variables.projectName)
    .replaceAll('{duration}', formatPostExportDuration(variables.durationSeconds))
    .replaceAll('{date}', formatPostExportDate(variables.date));
}

export function formatPostExportDate(date: Date): string {
  const year = date.getFullYear().toString().padStart(4, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}${month}${day}`;
}

export function formatPostExportDuration(durationSeconds: number): string {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    return '0';
  }
  return Number.isInteger(durationSeconds) ? durationSeconds.toFixed(0) : durationSeconds.toFixed(3).replace(/0+$/, '').replace(/\.$/, '');
}
