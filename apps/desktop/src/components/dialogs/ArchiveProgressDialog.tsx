import type { ArchiveProgress } from '../../lib/projectArchive';
import { zhCN } from '../../i18n/strings';

export function ArchiveProgressDialog({ progress }: { progress: ArchiveProgress }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4" data-testid="archive-progress-dialog">
      <section className="w-full max-w-sm rounded-md border border-line bg-white shadow-soft">
        <div className="border-b border-line px-4 py-3">
          <h2 className="text-sm font-semibold">{zhCN.projectArchive.title}</h2>
        </div>
        <div className="space-y-2 px-4 py-3">
          <div className="text-sm font-medium text-ink" data-testid="archive-progress-message">
            {zhCN.projectArchive.copying(progress.copied, progress.total)}
          </div>
          <div className="h-2 overflow-hidden rounded bg-panel">
            <div
              className="h-full bg-brand transition-[width]"
              style={{ width: `${progress.total > 0 ? Math.round((progress.copied / progress.total) * 100) : 100}%` }}
            />
          </div>
        </div>
      </section>
    </div>
  );
}
