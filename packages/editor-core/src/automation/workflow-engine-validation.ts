/**
 * Validation and normalization for workflow definitions
 */

import type {
  ActionType,
  AutomationWorkflowStep,
  ConditionOperator,
  TriggerType,
  Workflow,
  WorkflowAction,
  WorkflowCondition,
  WorkflowTrigger,
} from './workflow-engine-types';
import { createDefaultAction, createDefaultCondition, createDefaultStep, createDefaultTrigger, generateId } from './workflow-engine-factories';

/** 验证工作流 */
export function validateWorkflow(workflow: Workflow): Workflow {
  if (!workflow.id) throw new Error('工作流缺少 ID');
  if (!workflow.name) throw new Error('工作流缺少名称');
  if (!workflow.version) throw new Error('工作流缺少版本号');

  return {
    ...workflow,
    triggers: workflow.triggers.map((t) => ({
      ...t,
      id: t.id || generateId('trigger'),
    })),
    steps: workflow.steps.map((s) => ({
      ...s,
      id: s.id || generateId('step'),
      conditions: s.conditions.map((c) => ({
        ...c,
        id: c.id || generateId('condition'),
      })),
      actions: s.actions.map((a) => ({
        ...a,
        id: a.id || generateId('action'),
      })),
    })),
  };
}

/** 规范化工作流数据 */
export function normalizeWorkflow(data: unknown): Workflow {
  if (!data || typeof data !== 'object') {
    throw new Error('无效的工作流数据');
  }

  const obj = data as Record<string, unknown>;
  const now = Date.now();

  return {
    id: typeof obj.id === 'string' ? obj.id : generateId('workflow'),
    name: typeof obj.name === 'string' ? obj.name : '未命名工作流',
    description: typeof obj.description === 'string' ? obj.description : undefined,
    version: typeof obj.version === 'string' ? obj.version : '1.0.0',
    triggers: Array.isArray(obj.triggers) ? obj.triggers.map(normalizeTrigger) : [createDefaultTrigger()],
    steps: Array.isArray(obj.steps) ? obj.steps.map(normalizeStep) : [],
    enabled: typeof obj.enabled === 'boolean' ? obj.enabled : true,
    createdAt: typeof obj.createdAt === 'number' ? obj.createdAt : now,
    updatedAt: typeof obj.updatedAt === 'number' ? obj.updatedAt : now,
    tags: Array.isArray(obj.tags) ? obj.tags.filter((t): t is string => typeof t === 'string') : [],
  };
}

function normalizeTrigger(data: unknown): WorkflowTrigger {
  if (!data || typeof data !== 'object') return createDefaultTrigger();
  const obj = data as Record<string, unknown>;
  return {
    id: typeof obj.id === 'string' ? obj.id : generateId('trigger'),
    type: typeof obj.type === 'string' ? (obj.type as TriggerType) : 'manual',
    params: typeof obj.params === 'object' && obj.params !== null ? (obj.params as Record<string, unknown>) : {},
    enabled: typeof obj.enabled === 'boolean' ? obj.enabled : true,
  };
}

function normalizeStep(data: unknown): AutomationWorkflowStep {
  if (!data || typeof data !== 'object') return createDefaultStep();
  const obj = data as Record<string, unknown>;
  return {
    id: typeof obj.id === 'string' ? obj.id : generateId('step'),
    name: typeof obj.name === 'string' ? obj.name : '未命名步骤',
    description: typeof obj.description === 'string' ? obj.description : undefined,
    conditions: Array.isArray(obj.conditions) ? obj.conditions.map(normalizeCondition) : [],
    actions: Array.isArray(obj.actions) ? obj.actions.map(normalizeAction) : [],
    skipOnError: typeof obj.skipOnError === 'boolean' ? obj.skipOnError : false,
  };
}

function normalizeCondition(data: unknown): WorkflowCondition {
  if (!data || typeof data !== 'object') return createDefaultCondition();
  const obj = data as Record<string, unknown>;
  return {
    id: typeof obj.id === 'string' ? obj.id : generateId('condition'),
    field: typeof obj.field === 'string' ? obj.field : '',
    operator: typeof obj.operator === 'string' ? (obj.operator as ConditionOperator) : 'equals',
    value: obj.value,
    logic: obj.logic === 'or' ? 'or' : 'and',
  };
}

function normalizeAction(data: unknown): WorkflowAction {
  if (!data || typeof data !== 'object') return createDefaultAction();
  const obj = data as Record<string, unknown>;
  return {
    id: typeof obj.id === 'string' ? obj.id : generateId('action'),
    type: typeof obj.type === 'string' ? (obj.type as ActionType) : 'notify',
    params: typeof obj.params === 'object' && obj.params !== null ? (obj.params as Record<string, unknown>) : {},
    continueOnError: typeof obj.continueOnError === 'boolean' ? obj.continueOnError : false,
    timeout: typeof obj.timeout === 'number' ? obj.timeout : undefined,
  };
}
