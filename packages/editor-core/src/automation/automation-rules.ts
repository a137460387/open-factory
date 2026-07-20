/**
 * 自动化规则系统
 * 基于规则的条件判断与动作执行
 * 支持用户自定义规则和规则模板库
 */

import type { ActionType, WorkflowAction, WorkflowCondition } from './workflow-engine';

// ============================================================
// 类型定义
// ============================================================

/** 规则优先级 */
export type RulePriority = 'low' | 'normal' | 'high' | 'critical';

/** 规则状态 */
export type RuleStatus = 'active' | 'inactive' | 'error';

/** 规则触发模式 */
export type RuleTriggerMode =
  | 'on-change' // 数据变化时触发
  | 'on-event' // 事件触发
  | 'periodic' // 周期触发
  | 'on-demand'; // 按需触发

/** 规则条件组 */
export interface RuleConditionGroup {
  /** 组内条件的逻辑关系 */
  logic: 'and' | 'or';
  conditions: WorkflowCondition[];
}

/** 规则定义 */
export interface AutomationRule {
  id: string;
  name: string;
  description?: string;
  /** 规则优先级，高优先级先执行 */
  priority: RulePriority;
  /** 规则状态 */
  status: RuleStatus;
  /** 触发模式 */
  triggerMode: RuleTriggerMode;
  /** 条件组（支持多组条件嵌套） */
  conditionGroups: RuleConditionGroup[];
  /** 满足条件时执行的动作 */
  actions: WorkflowAction[];
  /** 规则触发后的冷却时间（毫秒），防止重复触发 */
  cooldownMs: number;
  /** 最大执行次数，0 表示无限制 */
  maxExecutions: number;
  /** 当前已执行次数 */
  executionCount: number;
  /** 上次执行时间 */
  lastExecutedAt?: number;
  /** 创建时间 */
  createdAt: number;
  /** 更新时间 */
  updatedAt: number;
  /** 标签 */
  tags: string[];
}

/** 规则执行结果 */
export interface RuleExecutionResult {
  ruleId: string;
  ruleName: string;
  executed: boolean;
  /** 未执行的原因（如冷却中、条件不满足等） */
  skipReason?: string;
  /** 动作执行结果 */
  actionResults: Array<{
    actionId: string;
    success: boolean;
    output?: unknown;
    error?: string;
  }>;
  timestamp: number;
  /** 决策日志 */
  decisionLog: string[];
}

/** 规则模板 */
export interface RuleTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  rule: Omit<AutomationRule, 'id' | 'createdAt' | 'updatedAt' | 'executionCount' | 'lastExecutedAt'>;
}

/** 规则引擎配置 */
export interface RuleEngineConfig {
  /** 全局冷却时间（毫秒） */
  globalCooldownMs: number;
  /** 是否启用规则链（一个规则的输出作为下一个的输入） */
  enableRuleChaining: boolean;
  /** 最大规则链深度 */
  maxChainDepth: number;
  /** 是否记录决策日志 */
  enableDecisionLog: boolean;
}

/** 规则引擎事件 */
export type RuleEngineEvent = 'rule-evaluated' | 'rule-triggered' | 'rule-skipped' | 'rule-error' | 'chain-complete';

/** 规则引擎事件回调 */
export type RuleEngineEventCallback = (event: RuleEngineEvent, data: unknown) => void;

// ============================================================
// 工厂函数
// ============================================================

let _ruleId = 1;
function genRuleId(prefix: string): string {
  return `${prefix}_${Date.now()}_${_ruleId++}`;
}

/** 创建默认规则 */
export function createDefaultRule(name: string = '新规则'): AutomationRule {
  const now = Date.now();
  return {
    id: genRuleId('rule'),
    name,
    priority: 'normal',
    status: 'active',
    triggerMode: 'on-change',
    conditionGroups: [
      {
        logic: 'and',
        conditions: [],
      },
    ],
    actions: [],
    cooldownMs: 5000,
    maxExecutions: 0,
    executionCount: 0,
    createdAt: now,
    updatedAt: now,
    tags: [],
  };
}

/** 创建条件组 */
export function createConditionGroup(
  logic: 'and' | 'or' = 'and',
  conditions: WorkflowCondition[] = [],
): RuleConditionGroup {
  return { logic, conditions };
}

// ============================================================
// 条件评估
// ============================================================

