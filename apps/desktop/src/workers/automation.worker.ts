/**
 * 自动化工作流 Worker
 * 在后台线程执行工作流引擎和场景分析，不阻塞 UI
 */

import {
  WorkflowEngine,
  SceneAnalyzer,
  RuleEngine,
  createDefaultWorkflow,
  createDefaultStep,
  BUILTIN_TEMPLATES,
  BUILTIN_RULE_TEMPLATES,
  autoEdit,
  TemplateManager,
} from '@open-factory/editor-core';
import type {
  Workflow,
  WorkflowExecutionContext,
  ActionExecutor,
} from '@open-factory/editor-core';
import type {
  SceneAnalysis,
  AnalysisReport,
} from '@open-factory/editor-core';
import type {
  AutomationRule,
  RuleExecutionResult,
} from '@open-factory/editor-core';
import type {
  EditTemplate,
  AutoEditorConfig,
  AutoEditResult,
} from '@open-factory/editor-core';
import type {
  PreferenceWeights,
} from '@open-factory/editor-core';

// ============================================================
// Worker 消息类型
// ============================================================

interface WorkerRequest {
  id: string;
  type:
    | 'init'
    | 'register-workflow'
    | 'execute-workflow'
    | 'pause-execution'
    | 'resume-execution'
    | 'cancel-execution'
    | 'analyze-scene'
    | 'analyze-batch'
    | 'evaluate-rules'
    | 'get-workflows'
    | 'get-templates'
    | 'get-rules'
    | 'import-workflow'
    | 'export-workflow'
    | 'register-rule'
    | 'create-workflow-from-template'
    | 'auto-edit';
  payload?: unknown;
}

interface WorkerResponse {
  id: string;
  type: string;
  success: boolean;
  data?: unknown;
  error?: string;
}

// ============================================================
// Worker 全局状态
// ============================================================

const engine = new WorkflowEngine({ verboseLogging: true });
const sceneAnalyzer = new SceneAnalyzer();
const ruleEngine = new RuleEngine({ enableDecisionLog: true });
const templateManager = new TemplateManager();

// 注册内置模板
for (const tpl of BUILTIN_TEMPLATES) {
  engine.registerTemplate(tpl);
}
for (const tpl of BUILTIN_RULE_TEMPLATES) {
  ruleEngine.registerTemplate(tpl);
}

// ============================================================
// 消息处理
// ============================================================

function respond(msg: WorkerResponse): void {
  self.postMessage(msg);
}

async function handleRequest(req: WorkerRequest): Promise<void> {
  const { id, type, payload } = req;

  try {
    switch (type) {
      case 'init': {
        respond({ id, type, success: true, data: { ready: true } });
        break;
      }

      case 'register-workflow': {
        const wf = payload as Workflow;
        engine.registerWorkflow(wf);
        respond({ id, type, success: true, data: { workflowId: wf.id } });
        break;
      }

      case 'execute-workflow': {
        const { workflowId, triggerData } = payload as {
          workflowId: string;
          triggerData?: Record<string, unknown>;
        };
        const ctx = await engine.executeWorkflow(workflowId, triggerData);
        respond({
          id,
          type,
          success: true,
          data: {
            executionId: ctx.executionId,
            status: ctx.status,
            logs: ctx.logs,
            startTime: ctx.startTime,
            endTime: ctx.endTime,
          },
        });
        break;
      }

      case 'pause-execution': {
        const { executionId } = payload as { executionId: string };
        const ok = engine.pauseExecution(executionId);
        respond({ id, type, success: true, data: { paused: ok } });
        break;
      }

      case 'resume-execution': {
        const { executionId } = payload as { executionId: string };
        const ok = engine.resumeExecution(executionId);
        respond({ id, type, success: true, data: { resumed: ok } });
        break;
      }

      case 'cancel-execution': {
        const { executionId } = payload as { executionId: string };
        const ok = engine.cancelExecution(executionId);
        respond({ id, type, success: true, data: { cancelled: ok } });
        break;
      }

      case 'analyze-scene': {
        const { mediaPath, startTime, endTime, frameData } = payload as {
          mediaPath: string;
          startTime: number;
          endTime: number;
          frameData?: { brightness?: number[]; motionVectors?: number[]; audioLevels?: number[] };
        };
        const result = await sceneAnalyzer.analyzeScene(mediaPath, startTime, endTime, frameData);
        respond({ id, type, success: true, data: result });
        break;
      }

      case 'analyze-batch': {
        const { mediaItems } = payload as {
          mediaItems: Array<{
            path: string;
            duration: number;
            frameData?: { brightness?: number[]; motionVectors?: number[]; audioLevels?: number[] };
          }>;
        };
        const report = await sceneAnalyzer.analyzeBatch(mediaItems, (progress) => {
          // 向主线程报告进度
          self.postMessage({
            id: `${id}-progress`,
            type: 'analyze-batch-progress',
            success: true,
            data: progress,
          });
        });
        respond({ id, type, success: true, data: report });
        break;
      }

      case 'evaluate-rules': {
        const { data } = payload as { data: Record<string, unknown> };
        const results = await ruleEngine.evaluateAndExecute(data);
        respond({ id, type, success: true, data: results });
        break;
      }

      case 'get-workflows': {
        respond({ id, type, success: true, data: engine.getAllWorkflows() });
        break;
      }

      case 'get-templates': {
        respond({ id, type, success: true, data: engine.getAllTemplates() });
        break;
      }

      case 'get-rules': {
        respond({ id, type, success: true, data: ruleEngine.getAllRules() });
        break;
      }

      case 'import-workflow': {
        const { json } = payload as { json: string };
        const wf = engine.importWorkflow(json);
        respond({ id, type, success: true, data: wf });
        break;
      }

      case 'export-workflow': {
        const { workflowId } = payload as { workflowId: string };
        const json = engine.exportWorkflow(workflowId);
        respond({ id, type, success: true, data: { json } });
        break;
      }

      case 'register-rule': {
        const rule = payload as AutomationRule;
        ruleEngine.registerRule(rule);
        respond({ id, type, success: true, data: { ruleId: rule.id } });
        break;
      }

      case 'create-workflow-from-template': {
        const { templateId, name } = payload as { templateId: string; name?: string };
        const wf = engine.createFromTemplate(templateId, name);
        respond({ id, type, success: true, data: wf ?? null });
        break;
      }

      case 'auto-edit': {
        const { report, templateId, config, weights, trackId } = payload as {
          report: AnalysisReport;
          templateId: string;
          config?: Partial<AutoEditorConfig>;
          weights?: PreferenceWeights;
          trackId?: string;
        };
        const tpl = templateManager.getTemplate(templateId);
        if (!tpl) {
          respond({ id, type, success: false, error: `模板不存在: ${templateId}` });
          break;
        }
        const result = autoEdit(report, tpl, config, weights, trackId);
        respond({ id, type, success: true, data: result });
        break;
      }

      default:
        respond({ id, type, success: false, error: `未知消息类型: ${type}` });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    respond({ id, type, success: false, error: message });
  }
}

// ============================================================
// 注册消息监听
// ============================================================

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  handleRequest(event.data);
};
