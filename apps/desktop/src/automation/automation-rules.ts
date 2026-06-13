import type { MediaAsset, MediaLabelColor } from '@open-factory/editor-core';
import { zhCN } from '../i18n/strings';
import {
  normalizeAutomationRules,
  readAutomationRules,
  type AutomationAction,
  type AutomationCondition,
  type AutomationRule,
  type AutomationTrigger
} from '../settings/appSettings';

export interface AutomationEventContext {
  trigger: AutomationTrigger;
  media: MediaAsset[];
  projectName?: string;
}

export interface AutomationActionDependencies {
  enqueueProxy(asset: MediaAsset): Promise<void> | void;
  setLabel(assetId: string, labelColor: MediaLabelColor): Promise<void> | void;
  moveToGroup(asset: MediaAsset, groupName: string): Promise<void> | void;
  notify(title: string, body: string): Promise<void> | void;
}

export interface AutomationExecution {
  ruleId: string;
  assetId: string;
  action: AutomationAction['type'];
}

export function parseAutomationRulesJson(contents: string): { ok: true; rules: AutomationRule[] } | { ok: false; error: string } {
  try {
    const parsed = JSON.parse(contents) as unknown;
    const rules = normalizeAutomationRules(Array.isArray(parsed) ? parsed : [parsed]);
    return { ok: true, rules };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : zhCN.automationRules.invalidJson };
  }
}

export function serializeAutomationRulesJson(rules: AutomationRule[]): string {
  return `${JSON.stringify(rules, null, 2)}\n`;
}

export function getTriggeredAutomationRules(rules: AutomationRule[], trigger: AutomationTrigger): AutomationRule[] {
  return rules.filter((rule) => rule.enabled && rule.trigger === trigger);
}

export function automationRuleMatchesMedia(rule: AutomationRule, asset: MediaAsset): boolean {
  return rule.conditions.every((condition) => evaluateAutomationCondition(asset, condition));
}

export function evaluateAutomationCondition(asset: MediaAsset, condition: AutomationCondition): boolean {
  const fieldValue = getAutomationFieldValue(asset, condition.field);
  if (condition.op === 'contains') {
    return String(fieldValue ?? '').toLowerCase().includes(String(condition.value).toLowerCase());
  }
  if (condition.op === '==' || condition.op === '!=') {
    const equal = String(fieldValue ?? '').toLowerCase() === String(condition.value).toLowerCase();
    return condition.op === '==' ? equal : !equal;
  }
  const left = Number(fieldValue);
  const right = Number(condition.value);
  if (!Number.isFinite(left) || !Number.isFinite(right)) {
    return false;
  }
  if (condition.op === '>') {
    return left > right;
  }
  if (condition.op === '>=') {
    return left >= right;
  }
  if (condition.op === '<') {
    return left < right;
  }
  return left <= right;
}

export async function runAutomationRulesForMedia(
  rules: AutomationRule[],
  event: AutomationEventContext,
  dependencies: AutomationActionDependencies
): Promise<AutomationExecution[]> {
  const executions: AutomationExecution[] = [];
  for (const rule of getTriggeredAutomationRules(rules, event.trigger)) {
    for (const asset of event.media) {
      if (!automationRuleMatchesMedia(rule, asset)) {
        continue;
      }
      executions.push(...(await executeAutomationActions(rule, asset, dependencies)));
    }
  }
  return executions;
}

export async function runConfiguredAutomationForMedia(event: AutomationEventContext, dependencies: AutomationActionDependencies): Promise<AutomationExecution[]> {
  const rules = await readAutomationRules();
  return runAutomationRulesForMedia(rules, event, dependencies);
}

export async function executeAutomationActions(
  rule: AutomationRule,
  asset: MediaAsset,
  dependencies: AutomationActionDependencies
): Promise<AutomationExecution[]> {
  const executions: AutomationExecution[] = [];
  for (const action of rule.actions) {
    if (action.type === 'generate-proxy') {
      await dependencies.enqueueProxy(asset);
      executions.push({ ruleId: rule.id, assetId: asset.id, action: action.type });
      continue;
    }
    if (action.type === 'add-tag' || action.type === 'add-color-label') {
      const labelColor = normalizeAutomationLabelColor(action.value);
      if (!labelColor) {
        continue;
      }
      await dependencies.setLabel(asset.id, labelColor);
      executions.push({ ruleId: rule.id, assetId: asset.id, action: action.type });
      continue;
    }
    if (action.type === 'move-to-group') {
      const groupName = action.value?.trim();
      if (!groupName) {
        continue;
      }
      await dependencies.moveToGroup(asset, groupName);
      executions.push({ ruleId: rule.id, assetId: asset.id, action: action.type });
      continue;
    }
    if (action.type === 'send-notification') {
      await dependencies.notify(zhCN.automationRules.notificationTitle, zhCN.automationRules.notificationBody(asset.name));
      executions.push({ ruleId: rule.id, assetId: asset.id, action: action.type });
    }
  }
  return executions;
}

function getAutomationFieldValue(asset: MediaAsset, field: AutomationCondition['field']): string | number | boolean | undefined {
  if (field === 'duration') {
    return asset.duration;
  }
  if (field === 'width') {
    return asset.width;
  }
  if (field === 'height') {
    return asset.height;
  }
  if (field === 'resolution') {
    return Math.max(asset.width || 0, asset.height || 0);
  }
  if (field === 'fileSize' || field === 'size') {
    return asset.size ?? 0;
  }
  if (field === 'format') {
    return extensionFromPath(asset.path || asset.name);
  }
  if (field === 'type') {
    return asset.type;
  }
  return asset.name;
}

function normalizeAutomationLabelColor(value: string | undefined): MediaLabelColor | undefined {
  if (value === 'red' || value === 'orange' || value === 'yellow' || value === 'green' || value === 'blue' || value === 'purple') {
    return value;
  }
  return value?.trim() ? 'blue' : undefined;
}

function extensionFromPath(path: string): string {
  return path.split(/[\\/]/).pop()?.split('.').pop()?.toLowerCase() ?? '';
}
