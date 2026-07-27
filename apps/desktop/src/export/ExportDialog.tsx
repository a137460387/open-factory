import {ListPlus, X} from 'lucide-react';
import {useExportState, type ExportDialogProps} from './hooks/useExportState';
import {useExportActions} from './hooks/useExportActions';
import {ExportPreview} from './components/ExportPreview';
import {ExportConfig} from './components/ExportConfig';
import {ExportProgress} from './components/ExportProgress';
import {ExportHistory} from './components/ExportHistory';
export function ExportDialog(props: ExportDialogProps) {
  const state = useExportState(props);
  const actions = useExportActions(state);

  const {
    t,
    currentStep,
    setCurrentStep,
    exportMode,
    warmupStatus,
    postExportScriptPendingConfirm,
    setPostExportScriptPendingConfirm,
    pendingConfirmResolveRef,
    exportSettings,
    outputPath,
    error,
  } = state;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/35 p-4" data-testid="export-dialog">
      <section className="w-full max-w-3xl rounded-md border border-line bg-white shadow-soft">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold">{t.title}</h2>
            <p className="text-xs text-slate-500">{t.subtitle}</p>
          </div>
          <button className="rounded p-1 text-slate-500 hover:bg-panel" aria-label={t.close} onClick={state.onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Step navigation */}
        <div className="flex items-center gap-2 border-b border-line px-4 py-2">
          {(['config', 'preview', 'export', 'complete'] as const).map((step) => (
            <button
              key={step}
              type="button"
              className={`rounded px-3 py-1.5 text-xs font-semibold ${
                currentStep === step
                  ? 'bg-brand text-white'
                  : 'text-slate-600 hover:bg-panel'
              }`}
              onClick={() => setCurrentStep(step)}
            >
              {t.steps[step]}
            </button>
          ))}
        </div>

        {/* Main content area */}
        <div className="max-h-[78vh] space-y-4 overflow-y-auto p-4 text-sm">
          {currentStep === 'config' && <ExportConfig state={state} actions={actions} />}
          {currentStep === 'preview' && <ExportPreview state={state} actions={actions} />}
          {currentStep === 'export' && <ExportProgress state={state} actions={actions} />}
          {currentStep === 'complete' && <ExportHistory state={state} actions={actions} />}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 border-t border-line px-4 py-3">
          <button
            className="inline-flex items-center gap-2 rounded-md bg-brand px-3 py-2 text-sm font-medium text-white hover:bg-[#176858] disabled:cursor-wait disabled:opacity-60"
            type="button"
            disabled={warmupStatus?.status === 'running'}
            onClick={() => void actions.addToQueue()}
            data-testid="export-enqueue-button"
          >
            <ListPlus size={15} />
            {t.addToQueue}
          </button>
        </div>
      </section>

      {/* Post-export script confirm dialog */}
      {postExportScriptPendingConfirm ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          data-testid="export-post-script-confirm-overlay"
        >
          <div
            className="w-full max-w-md space-y-4 rounded-md border border-line bg-white p-4 shadow-lg"
            data-testid="export-post-script-confirm-dialog"
          >
            <div>
              <h3 className="text-sm font-semibold">{t.postExportScript.confirmTitle}</h3>
              <p className="mt-1 text-xs text-slate-500">{t.postExportScript.confirmMessage}</p>
            </div>
            <div
              className="rounded-md border border-line bg-slate-50 p-3 font-mono text-xs break-all"
              data-testid="export-post-script-confirm-command"
            >
              {exportSettings.postExportScript?.command ?? ''}
            </div>
            <div className="flex justify-end gap-2">
              <button
                className="rounded-md border border-line px-3 py-1.5 text-xs font-medium hover:bg-panel"
                type="button"
                onClick={() => {
                  setPostExportScriptPendingConfirm(false);
                  pendingConfirmResolveRef.current?.(false);
                }}
                data-testid="export-post-script-confirm-cancel"
              >
                {t.postExportScript.cancelButton}
              </button>
              <button
                className="rounded-md bg-brand px-3 py-1.5 text-xs font-medium text-white hover:bg-[#176858]"
                type="button"
                onClick={() => {
                  setPostExportScriptPendingConfirm(false);
                  pendingConfirmResolveRef.current?.(true);
                }}
                data-testid="export-post-script-confirm-ok"
              >
                {t.postExportScript.confirmButton}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
