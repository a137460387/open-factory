/**
 * 工作流步骤指示器
 *
 * 展示分析进度和各步骤状态。
 */
import type { OrchestratorPhase } from '../../store/smartRoughCutOrchestratorStore';

interface WorkflowStepperProps {
  phase: OrchestratorPhase;
  progress: number;
  progressMessage: string;
  error: string | null;
}

const PHASE_LABELS: Record<OrchestratorPhase, string> = {
  idle: '就绪',
  analyzing: '分析中',
  ready: '就绪',
  applying: '应用中',
  done: '完成',
  error: '错误',
};

export function WorkflowStepper({ phase, progress, progressMessage, error }: WorkflowStepperProps) {
  return (
    <div className="rounded-md border border-line bg-panel p-3" data-testid="workflow-stepper">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[11px] font-semibold text-slate-700">分析状态</span>
        <span
          className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
            phase === 'error'
              ? 'bg-red-100 text-red-700'
              : phase === 'analyzing' || phase === 'applying'
                ? 'bg-blue-100 text-blue-700'
                : phase === 'done'
                  ? 'bg-green-100 text-green-700'
                  : 'bg-slate-100 text-slate-600'
          }`}
          data-testid="workflow-phase"
        >
          {PHASE_LABELS[phase]}
        </span>
      </div>

      {/* 进度条 */}
      {(phase === 'analyzing' || phase === 'applying') && (
        <div className="mb-2">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full rounded-full bg-brand transition-all duration-300"
              style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
              data-testid="workflow-progress-bar"
            />
          </div>
          {progressMessage && (
            <div className="mt-1 text-[10px] text-slate-500" data-testid="workflow-progress-message">
              {progressMessage}
            </div>
          )}
        </div>
      )}

      {/* 错误信息 */}
      {phase === 'error' && error && (
        <div className="rounded border border-red-200 bg-red-50 p-2 text-xs text-red-700" data-testid="workflow-error">
          {error}
        </div>
      )}
    </div>
  );
}
