import type { ArchiveProgress } from '../../lib/projectArchive';
import { zhCN } from '../../i18n/strings';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export function ArchiveProgressDialog({ progress }: { progress: ArchiveProgress }) {
  return (
    <Dialog open>
      <DialogContent className="sm:max-w-sm" hideClose data-testid="archive-progress-dialog">
        <DialogHeader>
          <DialogTitle>{zhCN.projectArchive.title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
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
      </DialogContent>
    </Dialog>
  );
}
