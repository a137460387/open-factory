/**
 * 自动化规则系统
 * 基于规则的条件判断与动作执行
 * 支持用户自定义规则和规则模板库
 */
import type { WorkflowAction, WorkflowCondition } from './workflow-engine';
/** 规则优先级 */
export type RulePriority = 'low' | 'normal' | 'high' | 'critical';
/** 规则状态 */
export type RuleStatus = 'active' | 'inactive' | 'error';
/** 规则触发模式 */
export type RuleTriggerMode = 'on-change' | 'on-event' | 'periodic' | 'on-demand';
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
/** 创建默认规则 */
export declare function createDefaultRule(name?: string): AutomationRule;
/** 创建条件组 */
export declare function createConditionGroup(logic?: 'and' | 'or', conditions?: WorkflowCondition[]): RuleConditionGroup;
/** 评估规则的所有条件组 */
export declare function evaluateRuleConditions(rule: AutomationRule, data: Record<string, unknown>): {
    passed: boolean;
    groupResults: Array<{
        passed: boolean;
        reasons: string[];
    }>;
    decisionLog: string[];
};
/**
 * 自动化规则引擎
 * 负责规则的注册、评估、执行和管理
 */
export declare class RuleEngine {
    private rules;
    private templates;
    private config;
    private eventListeners;
    private executionHistory;
    constructor(config?: Partial<RuleEngineConfig>);
    /** 注册规则 */
    registerRule(rule: AutomationRule): void;
    /** 注销规则 */
    unregisterRule(ruleId: string): void;
    /** 获取规则 */
    getRule(ruleId: string): AutomationRule | undefined;
    /** 获取所有规则 */
    getAllRules(): AutomationRule[];
    /** 获取活跃规则（按优先级排序） */
    getActiveRules(): AutomationRule[];
    /** 更新规则状态 */
    updateRuleStatus(ruleId: string, status: RuleStatus): boolean;
    /** 注册规则模板 */
    registerTemplate(template: RuleTemplate): void;
    /** 获取所有模板 */
    getAllTemplates(): RuleTemplate[];
    /** 从模板创建规则 */
    createFromTemplate(templateId: string, name?: string): AutomationRule | undefined;
    /**
     * 评估并执行所有匹配的规则
     * @param data 输入数据
     * @param actionExecutor 动作执行函数
     * @returns 执行结果列表
     */
    evaluateAndExecute(data: Record<string, unknown>, actionExecutor?: (action: WorkflowAction, data: Record<string, unknown>) => Promise<{
        success: boolean;
        output?: unknown;
        error?: string;
    }>): Promise<RuleExecutionResult[]>;
    /**
     * 评估单个规则
     */
    evaluateRule(rule: AutomationRule, data: Record<string, unknown>, actionExecutor?: (action: WorkflowAction, data: Record<string, unknown>) => Promise<{
        success: boolean;
        output?: unknown;
        error?: string;
    }>): Promise<RuleExecutionResult>;
    /**
     * 执行规则链
     * 一个规则的输出作为下一个规则的输入
     */
    executeRuleChain(initialData: Record<string, unknown>, actionExecutor?: (action: WorkflowAction, data: Record<string, unknown>) => Promise<{
        success: boolean;
        output?: unknown;
        error?: string;
    }>): Promise<RuleExecutionResult[]>;
    /** 监听事件 */
    on(event: RuleEngineEvent, callback: RuleEngineEventCallback): void;
    /** 移除监听 */
    off(event: RuleEngineEvent, callback: RuleEngineEventCallback): void;
    private emit;
    /** 获取执行历史 */
    getExecutionHistory(ruleId?: string): RuleExecutionResult[];
    /** 清除历史 */
    clearHistory(): void;
    /** 导出规则为 JSON */
    exportRules(): string;
    /** 从 JSON 导入规则 */
    importRules(json: string): AutomationRule[];
}
/** 规范化规则数据 */
export declare function normalizeRule(data: unknown): AutomationRule;
export declare const BUILTIN_RULE_TEMPLATES: RuleTemplate[];
//# sourceMappingURL=automation-rules.d.ts.map