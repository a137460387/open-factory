import { lazy, Suspense } from 'react';
import type { ExportQueueRecoveryCandidate } from '../../export/export-queue-persistence';
import type { SharePackageWorkflowProgress } from '../../lib/sharePackage';
import type { ArchiveProgress } from '../../lib/projectArchive';
import type { AutosaveRecoveryCandidate } from '../../lib/projectFiles';
import { PanelLoading } from '../PanelLoading';

const AutosaveRecoveryDialog = lazy(() =>
  import('./AutosaveRecoveryDialog').then((m) => ({ default: m.AutosaveRecoveryDialog }))
);
const ExportQueueRecoveryDialog = lazy(() =>
  import('./ExportQueueRecoveryDialog').then((m) => ({ default: m.ExportQueueRecoveryDialog }))
);
const ArchiveProgressDialog = lazy(() =>
  import('./ArchiveProgressDialog').then((m) => ({ default: m.ArchiveProgressDialog }))
);
const SharePackageProgressDialog = lazy(() =>
  import('./SharePackageProgressDialog').then((m) => ({ default: m.SharePackageProgressDialog }))
);

export interface RecoveryDialogsProps {
  recoveryCandidate: AutosaveRecoveryCandidate | undefined;
  exportQueueRecovery: ExportQueueRecoveryCandidate | undefined;
  archiveProgress: ArchiveProgress | undefined;
  sharePackageProgress: SharePackageWorkflowProgress | undefined;
  restoreRecovery: () => Promise<void>;
  discardRecovery: () => Promise<void>;
  restoreExportQueueRecovery: (taskIds: string[]) => Promise<void>;
  discardExportQueueRecovery: () => void;
}

export function RecoveryDialogs({
  recoveryCandidate,
  exportQueueRecovery,
  archiveProgress,
  sharePackageProgress,
  restoreRecovery,
  discardRecovery,
  restoreExportQueueRecovery,
  discardExportQueueRecovery,
}: RecoveryDialogsProps) {
  return (
    <Suspense fallback={<PanelLoading label="恢复" />}>
      {recoveryCandidate ? (
        <AutosaveRecoveryDialog
          onRestore={() => void restoreRecovery()}
          onDiscard={() => void discardRecovery()}
        />
      ) : null}
      {exportQueueRecovery ? (
        <ExportQueueRecoveryDialog
          candidate={exportQueueRecovery}
          onRestoreAll={() => void restoreExportQueueRecovery(exportQueueRecovery.tasks.map((task) => task.id))}
          onRestoreSelected={(taskIds) => void restoreExportQueueRecovery(taskIds)}
          onDiscardAll={() => void discardExportQueueRecovery()}
        />
      ) : null}
      {archiveProgress ? <ArchiveProgressDialog progress={archiveProgress} /> : null}
      {sharePackageProgress ? <SharePackageProgressDialog progress={sharePackageProgress} /> : null}
    </Suspense>
  );
}
