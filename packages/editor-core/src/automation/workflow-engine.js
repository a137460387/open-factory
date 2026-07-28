/**
 * 自动化工作流引擎
 * 基于触发器、条件、动作的工作流定义与执行
 * 本地优先：所有执行在本地完成，不依赖云端API
 */
// ============================================================
// 工厂函数
// ============================================================
let _nextId = 1;
function generateId(prefix) {
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
// ============================================================
// 条件评估
// ============================================================
/** 获取嵌套字段值 */
function getFieldValue(obj, path) {
    const parts = path.split('.');
    let current = obj;
    for (const part of parts) {
        if (current == null || typeof current !== 'object')
            return undefined;
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
    if (conditions.length === 0)
        return true;
    let result = evaluateCondition(conditions[0], data);
    for (let i = 1; i < conditions.length; i++) {
        const condition = conditions[i];
        const conditionResult = evaluateCondition(condition, data);
        if (condition.logic === 'or') {
            result = result || conditionResult;
        }
        else {
            result = result && conditionResult;
        }
    }
    return result;
}
/** 创建默认引擎配置 */
export function createDefaultEngineConfig() {
    return {
        maxConcurrentExecutions: 3,
        defaultActionTimeout: 30000,
        verboseLogging: false,
    };
}
/**
 * 自动化工作流引擎
 * 负责工作流的注册、触发、执行和监控
 */
export class WorkflowEngine {
    workflows = new Map();
    templates = new Map();
    executions = new Map();
    actionExecutors = new Map();
    triggerListeners = new Map();
    eventListeners = new Map();
    config;
    runningExecutions = new Set();
    constructor(config = {}) {
        this.config = { ...createDefaultEngineConfig(), ...config };
    }
    // ------ 工作流管理 ------
    /** 注册工作流 */
    registerWorkflow(workflow) {
        const validated = validateWorkflow(workflow);
        this.workflows.set(validated.id, validated);
        // 注册触发器
        for (const trigger of validated.triggers) {
            if (trigger.enabled) {
                this.registerTrigger(trigger, validated.id);
            }
        }
    }
    /** 注销工作流 */
    unregisterWorkflow(workflowId) {
        const workflow = this.workflows.get(workflowId);
        if (workflow) {
            for (const trigger of workflow.triggers) {
                this.unregisterTrigger(trigger.id);
            }
            this.workflows.delete(workflowId);
        }
    }
    /** 获取工作流 */
    getWorkflow(workflowId) {
        return this.workflows.get(workflowId);
    }
    /** 获取所有工作流 */
    getAllWorkflows() {
        return Array.from(this.workflows.values());
    }
    // ------ 模板管理 ------
    /** 注册模板 */
    registerTemplate(template) {
        this.templates.set(template.id, template);
    }
    /** 获取模板 */
    getTemplate(templateId) {
        return this.templates.get(templateId);
    }
    /** 获取所有模板 */
    getAllTemplates() {
        return Array.from(this.templates.values());
    }
    /** 从模板创建工作流 */
    createFromTemplate(templateId, name) {
        const template = this.templates.get(templateId);
        if (!template)
            return undefined;
        const workflow = {
            ...template.workflow,
            id: generateId('workflow'),
            name: name || template.workflow.name,
            createdAt: Date.now(),
            updatedAt: Date.now(),
        };
        this.registerWorkflow(workflow);
        return workflow;
    }
    // ------ 动作执行器注册 ------
    /** 注册动作执行器 */
    registerActionExecutor(executor) {
        this.actionExecutors.set(executor.type, executor);
    }
    // ------ 触发器管理 ------
    registerTrigger(trigger, workflowId) {
        const listener = this.triggerListeners.get(trigger.type);
        if (listener) {
            listener.register(trigger, (data) => {
                this.executeWorkflow(workflowId, data);
            });
        }
    }
    unregisterTrigger(triggerId) {
        for (const listener of this.triggerListeners.values()) {
            listener.unregister(triggerId);
        }
    }
    /** 注册触发器监听器 */
    registerTriggerListener(listener) {
        this.triggerListeners.set(listener.type, listener);
    }
    // ------ 事件系统 ------
    /** 监听引擎事件 */
    on(event, callback) {
        const listeners = this.eventListeners.get(event) || [];
        listeners.push(callback);
        this.eventListeners.set(event, listeners);
    }
    /** 移除事件监听 */
    off(event, callback) {
        const listeners = this.eventListeners.get(event) || [];
        const index = listeners.indexOf(callback);
        if (index >= 0)
            listeners.splice(index, 1);
    }
    emit(event, data) {
        const listeners = this.eventListeners.get(event) || [];
        for (const cb of listeners) {
            try {
                cb(event, data);
            }
            catch {
                /* 忽略监听器错误 */
            }
        }
    }
    // ------ 工作流执行 ------
    /** 手动执行工作流 */
    async executeWorkflow(workflowId, triggerData = {}) {
        const workflow = this.workflows.get(workflowId);
        if (!workflow) {
            throw new Error(`工作流不存在: ${workflowId}`);
        }
        if (!workflow.enabled) {
            throw new Error(`工作流已禁用: ${workflowId}`);
        }
        if (this.runningExecutions.size >= this.config.maxConcurrentExecutions) {
            throw new Error('已达到最大并发执行数');
        }
        const context = createExecutionContext(workflowId, triggerData);
        this.executions.set(context.executionId, context);
        this.runningExecutions.add(context.executionId);
        context.status = 'running';
        this.emit('workflow-started', { workflow, context });
        this.log(context, 'info', `工作流 "${workflow.name}" 开始执行`);
        try {
            for (let i = 0; i < workflow.steps.length; i++) {
                // 检查是否被取消
                if (context.status === 'cancelled') {
                    this.log(context, 'info', '工作流已被取消');
                    break;
                }
                // 检查是否被暂停
                while (context.status === 'paused') {
                    await new Promise((resolve) => setTimeout(resolve, 100));
                }
                context.currentStepIndex = i;
                const step = workflow.steps[i];
                await this.executeStep(step, context, workflow);
            }
            if (context.status !== 'cancelled') {
                context.status = 'completed';
                context.endTime = Date.now();
                this.emit('workflow-completed', { workflow, context });
                this.log(context, 'info', `工作流执行完成，耗时 ${context.endTime - context.startTime}ms`);
            }
        }
        catch (error) {
            context.status = 'failed';
            context.endTime = Date.now();
            const message = error instanceof Error ? error.message : String(error);
            this.log(context, 'error', `工作流执行失败: ${message}`);
            this.emit('workflow-failed', { workflow, context, error });
        }
        finally {
            this.runningExecutions.delete(context.executionId);
        }
        return context;
    }
    /** 执行单个步骤 */
    async executeStep(step, context, workflow) {
        const stepResult = {
            stepId: step.id,
            status: 'running',
            startTime: Date.now(),
            actionResults: [],
        };
        context.stepResults.set(step.id, stepResult);
        this.emit('step-started', { step, context });
        this.log(context, 'info', `执行步骤: ${step.name}`, step.id);
        // 评估条件
        const conditionData = {
            ...context.triggerData,
            variables: Object.fromEntries(context.variables),
        };
        if (!evaluateConditions(step.conditions, conditionData)) {
            stepResult.status = 'skipped';
            stepResult.endTime = Date.now();
            this.emit('step-skipped', { step, context });
            this.log(context, 'info', `步骤 "${step.name}" 条件不满足，跳过`, step.id);
            return;
        }
        // 执行动作
        let hasError = false;
        for (const action of step.actions) {
            const actionResult = await this.executeAction(action, context);
            stepResult.actionResults.push(actionResult);
            if (actionResult.status === 'failed') {
                hasError = true;
                if (!action.continueOnError && !step.skipOnError) {
                    stepResult.status = 'failed';
                    stepResult.endTime = Date.now();
                    stepResult.error = actionResult.error;
                    this.emit('step-failed', { step, context, error: actionResult.error });
                    throw new Error(`步骤 "${step.name}" 的动作失败: ${actionResult.error}`);
                }
            }
        }
        stepResult.status = hasError ? 'failed' : 'completed';
        stepResult.endTime = Date.now();
        if (hasError) {
            this.emit('step-failed', { step, context });
        }
        else {
            this.emit('step-completed', { step, context });
        }
    }
    /** 执行单个动作 */
    async executeAction(action, context) {
        const executor = this.actionExecutors.get(action.type);
        if (!executor) {
            return {
                actionId: action.id,
                status: 'failed',
                error: `未注册的动作执行器: ${action.type}`,
                reason: `系统中没有找到类型为 "${action.type}" 的动作执行器`,
            };
        }
        // 验证参数
        if (executor.validate) {
            const validation = executor.validate(action.params);
            if (!validation.valid) {
                return {
                    actionId: action.id,
                    status: 'failed',
                    error: `参数验证失败: ${validation.errors.join(', ')}`,
                    reason: `动作参数不符合要求: ${validation.errors.join('; ')}`,
                };
            }
        }
        this.emit('action-started', { action, context });
        this.log(context, 'debug', `执行动作: ${action.type}`, undefined, action.id);
        const timeout = action.timeout || this.config.defaultActionTimeout;
        try {
            const resultPromise = executor.execute(action, context);
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error(`动作执行超时 (${timeout}ms)`)), timeout);
            });
            const result = await Promise.race([resultPromise, timeoutPromise]);
            this.emit('action-completed', { action, result, context });
            return result;
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            const result = {
                actionId: action.id,
                status: 'failed',
                error: message,
                reason: `动作执行异常: ${message}`,
            };
            this.emit('action-failed', { action, result, context });
            return result;
        }
    }
    // ------ 执行控制 ------
    /** 暂停工作流 */
    pauseExecution(executionId) {
        const context = this.executions.get(executionId);
        if (context && context.status === 'running') {
            context.status = 'paused';
            this.emit('workflow-paused', { context });
            this.log(context, 'info', '工作流已暂停');
            return true;
        }
        return false;
    }
    /** 恢复工作流 */
    resumeExecution(executionId) {
        const context = this.executions.get(executionId);
        if (context && context.status === 'paused') {
            context.status = 'running';
            this.emit('workflow-resumed', { context });
            this.log(context, 'info', '工作流已恢复');
            return true;
        }
        return false;
    }
    /** 取消工作流 */
    cancelExecution(executionId) {
        const context = this.executions.get(executionId);
        if (context && (context.status === 'running' || context.status === 'paused')) {
            context.status = 'cancelled';
            context.endTime = Date.now();
            this.emit('workflow-cancelled', { context });
            this.log(context, 'info', '工作流已取消');
            return true;
        }
        return false;
    }
    /** 获取执行上下文 */
    getExecution(executionId) {
        return this.executions.get(executionId);
    }
    /** 获取工作流的所有执行记录 */
    getExecutionsForWorkflow(workflowId) {
        return Array.from(this.executions.values()).filter((ctx) => ctx.workflowId === workflowId);
    }
    // ------ 日志 ------
    log(context, level, message, stepId, actionId, details) {
        const entry = {
            timestamp: Date.now(),
            level,
            message,
            stepId,
            actionId,
            details,
        };
        context.logs.push(entry);
        if (this.config.verboseLogging || level === 'error') {
            this.emit('log', entry);
        }
    }
    // ------ 序列化 ------
    /** 导出工作流为 JSON */
    exportWorkflow(workflowId) {
        const workflow = this.workflows.get(workflowId);
        if (!workflow)
            return undefined;
        return JSON.stringify(workflow, null, 2);
    }
    /** 从 JSON 导入工作流 */
    importWorkflow(json) {
        const data = JSON.parse(json);
        const workflow = normalizeWorkflow(data);
        this.registerWorkflow(workflow);
        return workflow;
    }
}
// ============================================================
// 验证与规范化
// ============================================================
/** 验证工作流 */
export function validateWorkflow(workflow) {
    if (!workflow.id)
        throw new Error('工作流缺少 ID');
    if (!workflow.name)
        throw new Error('工作流缺少名称');
    if (!workflow.version)
        throw new Error('工作流缺少版本号');
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
export function normalizeWorkflow(data) {
    if (!data || typeof data !== 'object') {
        throw new Error('无效的工作流数据');
    }
    const obj = data;
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
        tags: Array.isArray(obj.tags) ? obj.tags.filter((t) => typeof t === 'string') : [],
    };
}
function normalizeTrigger(data) {
    if (!data || typeof data !== 'object')
        return createDefaultTrigger();
    const obj = data;
    return {
        id: typeof obj.id === 'string' ? obj.id : generateId('trigger'),
        type: typeof obj.type === 'string' ? obj.type : 'manual',
        params: typeof obj.params === 'object' && obj.params !== null ? obj.params : {},
        enabled: typeof obj.enabled === 'boolean' ? obj.enabled : true,
    };
}
function normalizeStep(data) {
    if (!data || typeof data !== 'object')
        return createDefaultStep();
    const obj = data;
    return {
        id: typeof obj.id === 'string' ? obj.id : generateId('step'),
        name: typeof obj.name === 'string' ? obj.name : '未命名步骤',
        description: typeof obj.description === 'string' ? obj.description : undefined,
        conditions: Array.isArray(obj.conditions) ? obj.conditions.map(normalizeCondition) : [],
        actions: Array.isArray(obj.actions) ? obj.actions.map(normalizeAction) : [],
        skipOnError: typeof obj.skipOnError === 'boolean' ? obj.skipOnError : false,
    };
}
function normalizeCondition(data) {
    if (!data || typeof data !== 'object')
        return createDefaultCondition();
    const obj = data;
    return {
        id: typeof obj.id === 'string' ? obj.id : generateId('condition'),
        field: typeof obj.field === 'string' ? obj.field : '',
        operator: typeof obj.operator === 'string' ? obj.operator : 'equals',
        value: obj.value,
        logic: obj.logic === 'or' ? 'or' : 'and',
    };
}
function normalizeAction(data) {
    if (!data || typeof data !== 'object')
        return createDefaultAction();
    const obj = data;
    return {
        id: typeof obj.id === 'string' ? obj.id : generateId('action'),
        type: typeof obj.type === 'string' ? obj.type : 'notify',
        params: typeof obj.params === 'object' && obj.params !== null ? obj.params : {},
        continueOnError: typeof obj.continueOnError === 'boolean' ? obj.continueOnError : false,
        timeout: typeof obj.timeout === 'number' ? obj.timeout : undefined,
    };
}
// ============================================================
// 内置模板
// ============================================================
/** 内置工作流模板 */
export const BUILTIN_TEMPLATES = [
    {
        id: 'tpl-auto-quality-fix',
        name: '自动质量修复',
        description: '当素材质量低于阈值时自动应用修复效果',
        category: '质量',
        workflow: {
            name: '自动质量修复',
            description: '检测低质量素材并自动应用修复',
            version: '1.0.0',
            triggers: [
                {
                    id: 'trigger-quality',
                    type: 'scene-detected',
                    params: { afterAnalysis: true },
                    enabled: true,
                },
            ],
            steps: [
                {
                    id: 'step-check',
                    name: '检查质量分数',
                    conditions: [
                        {
                            id: 'cond-quality',
                            field: 'scene.quality',
                            operator: 'less_than',
                            value: 70,
                        },
                    ],
                    actions: [
                        {
                            id: 'action-fix',
                            type: 'apply-effect',
                            params: { effectType: 'quality-enhance', intensity: 0.8 },
                            continueOnError: false,
                        },
                    ],
                    skipOnError: false,
                },
            ],
            enabled: true,
            tags: ['质量', '自动修复'],
        },
    },
    {
        id: 'tpl-auto-subtitle',
        name: '自动字幕生成',
        description: '导入媒体后自动生成字幕',
        category: '字幕',
        workflow: {
            name: '自动字幕生成',
            description: '为导入的视频自动生成字幕',
            version: '1.0.0',
            triggers: [
                {
                    id: 'trigger-import',
                    type: 'media-import',
                    params: { mediaTypes: ['video'] },
                    enabled: true,
                },
            ],
            steps: [
                {
                    id: 'step-analyze',
                    name: '分析音频',
                    conditions: [],
                    actions: [
                        {
                            id: 'action-transcribe',
                            type: 'analyze-scene',
                            params: { analysisType: 'transcription' },
                            continueOnError: false,
                        },
                    ],
                    skipOnError: false,
                },
                {
                    id: 'step-subtitle',
                    name: '生成字幕',
                    conditions: [],
                    actions: [
                        {
                            id: 'action-add-sub',
                            type: 'add-subtitle',
                            params: { style: 'default' },
                            continueOnError: true,
                        },
                    ],
                    skipOnError: true,
                },
            ],
            enabled: true,
            tags: ['字幕', '自动'],
        },
    },
    {
        id: 'tpl-smart-cut',
        name: '智能剪辑流程',
        description: '自动分析场景并执行智能剪辑',
        category: '剪辑',
        workflow: {
            name: '智能剪辑流程',
            description: '从场景分析到智能剪辑的完整流程',
            version: '1.0.0',
            triggers: [
                {
                    id: 'trigger-manual',
                    type: 'manual',
                    params: {},
                    enabled: true,
                },
            ],
            steps: [
                {
                    id: 'step-scene',
                    name: '场景分析',
                    conditions: [],
                    actions: [
                        {
                            id: 'action-analyze',
                            type: 'analyze-scene',
                            params: { detectScenes: true, generateTags: true },
                            continueOnError: false,
                        },
                    ],
                    skipOnError: false,
                },
                {
                    id: 'step-cut',
                    name: '智能剪辑',
                    conditions: [
                        {
                            id: 'cond-has-scenes',
                            field: 'analysis.sceneCount',
                            operator: 'greater_than',
                            value: 0,
                        },
                    ],
                    actions: [
                        {
                            id: 'action-cut',
                            type: 'auto-cut',
                            params: { strategy: 'highlight', maxDuration: 60 },
                            continueOnError: false,
                        },
                    ],
                    skipOnError: false,
                },
                {
                    id: 'step-grade',
                    name: '自动调色',
                    conditions: [],
                    actions: [
                        {
                            id: 'action-grade',
                            type: 'apply-color-grade',
                            params: { preset: 'cinematic' },
                            continueOnError: true,
                        },
                    ],
                    skipOnError: true,
                },
            ],
            enabled: true,
            tags: ['剪辑', '智能', '完整流程'],
        },
    },
];
//# sourceMappingURL=workflow-engine.js.map