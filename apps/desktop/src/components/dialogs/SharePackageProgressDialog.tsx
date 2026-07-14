import type { SharePackageWorkflowProgress } from '../../lib/sharePackage';
import { zhCN } from '../../i18n/strings';

export function SharePackageProgressDialog({ progress }: { progress: SharePackageWorkflowProgress }) {
  const label =
    progress.stage === 'exporting'
      ? zhCN.sharePackage.exporting
      : zhCN.sharePackage.packing(progress.current, progress.total);
  const percent = progress.total > 0 ? Math.round(progress.progress * 100) : 0;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4"
      data-testid="share-package-progress-dialog"
    >
      <section className="w-full max-w-sm rounded-md border border-line bg-white shadow-soft">
        <div className="border-b border-line px-4 py-3">
          <h2 className="text-sm font-semibold">{zhCN.sharePackage.title}</h2>
        </div>
        <div className="space-y-2 px-4 py-3">
          <div className="flex items-center justify-between gap-3 text-sm font-medium text-ink">
            <span data-testid="share-package-progress-message">{label}</span>
            <span className="tabular-nums text-slate-500">{percent}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded bg-panel">
            <div className="h-full bg-brand transition-[width]" style={{ width: `${percent}%` }} />
          </div>
        </div>
      </section>
    </div>
  );
}
