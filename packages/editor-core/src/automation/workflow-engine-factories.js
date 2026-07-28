/**
 * Factory functions and condition evaluation for the workflow engine
 */

let _nextId = 1;

export function generateId(prefix) {
  return `${prefix}_${Date.now()}_${_nextId++}`;
}

/** 创建默认触发器 */
export function createDefaultTrigger(type = 'manual') {
  return {
    id: generateId('trigger'),
    type,
    params: {},
    enabled: true,
  };
}

/** 创建默认条件 */
export function createDefaultCondition() {
  return {
    id: generateId('condition'),
    field: '',
    operator: 'equals',
    value: null,
    logic: 'and',
  };
}

/** 创建默认动作 */
export function createDefaultAction(type = 'notify') {
  return {
    id: generateId('action'),
    type,
    params: {},
    continueOnError: false,
  };
}

/** 创建默认步骤 */
export function createDefaultStep(name = '新步骤') {
  return {
    id: generateId('step'),
    name,
    conditions: [],
    actions: [],
    skipOnError: false,
  };
}

/** 创建默认工作流 */
export function createDefaultWorkflow(name = '新工作流') {
  const now = Date.now();
  return {
    id: generateId('workflow'),
    name,
    version: '1.0.0',
    triggers: [createDefaultTrigger()],
    steps: [],
    enabled: true,
    createdAt: now,
    updatedAt: now,
    tags: [],
  };
}

/** 创建执行上下文 */
export function createExecutionContext(workflowId, triggerData = {}) {
  return {
    workflowId,
    executionId: generateId('exec'),
    startTime: Date.now(),
    status: 'idle',
    currentStepIndex: 0,
    stepResults: new Map(),
    logs: [],
    triggerData,
    variables: new Map(),
  };
}

/** 获取嵌套字段值 */
function getFieldValue(obj, path) {
  const parts = path.split('.');
  let current = obj;
  for (const part of parts) {
    if (current == null || typeof current !== 'object') return undefined;
    current = current[part];
  }
  return current;
}

/** 评估单个条件 */
export function evaluateCondition(condition, data) {
  const fieldValue = getFieldValue(data, condition.field);
  const { operator, value } = condition;

  switch (operator) {
    case 'equals':
      return fieldValue === value;
    case 'not_equals':
      return fieldValue !== value;
    case 'greater_than':
      return typeof fieldValue === 'number' && typeof value === 'number' && fieldValue > value;
    case 'less_than':
      return typeof fieldValue === 'number' && typeof value === 'number' && fieldValue < value;
    case 'contains':
      return typeof fieldValue === 'string' && typeof value === 'string' && fieldValue.includes(value);
    case 'not_contains':
      return typeof fieldValue === 'string' && typeof value === 'string' && !fieldValue.includes(value);
    case 'in':
      return Array.isArray(value) && value.includes(fieldValue);
    case 'not_in':
      return Array.isArray(value) && !value.includes(fieldValue);
    case 'exists':
      return fieldValue !== undefined && fieldValue !== null;
    case 'not_exists':
      return fieldValue === undefined || fieldValue === null;
    default:
      return false;
  }
}

/** 评估一组条件（支持 and/or 逻辑） */
export function evaluateConditions(conditions, data) {
  if (conditions.length === 0) return true;

  let result = evaluateCondition(conditions[0], data);

  for (let i = 1; i < conditions.length; i++) {
    const condition = conditions[i];
    const conditionResult = evaluateCondition(condition, data);

    if (condition.logic === 'or') {
      result = result || conditionResult;
    } else {
      result = result && conditionResult;
    }
  }

  return result;
}
