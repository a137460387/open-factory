import type { ExportTask } from '@open-factory/editor-core';
import { zhCN } from '../i18n/strings';
import { copyFile, sendNotification } from '../lib/tauri-bridge';
import { readExportRules, type ExportConditionRule, type ExportRuleTrigger } from '../settings/appSettings';

export interface ExportRuleVariableContext {
  date?: Date;
  projectName?: string;
}

export interface ExportRuleEventContext extends ExportRuleVariableContext {
  type: ExportRuleTrigger;
  task?: Pick<ExportTask, 'name' | 'outputPath' | 'projectName' | 'error'>;
}

export interface ExportRuleDependencies {
  copyFile(sourcePath: string, destinationPath: string): Promise<void> | void;
  notify(title: string, body: string): Promise<void> | void;
  playTone(): Promise<void> | void;
}

export interface ExportRuleExecution {
  ruleId: string;
  action: ExportConditionRule['action'];
  targetPath?: string;
}

export function replaceExportRuleVariables(template: string, context: ExportRuleVariableContext = {}): string {
  const date = formatDateYYYYMMDD(context.date ?? new Date());
  const project = sanitizePathSegment(context.projectName ?? zhCN.project.defaultName);
  return template.replaceAll('{date}', date).replaceAll('{project}', project);
}

function getTriggeredExportRules(rules: ExportConditionRule[], trigger: ExportRuleTrigger): ExportConditionRule[] {
  return rules.filter((rule) => rule.enabled && rule.trigger === trigger);
}

export function resolveCopyDestination(rule: ExportConditionRule, event: ExportRuleEventContext): string | undefined {
  if (rule.action !== 'copy-to-directory' || !event.task?.outputPath || !rule.targetDirectory?.trim()) {
    return undefined;
  }
  const directory = replaceExportRuleVariables(rule.targetDirectory, {
    date: event.date,
    projectName: event.projectName ?? event.task.projectName ?? event.task.name
  });
  return joinDirectoryAndFile(directory, fileNameFromPath(event.task.outputPath));
}

export async function runExportRuleEvent(rules: ExportConditionRule[], event: ExportRuleEventContext, dependencies: ExportRuleDependencies): Promise<ExportRuleExecution[]> {
  const executions: ExportRuleExecution[] = [];
  for (const rule of getTriggeredExportRules(rules, event.type)) {
    if (rule.action === 'copy-to-directory') {
      const targetPath = resolveCopyDestination(rule, event);
      if (!targetPath || !event.task?.outputPath) {
        continue;
      }
      await dependencies.copyFile(event.task.outputPath, targetPath);
      executions.push({ ruleId: rule.id, action: rule.action, targetPath });
      continue;
    }
    if (rule.action === 'system-notification') {
      await dependencies.notify(notificationTitle(event), notificationBody(event));
      executions.push({ ruleId: rule.id, action: rule.action });
      continue;
    }
    if (rule.action === 'play-tone') {
      await dependencies.playTone();
      executions.push({ ruleId: rule.id, action: rule.action });
    }
  }
  return executions;
}

export async function runConfiguredExportRules(event: ExportRuleEventContext): Promise<void> {
  const rules = await readExportRules();
  await runExportRuleEvent(rules, event, {
    copyFile,
    notify: sendNotification,
    playTone: playExportRuleTone
  });
}

async function playExportRuleTone(): Promise<void> {
  const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextCtor) {
    return;
  }
  const context = new AudioContextCtor();
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = 'sine';
  oscillator.frequency.value = 880;
  gain.gain.value = 0.04;
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start();
  oscillator.stop(context.currentTime + 0.18);
  await new Promise<void>((resolve) => {
    oscillator.onended = () => resolve();
  });
  await context.close().catch(() => undefined);
}

function notificationTitle(event: ExportRuleEventContext): string {
  if (event.type === 'export-failure') {
    return zhCN.exportRules.notificationFailureTitle;
  }
  if (event.type === 'queue-complete') {
    return zhCN.exportRules.notificationQueueCompleteTitle;
  }
  return zhCN.exportRules.notificationSuccessTitle;
}

function notificationBody(event: ExportRuleEventContext): string {
  if (event.type === 'export-failure') {
    return event.task?.error ?? zhCN.errors.exportFailed;
  }
  if (event.type === 'queue-complete') {
    return zhCN.exportRules.notificationQueueCompleteBody;
  }
  return event.task?.outputPath ?? zhCN.exportRules.notificationSuccessBody;
}

function formatDateYYYYMMDD(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

function sanitizePathSegment(value: string): string {
  return value.trim().replace(/[<>:"|?*\u0000-\u001f]/g, '_').replace(/[. ]+$/g, '') || zhCN.project.defaultName;
}

function fileNameFromPath(path: string): string {
  return path.split(/[\\/]/).pop() ?? path;
}

function joinDirectoryAndFile(directory: string, fileName: string): string {
  const separator = directory.includes('\\') && !directory.includes('/') ? '\\' : '/';
  return `${directory.replace(/[\\/]+$/g, '')}${separator}${fileName}`;
}
