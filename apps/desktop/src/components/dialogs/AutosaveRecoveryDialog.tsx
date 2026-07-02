import { zhCN } from '../../i18n/strings';

export function AutosaveRecoveryDialog({ onRestore, onDiscard }: { onRestore(): void; onDiscard(): void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4" data-testid="autosave-recovery-dialog">
      <section className="w-full max-w-sm rounded-md border border-line bg-white shadow-soft">
        <div className="border-b border-line px-4 py-3">
          <h2 className="text-sm font-semibold">{zhCN.autosaveRecovery.title}</h2>
        </div>
        <div className="flex justify-end gap-2 px-4 py-3">
          <button className="rounded-md border border-line px-3 py-2 text-sm font-medium hover:bg-panel" onClick={onDiscard} data-testid="autosave-discard-button">
            {zhCN.autosaveRecovery.discard}
          </button>
          <button className="rounded-md bg-brand px-3 py-2 text-sm font-medium text-white hover:bg-[#176858]" onClick={onRestore} data-testid="autosave-restore-button">
            {zhCN.autosaveRecovery.restore}
          </button>
        </div>
      </section>
    </div>
  );
}
