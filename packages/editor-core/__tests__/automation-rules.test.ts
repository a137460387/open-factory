import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  RuleEngine,
  createDefaultRule,
  createConditionGroup,
  evaluateRuleConditions,
  normalizeRule,
  BUILTIN_RULE_TEMPLATES,
} from '../src/automation/automation-rules';
import type { AutomationRule, RuleTemplate } from '../src/automation/automation-rules';

describe('automation-rules', () => {
  // ============================================================
  // 工厂函数测试
  // ============================================================

  describe('工厂函数', () => {
    it('createDefaultRule 创建默认规则', () => {
      const rule = createDefaultRule('测试规则');
      expect(rule.name).toBe('测试规则');
      expect(rule.id).toBeTruthy();
      expect(rule.priority).toBe('normal');
      expect(rule.status).toBe('active');
      expect(rule.triggerMode).toBe('on-change');
      expect(rule.cooldownMs).toBe(5000);
      expect(rule.maxExecutions).toBe(0);
      expect(rule.executionCount).toBe(0);
      expect(rule.tags).toEqual([]);
    });

    it('createConditionGroup 创建条件组', () => {
      const group = createConditionGroup('or', [
        { id: 'c1', field: 'a', operator: 'equals', value: 1 },
      ]);
      expect(group.logic).toBe('or');
      expect(group.conditions).toHaveLength(1);
    });

    it('createConditionGroup 默认参数', () => {
      const group = createConditionGroup();
      expect(group.logic).toBe('and');
      expect(group.conditions).toEqual([]);
    });
  });

  // ============================================================
  // 条件评估测试
  // ============================================================

  describe('条件评估', () => {
    it('单条件组通过', () => {
      const rule = createDefaultRule('测试');
      rule.conditionGroups = [{
        logic: 'and',
        conditions: [{
          id: 'c1',
          field: 'quality',
          operator: 'less_than',
          value: 70,
        }],
      }];

      const result = evaluateRuleConditions(rule, { quality: 50 });
      expect(result.passed).toBe(true);
      expect(result.decisionLog.length).toBeGreaterThan(0);
    });

    it('单条件组不通过', () => {
      const rule = createDefaultRule('测试');
      rule.conditionGroups = [{
        logic: 'and',
        conditions: [{
          id: 'c1',
          field: 'quality',
          operator: 'less_than',
          value: 70,
        }],
      }];

      const result = evaluateRuleConditions(rule, { quality: 80 });
      expect(result.passed).toBe(false);
    });

    it('多条件组 AND 关系', () => {
      const rule = createDefaultRule('测试');
      rule.conditionGroups = [
        {
          logic: 'and',
          conditions: [{
            id: 'c1',
            field: 'type',
            operator: 'equals',
            value: 'video',
          }],
        },
        {
          logic: 'and',
          conditions: [{
            id: 'c2',
            field: 'duration',
            operator: 'greater_than',
            value: 10,
          }],
        },
      ];

      // 两个组都通过
      const result1 = evaluateRuleConditions(rule, { type: 'video', duration: 20 });
      expect(result1.passed).toBe(true);

      // 一个组不通过
      const result2 = evaluateRuleConditions(rule, { type: 'video', duration: 5 });
      expect(result2.passed).toBe(false);
    });

    it('条件组内 OR 逻辑', () => {
      const rule = createDefaultRule('测试');
      rule.conditionGroups = [{
        logic: 'or',
        conditions: [
          { id: 'c1', field: 'a', operator: 'equals', value: 1 },
          { id: 'c2', field: 'b', operator: 'equals', value: 2 },
        ],
      }];

      const result1 = evaluateRuleConditions(rule, { a: 1, b: 0 });
      expect(result1.passed).toBe(true);

      const result2 = evaluateRuleConditions(rule, { a: 0, b: 2 });
      expect(result2.passed).toBe(true);

      const result3 = evaluateRuleConditions(rule, { a: 0, b: 0 });
      expect(result3.passed).toBe(false);
    });

    it('空条件组默认通过', () => {
      const rule = createDefaultRule('测试');
      rule.conditionGroups = [];

      const result = evaluateRuleConditions(rule, {});
      expect(result.passed).toBe(true);
    });

    it('生成决策日志', () => {
      const rule = createDefaultRule('测试');
      rule.conditionGroups = [{
        logic: 'and',
        conditions: [{
          id: 'c1',
          field: 'score',
          operator: 'greater_than',
          value: 50,
        }],
      }];

      const result = evaluateRuleConditions(rule, { score: 80 });
      expect(result.decisionLog.length).toBeGreaterThan(0);
      expect(result.decisionLog.some((l) => l.includes('通过'))).toBe(true);
    });
  });

  // ============================================================
  // 规范化测试
  // ============================================================

  describe('规范化', () => {
    it('normalizeRule 处理完整数据', () => {
      const data = {
        id: 'rule-1',
        name: '测试规则',
        priority: 'high',
        status: 'active',
        conditionGroups: [{
          logic: 'and',
          conditions: [{ field: 'x', operator: 'equals', value: 1 }],
        }],
        actions: [{ type: 'notify' }],
        tags: ['test'],
      };

      const rule = normalizeRule(data);
      expect(rule.id).toBe('rule-1');
      expect(rule.name).toBe('测试规则');
      expect(rule.priority).toBe('high');
      expect(rule.conditionGroups).toHaveLength(1);
      expect(rule.actions).toHaveLength(1);
    });

    it('normalizeRule 处理空对象', () => {
      const rule = normalizeRule({});
      expect(rule.name).toBe('未命名规则');
      expect(rule.priority).toBe('normal');
      expect(rule.status).toBe('active');
    });

    it('normalizeRule 无效数据抛出错误', () => {
      expect(() => normalizeRule(null)).toThrow('无效的规则数据');
    });
  });

  // ============================================================
  // 规则引擎测试
  // ============================================================

  describe('RuleEngine', () => {
    let engine: RuleEngine;

    beforeEach(() => {
      engine = new RuleEngine({ enableDecisionLog: true });
    });

    it('注册和获取规则', () => {
      const rule = createDefaultRule('测试');
      engine.registerRule(rule);
      expect(engine.getRule(rule.id)).toBeDefined();
      expect(engine.getAllRules()).toHaveLength(1);
    });

    it('注销规则', () => {
      const rule = createDefaultRule('测试');
      engine.registerRule(rule);
      engine.unregisterRule(rule.id);
      expect(engine.getRule(rule.id)).toBeUndefined();
    });

    it('获取活跃规则按优先级排序', () => {
      const low = createDefaultRule('低');
      low.priority = 'low';
      const high = createDefaultRule('高');
      high.priority = 'high';
      const normal = createDefaultRule('普通');
      normal.priority = 'normal';

      engine.registerRule(low);
      engine.registerRule(high);
      engine.registerRule(normal);

      const active = engine.getActiveRules();
      expect(active[0].name).toBe('高');
      expect(active[1].name).toBe('普通');
      expect(active[2].name).toBe('低');
    });

    it('非活跃规则不包含在活跃列表中', () => {
      const rule = createDefaultRule('测试');
      rule.status = 'inactive';
      engine.registerRule(rule);
      expect(engine.getActiveRules()).toHaveLength(0);
    });

    it('评估并执行规则 - 条件满足', async () => {
      const rule = createDefaultRule('质量检查');
      rule.conditionGroups = [{
        logic: 'and',
        conditions: [{
          id: 'c1',
          field: 'quality',
          operator: 'less_than',
          value: 70,
        }],
      }];
      rule.actions = [{
        id: 'a1',
        type: 'apply-effect',
        params: { effect: 'enhance' },
        continueOnError: false,
      }];

      engine.registerRule(rule);

      const results = await engine.evaluateAndExecute(
        { quality: 50 },
        async (action) => ({ success: true, output: { applied: true } }),
      );

      expect(results).toHaveLength(1);
      expect(results[0].executed).toBe(true);
      expect(results[0].actionResults[0].success).toBe(true);
    });

    it('评估并执行规则 - 条件不满足', async () => {
      const rule = createDefaultRule('质量检查');
      rule.conditionGroups = [{
        logic: 'and',
        conditions: [{
          id: 'c1',
          field: 'quality',
          operator: 'less_than',
          value: 70,
        }],
      }];

      engine.registerRule(rule);

      const results = await engine.evaluateAndExecute({ quality: 90 });
      expect(results).toHaveLength(1);
      expect(results[0].executed).toBe(false);
      expect(results[0].skipReason).toBe('条件不满足');
    });

    it('冷却时间防止重复触发', async () => {
      const rule = createDefaultRule('冷却测试');
      rule.cooldownMs = 10000; // 10 秒冷却
      rule.conditionGroups = [{
        logic: 'and',
        conditions: [{
          id: 'c1',
          field: 'trigger',
          operator: 'equals',
          value: true,
        }],
      }];

      engine.registerRule(rule);

      // 第一次执行
      const results1 = await engine.evaluateAndExecute(
        { trigger: true },
        async () => ({ success: true }),
      );
      expect(results1[0].executed).toBe(true);

      // 第二次执行（应该被冷却跳过）
      const results2 = await engine.evaluateAndExecute(
        { trigger: true },
        async () => ({ success: true }),
      );
      expect(results2[0].executed).toBe(false);
      expect(results2[0].skipReason).toContain('冷却');
    });

    it('最大执行次数限制', async () => {
      const rule = createDefaultRule('次数限制');
      rule.maxExecutions = 2;
      rule.cooldownMs = 0; // 无冷却时间
      rule.conditionGroups = [{
        logic: 'and',
        conditions: [{
          id: 'c1',
          field: 'trigger',
          operator: 'equals',
          value: true,
        }],
      }];

      engine.registerRule(rule);

      const executor = async () => ({ success: true });

      // 执行 3 次
      await engine.evaluateAndExecute({ trigger: true }, executor);
      await engine.evaluateAndExecute({ trigger: true }, executor);
      const results = await engine.evaluateAndExecute({ trigger: true }, executor);

      expect(results[0].executed).toBe(false);
      expect(results[0].skipReason).toContain('最大执行次数');
    });

    it('规则链执行', async () => {
      const rule1 = createDefaultRule('第一步');
      rule1.priority = 'high';
      rule1.conditionGroups = [{
        logic: 'and',
        conditions: [{
          id: 'c1',
          field: 'start',
          operator: 'equals',
          value: true,
        }],
      }];
      rule1.actions = [{
        id: 'a1',
        type: 'notify',
        params: {},
        continueOnError: false,
      }];

      const rule2 = createDefaultRule('第二步');
      rule2.priority = 'low';
      rule2.conditionGroups = [{
        logic: 'and',
        conditions: [{
          id: 'c2',
          field: 'ruleOutput_rule_1',
          operator: 'exists',
          value: null,
        }],
      }];

      engine.registerRule(rule1);
      engine.registerRule(rule2);

      const results = await engine.executeRuleChain(
        { start: true },
        async () => ({ success: true, output: { data: 'test' } }),
      );

      // 规则链至少执行一次
      expect(results.length).toBeGreaterThan(0);
    });

    it('事件系统', async () => {
      const evaluatedCb = vi.fn();
      const triggeredCb = vi.fn();

      engine.on('rule-evaluated', evaluatedCb);
      engine.on('rule-triggered', triggeredCb);

      const rule = createDefaultRule('事件测试');
      rule.conditionGroups = [{
        logic: 'and',
        conditions: [{
          id: 'c1',
          field: 'x',
          operator: 'equals',
          value: 1,
        }],
      }];

      engine.registerRule(rule);

      await engine.evaluateAndExecute(
        { x: 1 },
        async () => ({ success: true }),
      );

      expect(evaluatedCb).toHaveBeenCalled();
      expect(triggeredCb).toHaveBeenCalled();
    });

    it('执行历史', async () => {
      const rule = createDefaultRule('历史测试');
      rule.cooldownMs = 0; // 无冷却时间
      rule.conditionGroups = [{
        logic: 'and',
        conditions: [{
          id: 'c1',
          field: 'x',
          operator: 'equals',
          value: 1,
        }],
      }];

      engine.registerRule(rule);

      await engine.evaluateAndExecute({ x: 1 }, async () => ({ success: true }));
      await engine.evaluateAndExecute({ x: 1 }, async () => ({ success: true }));

      const history = engine.getExecutionHistory();
      expect(history).toHaveLength(2);

      const ruleHistory = engine.getExecutionHistory(rule.id);
      expect(ruleHistory).toHaveLength(2);

      engine.clearHistory();
      expect(engine.getExecutionHistory()).toHaveLength(0);
    });

    it('更新规则状态', () => {
      const rule = createDefaultRule('状态测试');
      engine.registerRule(rule);

      engine.updateRuleStatus(rule.id, 'inactive');
      expect(engine.getRule(rule.id)?.status).toBe('inactive');

      engine.updateRuleStatus(rule.id, 'active');
      expect(engine.getRule(rule.id)?.status).toBe('active');
    });

    it('模板注册和使用', () => {
      const template: RuleTemplate = {
        id: 'tpl-test',
        name: '测试模板',
        description: '测试',
        category: '测试',
        rule: {
          name: '模板规则',
          priority: 'high',
          status: 'active',
          triggerMode: 'on-event',
          conditionGroups: [],
          actions: [],
          cooldownMs: 5000,
          maxExecutions: 0,
          tags: [],
        },
      };

      engine.registerTemplate(template);
      expect(engine.getAllTemplates()).toHaveLength(1);

      const rule = engine.createFromTemplate('tpl-test', '自定义名称');
      expect(rule).toBeDefined();
      expect(rule!.name).toBe('自定义名称');
      expect(rule!.priority).toBe('high');
    });

    it('导出和导入规则', () => {
      const rule = createDefaultRule('导出测试');
      rule.conditionGroups = [{
        logic: 'and',
        conditions: [{
          id: 'c1',
          field: 'x',
          operator: 'equals',
          value: 1,
        }],
      }];
      engine.registerRule(rule);

      const json = engine.exportRules();
      expect(json).toBeTruthy();

      const engine2 = new RuleEngine();
      const imported = engine2.importRules(json);
      expect(imported).toHaveLength(1);
      expect(imported[0].name).toBe('导出测试');
    });

    it('动作执行器抛出异常时捕获', async () => {
      const rule = createDefaultRule('异常测试');
      rule.conditionGroups = [{
        logic: 'and',
        conditions: [{
          id: 'c1',
          field: 'x',
          operator: 'equals',
          value: 1,
        }],
      }];
      rule.actions = [{
        id: 'a1',
        type: 'notify',
        params: {},
        continueOnError: false,
      }];

      engine.registerRule(rule);

      const results = await engine.evaluateAndExecute(
        { x: 1 },
        async () => { throw new Error('执行失败'); },
      );

      expect(results[0].executed).toBe(true);
      expect(results[0].actionResults[0].success).toBe(false);
      expect(results[0].actionResults[0].error).toBe('执行失败');
    });

    it('无动作执行器时模拟执行', async () => {
      const rule = createDefaultRule('模拟测试');
      rule.conditionGroups = [{
        logic: 'and',
        conditions: [{
          id: 'c1',
          field: 'x',
          operator: 'equals',
          value: 1,
        }],
      }];
      rule.actions = [{
        id: 'a1',
        type: 'notify',
        params: {},
        continueOnError: false,
      }];

      engine.registerRule(rule);

      const results = await engine.evaluateAndExecute({ x: 1 });

      expect(results[0].executed).toBe(true);
      expect(results[0].actionResults[0].success).toBe(true);
      expect(results[0].actionResults[0].output).toEqual({ simulated: true });
    });
  });

  // ============================================================
  // 内置规则模板测试
  // ============================================================

  describe('内置规则模板', () => {
    it('有 4 个内置模板', () => {
      expect(BUILTIN_RULE_TEMPLATES).toHaveLength(4);
    });

    it('每个模板都有必要字段', () => {
      for (const tpl of BUILTIN_RULE_TEMPLATES) {
        expect(tpl.id).toBeTruthy();
        expect(tpl.name).toBeTruthy();
        expect(tpl.description).toBeTruthy();
        expect(tpl.category).toBeTruthy();
        expect(tpl.rule.name).toBeTruthy();
        expect(tpl.rule.conditionGroups.length).toBeGreaterThan(0);
        expect(tpl.rule.actions.length).toBeGreaterThan(0);
      }
    });

    it('模板可以被引擎使用', () => {
      const engine = new RuleEngine();
      for (const tpl of BUILTIN_RULE_TEMPLATES) {
        engine.registerTemplate(tpl);
      }
      expect(engine.getAllTemplates()).toHaveLength(4);
    });

    it('从模板创建规则', () => {
      const engine = new RuleEngine();
      for (const tpl of BUILTIN_RULE_TEMPLATES) {
        engine.registerTemplate(tpl);
      }

      const rule = engine.createFromTemplate('rtpl-quality-guard');
      expect(rule).toBeDefined();
      expect(rule!.name).toBe('质量守卫');
      expect(rule!.priority).toBe('high');
    });
  });
});
