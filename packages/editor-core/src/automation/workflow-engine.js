/**
 * 自动化工作流引擎
 * 基于触发器、条件、动作的工作流定义与执行
 * 本地优先：所有执行在本地完成，不依赖云端API
 */

export {
  createDefaultTrigger,
  createDefaultCondition,
  createDefaultAction,
  createDefaultStep,
  createDefaultWorkflow,
  createExecutionContext,
  evaluateCondition,
  evaluateConditions,
} from './workflow-engine-factories';

export { validateWorkflow, normalizeWorkflow } from './workflow-engine-validation';
export { BUILTIN_TEMPLATES } from './workflow-engine-templates';

import { createExecutionContext, generateId } from './workflow-engine-factories';
import { validateWorkflow, normalizeWorkflow } from './workflow-engine-validation';
import { executeStep } from './workflow-engine-execution';

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
    if (!template) return undefined;

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
    if (index >= 0) listeners.splice(index, 1);
  }

  emit(event, data) {
    const listeners = this.eventListeners.get(event) || [];
    for (const cb of listeners) {
      try {
        cb(event, data);
      } catch {
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

    const deps = {
      emit: (event, data) => this.emit(event, data),
      log: (ctx, level, msg, stepId, actionId, details) => this.log(ctx, level, msg, stepId, actionId, details),
      actionExecutors: this.actionExecutors,
      config: this.config,
    };

    try {
      for (let i = 0; i < workflow.steps.length; i++) {
        if (context.status === 'cancelled') {
          this.log(context, 'info', '工作流已被取消');
          break;
        }

        while (context.status === 'paused') {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }

        context.currentStepIndex = i;
        const step = workflow.steps[i];
        await executeStep(deps, step, context, workflow);
      }

      if (context.status !== 'cancelled') {
        context.status = 'completed';
        context.endTime = Date.now();
        this.emit('workflow-completed', { workflow, context });
        this.log(context, 'info', `工作流执行完成，耗时 ${context.endTime - context.startTime}ms`);
      }
    } catch (error) {
      context.status = 'failed';
      context.endTime = Date.now();
      const message = error instanceof Error ? error.message : String(error);
      this.log(context, 'error', `工作流执行失败: ${message}`);
      this.emit('workflow-failed', { workflow, context, error });
    } finally {
      this.runningExecutions.delete(context.executionId);
    }

    return context;
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
    if (!workflow) return undefined;
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
