import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  WorkflowEngine,
  createDefaultWorkflow,
  createDefaultStep,
  createDefaultTrigger,
  createDefaultAction,
  createDefaultCondition,
  createExecutionContext,
  evaluateCondition,
  evaluateConditions,
  validateWorkflow,
  normalizeWorkflow,
  BUILTIN_TEMPLATES,
} from '../src/automation/workflow-engine';
import type {
  Workflow,
  WorkflowAction,
  ActionExecutor,
  WorkflowTemplate,
} from '../src/automation/workflow-engine';

describe('workflow-engine', () => {
  // ============================================================
  // 工厂函数测试
  // ============================================================

  describe('工厂函数', () => {
    it('createDefaultWorkflow 创建默认工作流', () => {
      const wf = createDefaultWorkflow('测试工作流');
      expect(wf.name).toBe('测试工作流');
      expect(wf.id).toBeTruthy();
      expect(wf.version).toBe('1.0.0');
      expect(wf.enabled).toBe(true);
      expect(wf.triggers).toHaveLength(1);
      expect(wf.steps).toHaveLength(0);
      expect(wf.tags).toEqual([]);
      expect(wf.createdAt).toBeGreaterThan(0);
      expect(wf.updatedAt).toBeGreaterThan(0);
    });

    it('createDefaultStep 创建默认步骤', () => {
      const step = createDefaultStep('我的步骤');
      expect(step.name).toBe('我的步骤');
      expect(step.id).toBeTruthy();
      expect(step.conditions).toEqual([]);
      expect(step.actions).toEqual([]);
      expect(step.skipOnError).toBe(false);
    });

    it('createDefaultTrigger 创建默认触发器', () => {
      const trigger = createDefaultTrigger('media-import');
      expect(trigger.type).toBe('media-import');
      expect(trigger.enabled).toBe(true);
      expect(trigger.params).toEqual({});
    });

    it('createDefaultAction 创建默认动作', () => {
      const action = createDefaultAction('apply-effect');
      expect(action.type).toBe('apply-effect');
      expect(action.continueOnError).toBe(false);
    });

    it('createDefaultCondition 创建默认条件', () => {
      const cond = createDefaultCondition();
      expect(cond.operator).toBe('equals');
      expect(cond.logic).toBe('and');
    });

    it('createExecutionContext 创建执行上下文', () => {
      const ctx = createExecutionContext('wf-1', { foo: 'bar' });
      expect(ctx.workflowId).toBe('wf-1');
      expect(ctx.status).toBe('idle');
      expect(ctx.triggerData.foo).toBe('bar');
      expect(ctx.currentStepIndex).toBe(0);
      expect(ctx.logs).toEqual([]);
    });
  });

  // ============================================================
  // 条件评估测试
  // ============================================================

  describe('条件评估', () => {
    it('equals 条件', () => {
      const cond = { id: '1', field: 'name', operator: 'equals' as const, value: 'test' };
      expect(evaluateCondition(cond, { name: 'test' })).toBe(true);
      expect(evaluateCondition(cond, { name: 'other' })).toBe(false);
    });

    it('not_equals 条件', () => {
      const cond = { id: '1', field: 'name', operator: 'not_equals' as const, value: 'test' };
      expect(evaluateCondition(cond, { name: 'other' })).toBe(true);
      expect(evaluateCondition(cond, { name: 'test' })).toBe(false);
    });

    it('greater_than 条件', () => {
      const cond = { id: '1', field: 'score', operator: 'greater_than' as const, value: 70 };
      expect(evaluateCondition(cond, { score: 80 })).toBe(true);
      expect(evaluateCondition(cond, { score: 60 })).toBe(false);
      expect(evaluateCondition(cond, { score: 70 })).toBe(false);
    });

    it('less_than 条件', () => {
      const cond = { id: '1', field: 'score', operator: 'less_than' as const, value: 70 };
      expect(evaluateCondition(cond, { score: 60 })).toBe(true);
      expect(evaluateCondition(cond, { score: 80 })).toBe(false);
    });

    it('contains 条件', () => {
      const cond = { id: '1', field: 'title', operator: 'contains' as const, value: 'hello' };
      expect(evaluateCondition(cond, { title: 'hello world' })).toBe(true);
      expect(evaluateCondition(cond, { title: 'goodbye' })).toBe(false);
    });

    it('in 条件', () => {
      const cond = { id: '1', field: 'type', operator: 'in' as const, value: ['video', 'image'] };
      expect(evaluateCondition(cond, { type: 'video' })).toBe(true);
      expect(evaluateCondition(cond, { type: 'audio' })).toBe(false);
    });

    it('exists 条件', () => {
      const cond = { id: '1', field: 'meta', operator: 'exists' as const, value: null };
      expect(evaluateCondition(cond, { meta: {} })).toBe(true);
      expect(evaluateCondition(cond, {})).toBe(false);
      expect(evaluateCondition(cond, { meta: null })).toBe(false);
    });

    it('嵌套字段访问', () => {
      const cond = { id: '1', field: 'media.quality', operator: 'less_than' as const, value: 50 };
      expect(evaluateCondition(cond, { media: { quality: 30 } })).toBe(true);
      expect(evaluateCondition(cond, { media: { quality: 80 } })).toBe(false);
    });

    it('evaluateConditions 多条件 AND', () => {
      const conditions = [
        { id: '1', field: 'a', operator: 'equals' as const, value: 1 },
        { id: '2', field: 'b', operator: 'greater_than' as const, value: 5 },
      ];
      expect(evaluateConditions(conditions, { a: 1, b: 10 })).toBe(true);
      expect(evaluateConditions(conditions, { a: 1, b: 3 })).toBe(false);
    });

    it('evaluateConditions 多条件 OR', () => {
      const conditions = [
        { id: '1', field: 'a', operator: 'equals' as const, value: 1 },
        { id: '2', field: 'b', operator: 'equals' as const, value: 2, logic: 'or' as const },
      ];
      expect(evaluateConditions(conditions, { a: 1, b: 0 })).toBe(true);
      expect(evaluateConditions(conditions, { a: 0, b: 2 })).toBe(true);
      expect(evaluateConditions(conditions, { a: 0, b: 0 })).toBe(false);
    });

    it('空条件列表默认通过', () => {
      expect(evaluateConditions([], {})).toBe(true);
    });
  });

  // ============================================================
  // 验证与规范化测试
  // ============================================================

  describe('验证与规范化', () => {
    it('validateWorkflow 补全缺失 ID', () => {
      const wf = createDefaultWorkflow();
      wf.steps = [{
        ...createDefaultStep(),
        id: '',
        conditions: [{ ...createDefaultCondition(), id: '' }],
        actions: [{ ...createDefaultAction(), id: '' }],
      }];
      wf.triggers = [{ ...createDefaultTrigger(), id: '' }];

      const validated = validateWorkflow(wf);
      expect(validated.triggers[0].id).toBeTruthy();
      expect(validated.steps[0].id).toBeTruthy();
      expect(validated.steps[0].conditions[0].id).toBeTruthy();
      expect(validated.steps[0].actions[0].id).toBeTruthy();
    });

    it('validateWorkflow 缺少名称时抛出错误', () => {
      const wf = createDefaultWorkflow();
      wf.name = '';
      expect(() => validateWorkflow(wf)).toThrow('工作流缺少名称');
    });

    it('normalizeWorkflow 处理空对象', () => {
      const wf = normalizeWorkflow({});
      expect(wf.name).toBe('未命名工作流');
      expect(wf.version).toBe('1.0.0');
      expect(wf.enabled).toBe(true);
      expect(wf.triggers).toHaveLength(1);
      expect(wf.steps).toHaveLength(0);
    });

    it('normalizeWorkflow 处理完整数据', () => {
      const data = {
        id: 'wf-test',
        name: '测试',
        version: '2.0.0',
        triggers: [{ type: 'media-import' }],
        steps: [{
          name: '步骤1',
          conditions: [{ field: 'x', operator: 'equals', value: 1 }],
          actions: [{ type: 'notify' }],
        }],
        enabled: false,
        tags: ['tag1'],
      };
      const wf = normalizeWorkflow(data);
      expect(wf.id).toBe('wf-test');
      expect(wf.name).toBe('测试');
      expect(wf.enabled).toBe(false);
      expect(wf.triggers[0].type).toBe('media-import');
      expect(wf.steps[0].conditions[0].field).toBe('x');
      expect(wf.steps[0].actions[0].type).toBe('notify');
      expect(wf.tags).toEqual(['tag1']);
    });

    it('normalizeWorkflow 无效数据抛出错误', () => {
      expect(() => normalizeWorkflow(null)).toThrow('无效的工作流数据');
    });
  });

  // ============================================================
  // 工作流引擎测试
  // ============================================================

  describe('WorkflowEngine', () => {
    let engine: WorkflowEngine;

    beforeEach(() => {
      engine = new WorkflowEngine({ verboseLogging: false });
    });

    it('注册和获取工作流', () => {
      const wf = createDefaultWorkflow('测试');
      engine.registerWorkflow(wf);
      expect(engine.getWorkflow(wf.id)).toBeDefined();
      expect(engine.getAllWorkflows()).toHaveLength(1);
    });

    it('注销工作流', () => {
      const wf = createDefaultWorkflow('测试');
      engine.registerWorkflow(wf);
      engine.unregisterWorkflow(wf.id);
      expect(engine.getWorkflow(wf.id)).toBeUndefined();
    });

    it('执行简单工作流', async () => {
      const wf = createDefaultWorkflow('简单流程');
      wf.steps = [
        createDefaultStep('步骤1'),
        createDefaultStep('步骤2'),
      ];

      engine.registerWorkflow(wf);
      const ctx = await engine.executeWorkflow(wf.id);

      expect(ctx.status).toBe('completed');
      expect(ctx.logs.length).toBeGreaterThan(0);
      expect(ctx.endTime).toBeGreaterThanOrEqual(ctx.startTime);
    });

    it('执行带条件的工作流', async () => {
      const wf = createDefaultWorkflow('条件流程');
      wf.steps = [
        {
          ...createDefaultStep('条件步骤'),
          conditions: [{
            id: 'c1',
            field: 'value',
            operator: 'greater_than',
            value: 50,
          }],
        },
      ];

      engine.registerWorkflow(wf);

      // 条件满足
      const ctx1 = await engine.executeWorkflow(wf.id, { value: 80 });
      expect(ctx1.status).toBe('completed');

      // 条件不满足 - 步骤被跳过
      const ctx2 = await engine.executeWorkflow(wf.id, { value: 30 });
      expect(ctx2.status).toBe('completed');
    });

    it('执行带动作执行器的工作流', async () => {
      const executor: ActionExecutor = {
        type: 'notify',
        execute: async (action, ctx) => ({
          actionId: action.id,
          status: 'completed',
          output: { message: '通知已发送' },
          reason: '执行通知动作',
        }),
      };

      engine.registerActionExecutor(executor);

      const wf = createDefaultWorkflow('动作流程');
      wf.steps = [{
        ...createDefaultStep('发送通知'),
        actions: [{
          id: 'a1',
          type: 'notify',
          params: { message: '测试' },
          continueOnError: false,
        }],
      }];

      engine.registerWorkflow(wf);
      const ctx = await engine.executeWorkflow(wf.id);

      expect(ctx.status).toBe('completed');
      const stepResult = ctx.stepResults.get(wf.steps[0].id);
      expect(stepResult?.actionResults[0].status).toBe('completed');
      expect(stepResult?.actionResults[0].output).toEqual({ message: '通知已发送' });
    });

    it('暂停和恢复执行', async () => {
      const wf = createDefaultWorkflow('暂停测试');
      // 添加一个需要一些时间的步骤
      const executor: ActionExecutor = {
        type: 'custom',
        execute: async () => {
          await new Promise((r) => setTimeout(r, 200));
          return { actionId: 'a1', status: 'completed' as const };
        },
      };
      engine.registerActionExecutor(executor);

      wf.steps = [{
        ...createDefaultStep('慢步骤'),
        actions: [{ id: 'a1', type: 'custom', params: {}, continueOnError: false }],
      }];

      engine.registerWorkflow(wf);

      // 启动执行（异步）
      const execPromise = engine.executeWorkflow(wf.id);

      // 等一下让执行开始
      await new Promise((r) => setTimeout(r, 50));

      // 获取执行 ID（从 executions map 中）
      const executions = engine.getExecutionsForWorkflow(wf.id);
      if (executions.length > 0) {
        const execId = executions[0].executionId;

        // 暂停
        engine.pauseExecution(execId);
        expect(executions[0].status).toBe('paused');

        // 恢复
        engine.resumeExecution(execId);
      }

      const ctx = await execPromise;
      expect(ctx.status).toBe('completed');
    });

    it('取消执行', async () => {
      const executor: ActionExecutor = {
        type: 'custom',
        execute: async () => {
          await new Promise((r) => setTimeout(r, 500));
          return { actionId: 'a1', status: 'completed' as const };
        },
      };
      engine.registerActionExecutor(executor);

      const wf = createDefaultWorkflow('取消测试');
      wf.steps = [
        {
          ...createDefaultStep('慢步骤'),
          actions: [{ id: 'a1', type: 'custom', params: {}, continueOnError: false }],
        },
        {
          ...createDefaultStep('第二步'),
          actions: [{ id: 'a2', type: 'custom', params: {}, continueOnError: false }],
        },
      ];

      engine.registerWorkflow(wf);

      const execPromise = engine.executeWorkflow(wf.id);
      await new Promise((r) => setTimeout(r, 50));

      const executions = engine.getExecutionsForWorkflow(wf.id);
      if (executions.length > 0) {
        engine.cancelExecution(executions[0].executionId);
      }

      const ctx = await execPromise;
      expect(ctx.status).toBe('cancelled');
    });

    it('禁用的工作流不能执行', async () => {
      const wf = createDefaultWorkflow('禁用');
      wf.enabled = false;
      engine.registerWorkflow(wf);

      await expect(engine.executeWorkflow(wf.id)).rejects.toThrow('工作流已禁用');
    });

    it('不存在的工作流不能执行', async () => {
      await expect(engine.executeWorkflow('不存在')).rejects.toThrow('工作流不存在');
    });

    it('事件系统', async () => {
      const startedCb = vi.fn();
      const completedCb = vi.fn();

      engine.on('workflow-started', startedCb);
      engine.on('workflow-completed', completedCb);

      const wf = createDefaultWorkflow('事件测试');
      engine.registerWorkflow(wf);
      await engine.executeWorkflow(wf.id);

      expect(startedCb).toHaveBeenCalledTimes(1);
      expect(completedCb).toHaveBeenCalledTimes(1);
    });

    it('导出和导入工作流', () => {
      const wf = createDefaultWorkflow('导出测试');
      wf.steps = [createDefaultStep('步骤1')];
      engine.registerWorkflow(wf);

      const json = engine.exportWorkflow(wf.id);
      expect(json).toBeTruthy();

      // 在新引擎中导入
      const engine2 = new WorkflowEngine();
      const imported = engine2.importWorkflow(json!);
      expect(imported.name).toBe('导出测试');
      expect(imported.steps).toHaveLength(1);
    });

    it('模板注册和使用', () => {
      const template: WorkflowTemplate = {
        id: 'tpl-test',
        name: '测试模板',
        description: '测试',
        category: '测试',
        workflow: {
          name: '模板工作流',
          version: '1.0.0',
          triggers: [createDefaultTrigger()],
          steps: [createDefaultStep('步骤1')],
          enabled: true,
          tags: [],
        },
      };

      engine.registerTemplate(template);
      expect(engine.getAllTemplates()).toHaveLength(1);

      const wf = engine.createFromTemplate('tpl-test', '从模板创建');
      expect(wf).toBeDefined();
      expect(wf!.name).toBe('从模板创建');
      expect(engine.getAllWorkflows()).toHaveLength(1);
    });

    it('注册未注册的动作执行器会失败', async () => {
      const executor: ActionExecutor = {
        type: 'notify',
        execute: async (action) => ({
          actionId: action.id,
          status: 'completed' as const,
        }),
      };
      engine.registerActionExecutor(executor);

      const wf = createDefaultWorkflow('执行器测试');
      wf.steps = [{
        ...createDefaultStep('步骤'),
        actions: [
          { id: 'a1', type: 'notify', params: {}, continueOnError: true },
          { id: 'a2', type: 'export', params: {}, continueOnError: true },
        ],
      }];

      engine.registerWorkflow(wf);
      const ctx = await engine.executeWorkflow(wf.id);

      const stepResult = ctx.stepResults.get(wf.steps[0].id);
      expect(stepResult?.actionResults[0].status).toBe('completed');
      expect(stepResult?.actionResults[1].status).toBe('failed');
    });
  });

  // ============================================================
  // 内置模板测试
  // ============================================================

  describe('内置模板', () => {
    it('有 3 个内置模板', () => {
      expect(BUILTIN_TEMPLATES).toHaveLength(3);
    });

    it('每个模板都有必要字段', () => {
      for (const tpl of BUILTIN_TEMPLATES) {
        expect(tpl.id).toBeTruthy();
        expect(tpl.name).toBeTruthy();
        expect(tpl.description).toBeTruthy();
        expect(tpl.category).toBeTruthy();
        expect(tpl.workflow.name).toBeTruthy();
        expect(tpl.workflow.triggers.length).toBeGreaterThan(0);
        expect(tpl.workflow.steps.length).toBeGreaterThan(0);
      }
    });

    it('模板可以被引擎使用', () => {
      const engine = new WorkflowEngine();
      for (const tpl of BUILTIN_TEMPLATES) {
        engine.registerTemplate(tpl);
      }
      expect(engine.getAllTemplates()).toHaveLength(3);
    });
  });
});