/** 获取嵌套字段值 */
function getFieldValue(obj: unknown, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = obj;
  for (const part of parts) {
    if (current == null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

/** 评估单个条件 */
function evaluateCondition(
  condition: WorkflowCondition,
  data: Record<string, unknown>,
): { passed: boolean; reason: string } {
  const fieldValue = getFieldValue(data, condition.field);
  const { operator, value } = condition;

  let passed = false;
  let reason = '';

  switch (operator) {
    case 'equals':
      passed = fieldValue === value;
      reason = passed
        ? `${condition.field} 等于 ${JSON.stringify(value)}`
        : `${condition.field} (${JSON.stringify(fieldValue)}) 不等于 ${JSON.stringify(value)}`;
      break;
    case 'not_equals':
      passed = fieldValue !== value;
      reason = passed
        ? `${condition.field} 不等于 ${JSON.stringify(value)}`
        : `${condition.field} 等于 ${JSON.stringify(value)}`;
      break;
    case 'greater_than':
      passed = typeof fieldValue === 'number' && typeof value === 'number' && fieldValue > value;
      reason = `${condition.field} (${fieldValue}) ${passed ? '>' : '<='} ${value}`;
      break;
    case 'less_than':
      passed = typeof fieldValue === 'number' && typeof value === 'number' && fieldValue < value;
      reason = `${condition.field} (${fieldValue}) ${passed ? '<' : '>='} ${value}`;
      break;
    case 'contains':
      passed = typeof fieldValue === 'string' && typeof value === 'string' && fieldValue.includes(value);
      reason = `${condition.field} ${passed ? '包含' : '不包含'} "${value}"`;
      break;
    case 'not_contains':
      passed = typeof fieldValue === 'string' && typeof value === 'string' && !fieldValue.includes(value);
      reason = `${condition.field} ${passed ? '不包含' : '包含'} "${value}"`;
      break;
    case 'in':
      passed = Array.isArray(value) && value.includes(fieldValue);
      reason = `${condition.field} (${JSON.stringify(fieldValue)}) ${passed ? '在' : '不在'} 列表中`;
      break;
    case 'not_in':
      passed = Array.isArray(value) && !value.includes(fieldValue);
      reason = `${condition.field} (${JSON.stringify(fieldValue)}) ${passed ? '不在' : '在'} 列表中`;
      break;
    case 'exists':
      passed = fieldValue !== undefined && fieldValue !== null;
      reason = `${condition.field} ${passed ? '存在' : '不存在'}`;
      break;
    case 'not_exists':
      passed = fieldValue === undefined || fieldValue === null;
      reason = `${condition.field} ${passed ? '不存在' : '存在'}`;
      break;
    default:
      reason = `未知运算符: ${operator}`;
  }

  return { passed, reason };
}

/** 评估条件组 */
function evaluateConditionGroup(
  group: RuleConditionGroup,
  data: Record<string, unknown>,
): { passed: boolean; reasons: string[] } {
  if (group.conditions.length === 0) {
    return { passed: true, reasons: ['无条件，默认通过'] };
  }

  const results = group.conditions.map((c) => evaluateCondition(c, data));
  const reasons = results.map((r) => r.reason);

  let passed: boolean;
  if (group.logic === 'and') {
    passed = results.every((r) => r.passed);
  } else {
    passed = results.some((r) => r.passed);
  }

  return { passed, reasons };
}

/** 评估规则的所有条件组 */
export function evaluateRuleConditions(
  rule: AutomationRule,
  data: Record<string, unknown>,
): { passed: boolean; groupResults: Array<{ passed: boolean; reasons: string[] }>; decisionLog: string[] } {
  const decisionLog: string[] = [];
  const groupResults = rule.conditionGroups.map((group) => {
    const result = evaluateConditionGroup(group, data);
    decisionLog.push(`条件组 [${group.logic}]: ${result.passed ? '通过' : '未通过'} - ${result.reasons.join('; ')}`);
    return result;
  });

  // 多个条件组之间是 AND 关系
  const passed = groupResults.length === 0 || groupResults.every((r) => r.passed);
  decisionLog.push(`规则条件总体结果: ${passed ? '通过' : '未通过'}`);

  return { passed, groupResults, decisionLog };
}

// ============================================================
// 规则引擎
// ============================================================

/** 优先级数值映射 */
const PRIORITY_VALUES: Record<RulePriority, number> = {
  critical: 4,
  high: 3,
  normal: 2,
  low: 1,
};

/**
 * 自动化规则引擎
 * 负责规则的注册、评估、执行和管理
 */
export class RuleEngine {
  private rules: Map<string, AutomationRule> = new Map();
  private templates: Map<string, RuleTemplate> = new Map();
  private config: RuleEngineConfig;
  private eventListeners: Map<RuleEngineEvent, RuleEngineEventCallback[]> = new Map();
  private executionHistory: RuleExecutionResult[] = [];

  constructor(config: Partial<RuleEngineConfig> = {}) {
    this.config = {
      globalCooldownMs: 1000,
      enableRuleChaining: true,
      maxChainDepth: 5,
      enableDecisionLog: true,
      ...config,
    };
  }

  // ------ 规则管理 ------

  /** 注册规则 */
  registerRule(rule: AutomationRule): void {
    this.rules.set(rule.id, rule);
  }

  /** 注销规则 */
  unregisterRule(ruleId: string): void {
    this.rules.delete(ruleId);
  }

  /** 获取规则 */
  getRule(ruleId: string): AutomationRule | undefined {
    return this.rules.get(ruleId);
  }

  /** 获取所有规则 */
  getAllRules(): AutomationRule[] {
    return Array.from(this.rules.values());
  }

  /** 获取活跃规则（按优先级排序） */
  getActiveRules(): AutomationRule[] {
    return this.getAllRules()
      .filter((r) => r.status === 'active')
      .sort((a, b) => PRIORITY_VALUES[b.priority] - PRIORITY_VALUES[a.priority]);
  }

  /** 更新规则状态 */
  updateRuleStatus(ruleId: string, status: RuleStatus): boolean {
    const rule = this.rules.get(ruleId);
    if (!rule) return false;
    rule.status = status;
    rule.updatedAt = Date.now();
    return true;
  }

  // ------ 模板管理 ------

  /** 注册规则模板 */
  registerTemplate(template: RuleTemplate): void {
    this.templates.set(template.id, template);
  }

  /** 获取所有模板 */
  getAllTemplates(): RuleTemplate[] {
    return Array.from(this.templates.values());
  }

  /** 从模板创建规则 */
  createFromTemplate(templateId: string, name?: string): AutomationRule | undefined {
    const template = this.templates.get(templateId);
    if (!template) return undefined;

    const now = Date.now();
    const rule: AutomationRule = {
      ...template.rule,
      id: genRuleId('rule'),
      name: name || template.rule.name,
      executionCount: 0,
      createdAt: now,
      updatedAt: now,
    };

    this.registerRule(rule);
    return rule;
  }

  // ------ 规则评估与执行 ------

  /**
   * 评估并执行所有匹配的规则
   * @param data 输入数据
   * @param actionExecutor 动作执行函数
   * @returns 执行结果列表
   */
  async evaluateAndExecute(
    data: Record<string, unknown>,
    actionExecutor?: (
      action: WorkflowAction,
      data: Record<string, unknown>,
    ) => Promise<{ success: boolean; output?: unknown; error?: string }>,
  ): Promise<RuleExecutionResult[]> {
    const activeRules = this.getActiveRules();
    const results: RuleExecutionResult[] = [];

    for (const rule of activeRules) {
      const result = await this.evaluateRule(rule, data, actionExecutor);
      results.push(result);
    }

    return results;
  }

  /**
   * 评估单个规则
   */
  async evaluateRule(
    rule: AutomationRule,
    data: Record<string, unknown>,
    actionExecutor?: (
      action: WorkflowAction,
      data: Record<string, unknown>,
    ) => Promise<{ success: boolean; output?: unknown; error?: string }>,
  ): Promise<RuleExecutionResult> {
    const decisionLog: string[] = [];
    const now = Date.now();

    decisionLog.push(`评估规则: "${rule.name}" (优先级: ${rule.priority})`);

    // 检查规则状态
    if (rule.status !== 'active') {
      const result: RuleExecutionResult = {
        ruleId: rule.id,
        ruleName: rule.name,
        executed: false,
        skipReason: `规则状态为 ${rule.status}`,
        actionResults: [],
        timestamp: now,
        decisionLog: [...decisionLog, `跳过: 规则未激活`],
      };
      this.emit('rule-skipped', result);
      return result;
    }

    // 检查冷却时间
    if (rule.lastExecutedAt && now - rule.lastExecutedAt < rule.cooldownMs) {
      const remaining = rule.cooldownMs - (now - rule.lastExecutedAt);
      const result: RuleExecutionResult = {
        ruleId: rule.id,
        ruleName: rule.name,
        executed: false,
        skipReason: `冷却中，剩余 ${Math.ceil(remaining / 1000)}秒`,
        actionResults: [],
        timestamp: now,
        decisionLog: [...decisionLog, `跳过: 冷却时间未过`],
      };
      this.emit('rule-skipped', result);
      return result;
    }

    // 检查最大执行次数
    if (rule.maxExecutions > 0 && rule.executionCount >= rule.maxExecutions) {
      const result: RuleExecutionResult = {
        ruleId: rule.id,
        ruleName: rule.name,
        executed: false,
        skipReason: `已达最大执行次数 (${rule.maxExecutions})`,
        actionResults: [],
        timestamp: now,
        decisionLog: [...decisionLog, `跳过: 已达最大执行次数`],
      };
      this.emit('rule-skipped', result);
      return result;
    }

    // 评估条件
    const conditionResult = evaluateRuleConditions(rule, data);
    decisionLog.push(...conditionResult.decisionLog);

    this.emit('rule-evaluated', { rule, passed: conditionResult.passed, decisionLog });

    if (!conditionResult.passed) {
      const result: RuleExecutionResult = {
        ruleId: rule.id,
        ruleName: rule.name,
        executed: false,
        skipReason: '条件不满足',
        actionResults: [],
        timestamp: now,
        decisionLog,
      };
      this.emit('rule-skipped', result);
      return result;
    }

    // 执行动作
    decisionLog.push(`条件满足，开始执行 ${rule.actions.length} 个动作`);
    const actionResults: RuleExecutionResult['actionResults'] = [];

    for (const action of rule.actions) {
      if (actionExecutor) {
        try {
          const execResult = await actionExecutor(action, data);
          actionResults.push({
            actionId: action.id,
            success: execResult.success,
            output: execResult.output,
            error: execResult.error,
          });
          decisionLog.push(
            `动作 ${action.type}: ${execResult.success ? '成功' : '失败'}${execResult.error ? ` - ${execResult.error}` : ''}`,
          );
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          actionResults.push({
            actionId: action.id,
            success: false,
            error: message,
          });
          decisionLog.push(`动作 ${action.type}: 异常 - ${message}`);
          this.emit('rule-error', { rule, action, error });
        }
      } else {
        actionResults.push({
          actionId: action.id,
          success: true,
          output: { simulated: true },
        });
        decisionLog.push(`动作 ${action.type}: 模拟执行`);
      }
    }

    // 更新规则状态
    rule.executionCount++;
    rule.lastExecutedAt = now;
    rule.updatedAt = now;

    const result: RuleExecutionResult = {
      ruleId: rule.id,
      ruleName: rule.name,
      executed: true,
      actionResults,
      timestamp: now,
      decisionLog,
    };

    this.executionHistory.push(result);
    this.emit('rule-triggered', result);

    return result;
  }

  // ------ 规则链 ------

  /**
   * 执行规则链
   * 一个规则的输出作为下一个规则的输入
   */
  async executeRuleChain(
    initialData: Record<string, unknown>,
    actionExecutor?: (
      action: WorkflowAction,
      data: Record<string, unknown>,
    ) => Promise<{ success: boolean; output?: unknown; error?: string }>,
  ): Promise<RuleExecutionResult[]> {
    if (!this.config.enableRuleChaining) {
      return this.evaluateAndExecute(initialData, actionExecutor);
    }

    const allResults: RuleExecutionResult[] = [];
    let currentData = { ...initialData };
    let depth = 0;

    while (depth < this.config.maxChainDepth) {
      const results = await this.evaluateAndExecute(currentData, actionExecutor);
      allResults.push(...results);

      // 检查是否有规则被触发
      const triggered = results.filter((r) => r.executed);
      if (triggered.length === 0) break;

      // 将触发的规则输出合并到输入数据
      for (const result of triggered) {
        for (const actionResult of result.actionResults) {
          if (actionResult.success && actionResult.output) {
            currentData = {
              ...currentData,
              [`ruleOutput_${result.ruleId}`]: actionResult.output,
            };
          }
        }
      }

      depth++;
    }

    if (depth > 0) {
      this.emit('chain-complete', { depth, results: allResults });
    }

    return allResults;
  }

  // ------ 事件系统 ------

  /** 监听事件 */
  on(event: RuleEngineEvent, callback: RuleEngineEventCallback): void {
    const listeners = this.eventListeners.get(event) || [];
    listeners.push(callback);
    this.eventListeners.set(event, listeners);
  }

  /** 移除监听 */
  off(event: RuleEngineEvent, callback: RuleEngineEventCallback): void {
    const listeners = this.eventListeners.get(event) || [];
    const index = listeners.indexOf(callback);
    if (index >= 0) listeners.splice(index, 1);
  }

  private emit(event: RuleEngineEvent, data: unknown): void {
    const listeners = this.eventListeners.get(event) || [];
    for (const cb of listeners) {
      try {
        cb(event, data);
      } catch {
        /* 忽略监听器错误 */
      }
    }
  }

  // ------ 历史 ------

  /** 获取执行历史 */
  getExecutionHistory(ruleId?: string): RuleExecutionResult[] {
    if (ruleId) {
      return this.executionHistory.filter((r) => r.ruleId === ruleId);
    }
    return [...this.executionHistory];
  }

  /** 清除历史 */
  clearHistory(): void {
    this.executionHistory = [];
  }

  // ------ 序列化 ------

  /** 导出规则为 JSON */
  exportRules(): string {
    return JSON.stringify(this.getAllRules(), null, 2);
  }

  /** 从 JSON 导入规则 */
  importRules(json: string): AutomationRule[] {
    const data = JSON.parse(json);
    if (!Array.isArray(data)) throw new Error('无效的规则数据');

    const rules = data.map((d) => normalizeRule(d));
    for (const rule of rules) {
      this.registerRule(rule);
    }
    return rules;
  }
}

// ============================================================
// 验证与规范化
// ============================================================

/** 规范化规则数据 */
export function normalizeRule(data: unknown): AutomationRule {
  if (!data || typeof data !== 'object') {
    throw new Error('无效的规则数据');
  }

  const obj = data as Record<string, unknown>;
  const now = Date.now();

  return {
    id: typeof obj.id === 'string' ? obj.id : genRuleId('rule'),
    name: typeof obj.name === 'string' ? obj.name : '未命名规则',
    description: typeof obj.description === 'string' ? obj.description : undefined,
    priority: typeof obj.priority === 'string' ? (obj.priority as RulePriority) : 'normal',
    status: typeof obj.status === 'string' ? (obj.status as RuleStatus) : 'active',
    triggerMode: typeof obj.triggerMode === 'string' ? (obj.triggerMode as RuleTriggerMode) : 'on-change',
    conditionGroups: Array.isArray(obj.conditionGroups)
      ? obj.conditionGroups.map(normalizeConditionGroup)
      : [{ logic: 'and' as const, conditions: [] }],
    actions: Array.isArray(obj.actions) ? obj.actions.map(normalizeAction) : [],
    cooldownMs: typeof obj.cooldownMs === 'number' ? obj.cooldownMs : 5000,
    maxExecutions: typeof obj.maxExecutions === 'number' ? obj.maxExecutions : 0,
    executionCount: typeof obj.executionCount === 'number' ? obj.executionCount : 0,
    lastExecutedAt: typeof obj.lastExecutedAt === 'number' ? obj.lastExecutedAt : undefined,
    createdAt: typeof obj.createdAt === 'number' ? obj.createdAt : now,
    updatedAt: typeof obj.updatedAt === 'number' ? obj.updatedAt : now,
    tags: Array.isArray(obj.tags) ? obj.tags.filter((t: unknown): t is string => typeof t === 'string') : [],
  };
}

function normalizeConditionGroup(data: unknown): RuleConditionGroup {
  if (!data || typeof data !== 'object') return { logic: 'and', conditions: [] };
  const obj = data as Record<string, unknown>;
  return {
    logic: obj.logic === 'or' ? 'or' : 'and',
    conditions: Array.isArray(obj.conditions) ? obj.conditions.map(normalizeCondition) : [],
  };
}

function normalizeCondition(data: unknown): WorkflowCondition {
  if (!data || typeof data !== 'object') {
    return { id: genRuleId('cond'), field: '', operator: 'equals', value: null };
  }
  const obj = data as Record<string, unknown>;
  return {
    id: typeof obj.id === 'string' ? obj.id : genRuleId('cond'),
    field: typeof obj.field === 'string' ? obj.field : '',
    operator: typeof obj.operator === 'string' ? (obj.operator as WorkflowCondition['operator']) : 'equals',
    value: obj.value,
    logic: obj.logic === 'or' ? 'or' : 'and',
  };
}

function normalizeAction(data: unknown): WorkflowAction {
  if (!data || typeof data !== 'object') {
    return { id: genRuleId('action'), type: 'notify', params: {}, continueOnError: false };
  }
  const obj = data as Record<string, unknown>;
  return {
    id: typeof obj.id === 'string' ? obj.id : genRuleId('action'),
    type: typeof obj.type === 'string' ? (obj.type as ActionType) : 'notify',
    params: typeof obj.params === 'object' && obj.params !== null ? (obj.params as Record<string, unknown>) : {},
    continueOnError: typeof obj.continueOnError === 'boolean' ? obj.continueOnError : false,
    timeout: typeof obj.timeout === 'number' ? obj.timeout : undefined,
  };
}

// ============================================================
// 内置规则模板
// ============================================================

export const BUILTIN_RULE_TEMPLATES: RuleTemplate[] = [
  {
    id: 'rtpl-quality-guard',
    name: '质量守卫',
    description: '当素材质量低于阈值时自动触发修复',
    category: '质量',
    rule: {
      name: '质量守卫',
      description: '监控素材质量，低于阈值时自动修复',
      priority: 'high',
      status: 'active',
      triggerMode: 'on-event',
      conditionGroups: [
        {
          logic: 'and',
          conditions: [
            {
              id: 'c1',
              field: 'quality.overall',
              operator: 'less_than',
              value: 70,
            },
          ],
        },
      ],
      actions: [
        {
          id: 'a1',
          type: 'apply-effect',
          params: { effectType: 'quality-enhance', intensity: 0.8 },
          continueOnError: false,
        },
      ],
      cooldownMs: 10000,
      maxExecutions: 0,
      tags: ['质量', '自动修复'],
    },
  },
  {
    id: 'rtpl-auto-trim',
    name: '自动裁剪黑边',
    description: '检测到黑边时自动裁剪',
    category: '编辑',
    rule: {
      name: '自动裁剪黑边',
      description: '检测画面黑边并自动裁剪',
      priority: 'normal',
      status: 'active',
      triggerMode: 'on-event',
      conditionGroups: [
        {
          logic: 'and',
          conditions: [
            {
              id: 'c1',
              field: 'analysis.hasBlackBars',
              operator: 'equals',
              value: true,
            },
          ],
        },
      ],
      actions: [
        {
          id: 'a1',
          type: 'apply-effect',
          params: { effectType: 'crop', auto: true },
          continueOnError: true,
        },
      ],
      cooldownMs: 5000,
      maxExecutions: 1,
      tags: ['裁剪', '黑边'],
    },
  },
  {
    id: 'rtpl-scene-transition',
    name: '场景过渡',
    description: '在场景切换处自动添加过渡效果',
    category: '效果',
    rule: {
      name: '场景过渡',
      description: '场景切换时自动添加交叉溶解',
      priority: 'normal',
      status: 'active',
      triggerMode: 'on-event',
      conditionGroups: [
        {
          logic: 'and',
          conditions: [
            {
              id: 'c1',
              field: 'scene.isTransition',
              operator: 'equals',
              value: true,
            },
            {
              id: 'c2',
              field: 'scene.duration',
              operator: 'greater_than',
              value: 0.5,
            },
          ],
        },
      ],
      actions: [
        {
          id: 'a1',
          type: 'apply-effect',
          params: { effectType: 'transition', type: 'cross-dissolve', duration: 0.5 },
          continueOnError: true,
        },
      ],
      cooldownMs: 2000,
      maxExecutions: 0,
      tags: ['过渡', '自动'],
    },
  },
  {
    id: 'rtpl-loudness-normalize',
    name: '响度标准化',
    description: '音频响度不达标时自动调整',
    category: '音频',
    rule: {
      name: '响度标准化',
      description: '将音频响度标准化到 -14 LUFS',
      priority: 'normal',
      status: 'active',
      triggerMode: 'on-event',
      conditionGroups: [
        {
          logic: 'or',
          conditions: [
            {
              id: 'c1',
              field: 'audio.loudness',
              operator: 'greater_than',
              value: -10,
            },
            {
              id: 'c2',
              field: 'audio.loudness',
              operator: 'less_than',
              value: -20,
            },
          ],
        },
      ],
      actions: [
        {
          id: 'a1',
          type: 'apply-effect',
          params: { effectType: 'loudness-normalize', targetLUFS: -14 },
          continueOnError: false,
        },
      ],
      cooldownMs: 5000,
      maxExecutions: 1,
      tags: ['音频', '响度'],
    },
  },
];
