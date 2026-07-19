import { useState, useCallback, useMemo } from 'react';
import type {
  Workflow,
  WorkflowTemplate,
  WorkflowStatus,
  WorkflowLogEntry,
} from '@open-factory/editor-core';
import {
  WorkflowEngine,
  createDefaultWorkflow,
  createDefaultStep,
  createDefaultTrigger,
  createDefaultAction,
  BUILTIN_TEMPLATES,
} from '@open-factory/editor-core';
import {
  Play,
  Pause,
  Square,
  Plus,
  Trash2,
  Copy,
  Settings,
  ChevronDown,
  ChevronRight,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Zap,
  FileText,
  Workflow as WorkflowIcon,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { Button } from '../ui/button';
import { SceneAnalysisView } from './SceneAnalysisView';
import { Label } from '../ui/label';

/* ------------------------------------------------------------------ */
/*  状态样式                                                           */
/* ------------------------------------------------------------------ */

function statusStyle(status: WorkflowStatus): string {
  switch (status) {
    case 'running': return 'text-blue-500';
    case 'completed': return 'text-green-500';
    case 'failed': return 'text-red-500';
    case 'paused': return 'text-yellow-500';
    case 'cancelled': return 'text-gray-500';
    default: return 'text-muted-foreground';
  }
}

function statusIcon(status: WorkflowStatus) {
  switch (status) {
    case 'running': return <Play className="w-4 h-4" />;
    case 'completed': return <CheckCircle className="w-4 h-4" />;
    case 'failed': return <XCircle className="w-4 h-4" />;
    case 'paused': return <Pause className="w-4 h-4" />;
    case 'cancelled': return <Square className="w-4 h-4" />;
    default: return <Clock className="w-4 h-4" />;
  }
}

function statusLabel(status: WorkflowStatus): string {
  const labels: Record<WorkflowStatus, string> = {
    idle: '空闲',
    running: '运行中',
    paused: '已暂停',
    completed: '已完成',
    failed: '失败',
    cancelled: '已取消',
  };
  return labels[status] || status;
}

/* ------------------------------------------------------------------ */
/*  组件                                                              */
/* ------------------------------------------------------------------ */

interface AutomationPanelProps {
  className?: string;
  onClose?: () => void;
}

export function AutomationPanel({ className, onClose }: AutomationPanelProps) {
  // TODO: 将 engine 替换为 useAutomationWorker() hook，使所有工作流执行在 Worker 中运行
  // Worker 已实现于 src/workers/automation.worker.ts，hook 位于 src/hooks/useAutomationWorker.ts
  // 当前为同步回退实现，后续迭代将切换到 Worker 模式
  const [engine] = useState(() => new WorkflowEngine({ verboseLogging: true }));
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow | null>(null);
  const [executionLogs, setExecutionLogs] = useState<WorkflowLogEntry[]>([]);
  const [activeTab, setActiveTab] = useState<'workflows' | 'templates' | 'analysis' | 'logs'>('workflows');
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());

  // 刷新工作流列表
  const refreshWorkflows = useCallback(() => {
    setWorkflows(engine.getAllWorkflows());
  }, [engine]);

  // 创建新工作流
  const handleCreateWorkflow = useCallback(() => {
    const wf = createDefaultWorkflow('新工作流');
    wf.steps = [createDefaultStep('步骤 1')];
    engine.registerWorkflow(wf);
    setSelectedWorkflow(wf);
    refreshWorkflows();
  }, [engine, refreshWorkflows]);

  // 从模板创建
  const handleCreateFromTemplate = useCallback((templateId: string) => {
    const wf = engine.createFromTemplate(templateId);
    if (wf) {
      setSelectedWorkflow(wf);
      refreshWorkflows();
    }
  }, [engine, refreshWorkflows]);

  // 执行工作流
  const handleExecute = useCallback(async (workflowId: string) => {
    try {
      const ctx = await engine.executeWorkflow(workflowId);
      setExecutionLogs(ctx.logs);
      refreshWorkflows();
    } catch (error) {
      console.error('执行失败:', error);
    }
  }, [engine, refreshWorkflows]);

  // 删除工作流
  const handleDelete = useCallback((workflowId: string) => {
    engine.unregisterWorkflow(workflowId);
    if (selectedWorkflow?.id === workflowId) {
      setSelectedWorkflow(null);
    }
    refreshWorkflows();
  }, [engine, refreshWorkflows, selectedWorkflow]);

  // 切换步骤展开
  const toggleStep = useCallback((stepId: string) => {
    setExpandedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(stepId)) next.delete(stepId);
      else next.add(stepId);
      return next;
    });
  }, []);

  // 获取模板列表
  const templates = useMemo(() => {
    const builtin = BUILTIN_TEMPLATES;
    const custom = engine.getAllTemplates();
    return [...builtin, ...custom];
  }, [engine]);

  return (
    <div className={cn('flex flex-col h-full', className)} data-testid="automation-panel">
      {/* 标题栏 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-line">
        <div className="flex items-center gap-2">
          <Zap className="w-5 h-5 text-primary" />
          <h2 className="text-sm font-semibold">自动化工作流</h2>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleCreateWorkflow}
          data-testid="create-workflow-btn"
        >
          <Plus className="w-4 h-4 mr-1" />
          新建
        </Button>
      </div>

      {/* 标签页 */}
      <div className="flex border-b border-line">
        {(['workflows', 'templates', 'analysis', 'logs'] as const).map((tab) => (
          <button
            key={tab}
            className={cn(
              'flex-1 px-3 py-2 text-xs font-medium transition-colors',
              activeTab === tab
                ? 'text-primary border-b-2 border-primary'
                : 'text-muted-foreground hover:text-foreground',
            )}
            onClick={() => setActiveTab(tab)}
          >
            {tab === 'workflows' ? '工作流' : tab === 'templates' ? '模板' : tab === 'analysis' ? '分析' : '日志'}
          </button>
        ))}
      </div>

      {/* 内容区 */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'workflows' && (
          <WorkflowsTab
            workflows={workflows}
            selectedWorkflow={selectedWorkflow}
            onSelect={setSelectedWorkflow}
            onExecute={handleExecute}
            onDelete={handleDelete}
          />
        )}
        {activeTab === 'templates' && (
          <TemplatesTab
            templates={templates}
            onCreateFromTemplate={handleCreateFromTemplate}
          />
        )}
        {activeTab === 'analysis' && (
          <SceneAnalysisView />
        )}
        {activeTab === 'logs' && (
          <LogsTab logs={executionLogs} />
        )}
      </div>

      {/* 详情面板 */}
      {selectedWorkflow && (
        <WorkflowDetail
          workflow={selectedWorkflow}
          expandedSteps={expandedSteps}
          onToggleStep={toggleStep}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  子组件                                                             */
/* ------------------------------------------------------------------ */

interface WorkflowsTabProps {
  workflows: Workflow[];
  selectedWorkflow: Workflow | null;
  onSelect: (wf: Workflow) => void;
  onExecute: (id: string) => void;
  onDelete: (id: string) => void;
}

function WorkflowsTab({ workflows, selectedWorkflow, onSelect, onExecute, onDelete }: WorkflowsTabProps) {
  if (workflows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <WorkflowIcon className="w-12 h-12 mb-3 opacity-30" />
        <p className="text-sm">暂无工作流</p>
        <p className="text-xs mt-1">点击"新建"或从模板创建</p>
      </div>
    );
  }

  return (
    <div className="p-2 space-y-1">
      {workflows.map((wf) => (
        <div
          key={wf.id}
          className={cn(
            'flex items-center justify-between px-3 py-2 rounded-md cursor-pointer transition-colors',
            selectedWorkflow?.id === wf.id
              ? 'bg-primary/10 text-primary'
              : 'hover:bg-muted',
          )}
          onClick={() => onSelect(wf)}
          data-testid={`workflow-item-${wf.id}`}
        >
          <div className="flex items-center gap-2 min-w-0">
            <Zap className="w-4 h-4 shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{wf.name}</p>
              <p className="text-xs text-muted-foreground">
                {wf.steps.length} 步骤 · {wf.triggers.length} 触发器
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={(e) => { e.stopPropagation(); onExecute(wf.id); }}
              disabled={!wf.enabled}
              data-testid={`execute-workflow-${wf.id}`}
            >
              <Play className="w-3 h-3" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 text-destructive"
              onClick={(e) => { e.stopPropagation(); onDelete(wf.id); }}
              data-testid={`delete-workflow-${wf.id}`}
            >
              <Trash2 className="w-3 h-3" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}

interface TemplatesTabProps {
  templates: WorkflowTemplate[];
  onCreateFromTemplate: (id: string) => void;
}

function TemplatesTab({ templates, onCreateFromTemplate }: TemplatesTabProps) {
  const categories = useMemo(() => {
    const map = new Map<string, WorkflowTemplate[]>();
    for (const tpl of templates) {
      const list = map.get(tpl.category) || [];
      list.push(tpl);
      map.set(tpl.category, list);
    }
    return map;
  }, [templates]);

  return (
    <div className="p-3 space-y-4">
      {Array.from(categories.entries()).map(([category, tpls]) => (
        <div key={category}>
          <h3 className="text-xs font-semibold text-muted-foreground mb-2">{category}</h3>
          <div className="space-y-2">
            {tpls.map((tpl) => (
              <div
                key={tpl.id}
                className="flex items-center justify-between p-3 rounded-md border border-line hover:border-primary/50 transition-colors"
              >
                <div>
                  <p className="text-sm font-medium">{tpl.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{tpl.description}</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onCreateFromTemplate(tpl.id)}
                  data-testid={`use-template-${tpl.id}`}
                >
                  使用
                </Button>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

interface LogsTabProps {
  logs: WorkflowLogEntry[];
}

function LogsTab({ logs }: LogsTabProps) {
  if (logs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <FileText className="w-12 h-12 mb-3 opacity-30" />
        <p className="text-sm">暂无执行日志</p>
      </div>
    );
  }

  return (
    <div className="p-2 space-y-1 font-mono text-xs">
      {logs.map((log, i) => (
        <div
          key={i}
          className={cn(
            'px-2 py-1 rounded',
            log.level === 'error' && 'bg-red-50 text-red-700',
            log.level === 'warn' && 'bg-yellow-50 text-yellow-700',
            log.level === 'info' && 'text-foreground',
            log.level === 'debug' && 'text-muted-foreground',
          )}
        >
          <span className="text-muted-foreground">
            [{new Date(log.timestamp).toLocaleTimeString()}]
          </span>{' '}
          <span className={cn(
            'font-semibold',
            log.level === 'error' && 'text-red-600',
            log.level === 'warn' && 'text-yellow-600',
          )}>
            [{log.level.toUpperCase()}]
          </span>{' '}
          {log.message}
        </div>
      ))}
    </div>
  );
}

interface WorkflowDetailProps {
  workflow: Workflow;
  expandedSteps: Set<string>;
  onToggleStep: (stepId: string) => void;
}

function WorkflowDetail({ workflow, expandedSteps, onToggleStep }: WorkflowDetailProps) {
  return (
    <div className="border-t border-line p-3 max-h-60 overflow-y-auto" data-testid="workflow-detail">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold">{workflow.name}</h3>
        <span className={cn('text-xs', workflow.enabled ? 'text-green-500' : 'text-gray-400')}>
          {workflow.enabled ? '已启用' : '已禁用'}
        </span>
      </div>

      {workflow.description && (
        <p className="text-xs text-muted-foreground mb-2">{workflow.description}</p>
      )}

      {/* 触发器 */}
      <div className="mb-2">
        <p className="text-xs font-medium text-muted-foreground mb-1">触发器</p>
        {workflow.triggers.map((t) => (
          <div key={t.id} className="flex items-center gap-1 text-xs">
            <Zap className="w-3 h-3" />
            <span>{t.type}</span>
            {!t.enabled && <span className="text-muted-foreground">(已禁用)</span>}
          </div>
        ))}
      </div>

      {/* 步骤 */}
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-1">步骤</p>
        {workflow.steps.length === 0 ? (
          <p className="text-xs text-muted-foreground">无步骤</p>
        ) : (
          <div className="space-y-1">
            {workflow.steps.map((step, i) => (
              <div key={step.id} className="border border-line rounded-md">
                <button
                  className="flex items-center gap-2 w-full px-2 py-1.5 text-xs hover:bg-muted transition-colors"
                  onClick={() => onToggleStep(step.id)}
                >
                  {expandedSteps.has(step.id) ? (
                    <ChevronDown className="w-3 h-3" />
                  ) : (
                    <ChevronRight className="w-3 h-3" />
                  )}
                  <span className="font-medium">{i + 1}. {step.name}</span>
                  <span className="text-muted-foreground ml-auto">
                    {step.actions.length} 动作
                  </span>
                </button>
                {expandedSteps.has(step.id) && (
                  <div className="px-4 pb-2 text-xs text-muted-foreground">
                    {step.conditions.length > 0 && (
                      <p>条件: {step.conditions.length} 个</p>
                    )}
                    {step.actions.map((a) => (
                      <p key={a.id}>→ {a.type}</p>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 标签 */}
      {workflow.tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {workflow.tags.map((tag) => (
            <span key={tag} className="px-1.5 py-0.5 bg-muted rounded text-xs">
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
