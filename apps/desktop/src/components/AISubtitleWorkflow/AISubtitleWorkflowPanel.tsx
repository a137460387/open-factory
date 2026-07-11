import type { Clip, MediaAsset } from '@open-factory/editor-core';
import { zhCN } from '../../i18n/strings';
import { useSubtitleWorkflow, type WorkflowStage } from './useSubtitleWorkflow';
import { ASRStage } from './ASRStage';
import { PolishStage } from './PolishStage';
import { StyleStage } from './StyleStage';
import { ExportStage } from './ExportStage';

const t = zhCN.aiSubtitleWorkflow;

const STAGES: WorkflowStage[] = ['asr', 'polish', 'style', 'export'];

interface AISubtitleWorkflowPanelProps {
  selectedClip?: Clip;
  media: MediaAsset[];
  onClose: () => void;
}

export function AISubtitleWorkflowPanel({ selectedClip, media, onClose }: AISubtitleWorkflowPanelProps) {
  const {
    state,
    updateASR,
    updatePolish,
    updateStyle,
    updateExport,
    goToStage,
    reset,
    completeASR,
    completePolish,
    completeStyle,
    completeExport,
  } = useSubtitleWorkflow();

  const stageIndex = STAGES.indexOf(state.currentStage);

  const canNavigateTo = (stage: WorkflowStage): boolean => {
    const targetIndex = STAGES.indexOf(stage);
    return targetIndex <= stageIndex;
  };

  return (
    <div
      className="flex h-full flex-col bg-[var(--color-bg-primary)]"
      data-testid="ai-subtitle-workflow-panel"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-line px-3 py-2">
        <h2 className="text-sm font-semibold text-ink">{t.title}</h2>
        <button
          className="rounded p-1 text-[var(--color-text-muted)] hover:bg-panel"
          type="button"
          onClick={onClose}
          data-testid="subtitle-workflow-close"
        >
          ✕
        </button>
      </div>

      {/* Stage Tabs */}
      <div className="flex border-b border-line">
        {STAGES.map((stage) => (
          <button
            key={stage}
            className={`flex-1 px-2 py-1.5 text-xs font-medium transition-colors ${
              state.currentStage === stage
                ? 'border-b-2 border-[var(--color-accent)] text-[var(--color-accent)]'
                : canNavigateTo(stage)
                  ? 'text-[var(--color-text-secondary)] hover:text-ink'
                  : 'cursor-not-allowed text-[var(--color-text-muted)] opacity-50'
            }`}
            type="button"
            disabled={!canNavigateTo(stage)}
            onClick={() => goToStage(stage)}
            data-testid={`subtitle-workflow-tab-${stage}`}
          >
            {t.stages[stage]}
          </button>
        ))}
      </div>

      {/* Stage Content */}
      <div className="flex-1 overflow-y-auto p-3">
        {state.currentStage === 'asr' && (
          <ASRStage
            asrState={state.asr}
            onUpdate={updateASR}
            onComplete={completeASR}
            media={media}
          />
        )}
        {state.currentStage === 'polish' && (
          <PolishStage
            polishState={state.polish}
            onUpdate={updatePolish}
            onComplete={completePolish}
          />
        )}
        {state.currentStage === 'style' && (
          <StyleStage
            styleState={state.style}
            onUpdate={updateStyle}
            onComplete={completeStyle}
            media={media}
          />
        )}
        {state.currentStage === 'export' && (
          <ExportStage
            exportState={state.export}
            onUpdate={updateExport}
            onComplete={completeExport}
          />
        )}
      </div>

      {/* Footer Navigation */}
      <div className="flex items-center justify-between border-t border-line px-3 py-2">
        <button
          className="rounded-md border border-line bg-[var(--color-bg-elevated)] px-3 py-1 text-xs font-medium hover:bg-panel disabled:cursor-not-allowed disabled:opacity-50"
          type="button"
          disabled={stageIndex === 0}
          onClick={() => goToStage(STAGES[stageIndex - 1])}
          data-testid="subtitle-workflow-prev"
        >
          {t.navigation.previous}
        </button>
        <button
          className="rounded-md border border-line bg-[var(--color-bg-elevated)] px-3 py-1 text-xs font-medium hover:bg-panel"
          type="button"
          onClick={reset}
          data-testid="subtitle-workflow-reset"
        >
          {t.navigation.reset}
        </button>
        <button
          className="rounded-md border border-line bg-[var(--color-bg-elevated)] px-3 py-1 text-xs font-medium hover:bg-panel disabled:cursor-not-allowed disabled:opacity-50"
          type="button"
          disabled={stageIndex === STAGES.length - 1}
          onClick={() => goToStage(STAGES[stageIndex + 1])}
          data-testid="subtitle-workflow-next"
        >
          {t.navigation.next}
        </button>
      </div>
    </div>
  );
}
