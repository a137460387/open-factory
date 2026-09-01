import { lazy, Suspense } from 'react';
import type {
  Project,
  DuplicateMediaIssue,
  MissingMediaIssue,
  OrphanMediaIssue,
  ProxyMissingIssue,
} from '@open-factory/editor-core';
import { useDialogStore } from '../../store/dialogStore';
import { useMediaFeatureStore } from '../../store/mediaFeatureStore';
import type { DuplicateMediaMergeSelection } from '../../media/DuplicateMediaDialog';
import type { MediaOrganizerDuplicateSelection } from '../../media/MediaOrganizerDialog';
import { PanelLoading } from '../PanelLoading';

const ProjectHealthDialog = lazy(() =>
  import('../../project-health/ProjectHealthDialog').then((m) => ({ default: m.ProjectHealthDialog })),
);
const DuplicateMediaDialog = lazy(() =>
  import('../../media/DuplicateMediaDialog').then((m) => ({ default: m.DuplicateMediaDialog })),
);
const MediaHealthDashboardDialog = lazy(() =>
  import('../../media/MediaHealthDashboardDialog').then((m) => ({ default: m.MediaHealthDashboardDialog })),
);
const MediaOrganizerDialog = lazy(() =>
  import('../../media/MediaOrganizerDialog').then((m) => ({ default: m.MediaOrganizerDialog })),
);

export interface ProjectHealthDialogsProps {
  project: Project;
  refreshProjectHealth: () => Promise<void>;
  autoRepairProjectHealth: () => Promise<void>;
  relinkMissingFromHealth: (issue: MissingMediaIssue) => Promise<void>;
  removeOrphanFromHealth: (issue: OrphanMediaIssue) => Promise<void>;
  mergeDuplicateFromHealth: (issue: DuplicateMediaIssue) => Promise<void>;
  queueProxyFromHealth: (issue: ProxyMissingIssue) => Promise<void>;
  mergeDuplicateMediaGroups: (selections: DuplicateMediaMergeSelection[]) => void;
  refreshMediaHealthDashboard: () => Promise<unknown>;
  repairFromMediaHealthDashboard: () => Promise<void>;
  openMediaHealthRelinkPanel: () => void;
  refreshMediaOrganizer: () => Promise<void>;
  confirmMediaOrganizerDuplicateGroups: (
    selections: MediaOrganizerDuplicateSelection[],
    moveFilesToTrash: boolean,
  ) => Promise<void>;
  removeMediaOrganizerReferences: (assetIds: string[]) => void;
  archiveUnusedMedia: () => Promise<void>;
  renameUnusedMedia: (template: string) => Promise<void>;
}

export function ProjectHealthDialogs({
  project: _project,
  refreshProjectHealth,
  autoRepairProjectHealth,
  relinkMissingFromHealth,
  removeOrphanFromHealth,
  mergeDuplicateFromHealth,
  queueProxyFromHealth,
  mergeDuplicateMediaGroups,
  refreshMediaHealthDashboard,
  repairFromMediaHealthDashboard,
  openMediaHealthRelinkPanel,
  refreshMediaOrganizer,
  confirmMediaOrganizerDuplicateGroups,
  removeMediaOrganizerReferences,
  archiveUnusedMedia,
  renameUnusedMedia,
}: ProjectHealthDialogsProps) {
  const projectHealthOpen = useDialogStore((s) => s.projectHealthOpen);
  const setProjectHealthOpen = useDialogStore((s) => s.setProjectHealthOpen);
  const mediaHealthDashboardOpen = useDialogStore((s) => s.mediaHealthDashboardOpen);
  const setMediaHealthDashboardOpen = useDialogStore((s) => s.setMediaHealthDashboardOpen);
  const duplicateMediaOpen = useDialogStore((s) => s.duplicateMediaOpen);
  const setDuplicateMediaOpen = useDialogStore((s) => s.setDuplicateMediaOpen);
  const mediaOrganizerOpen = useDialogStore((s) => s.mediaOrganizerOpen);
  const setMediaOrganizerOpen = useDialogStore((s) => s.setMediaOrganizerOpen);

  const projectHealthReport = useMediaFeatureStore((s) => s.projectHealthReport);
  const projectHealthRepairReport = useMediaFeatureStore((s) => s.projectHealthRepairReport);
  const projectHealthScanning = useMediaFeatureStore((s) => s.projectHealthScanning);
  const mediaHealthDashboard = useMediaFeatureStore((s) => s.mediaHealthDashboard);
  const mediaHealthScanning = useMediaFeatureStore((s) => s.mediaHealthScanning);
  const mediaHealthAutoShowEnabled = useMediaFeatureStore((s) => s.mediaHealthAutoShowEnabled);
  const setMediaHealthAutoShowEnabled = useMediaFeatureStore((s) => s.setMediaHealthAutoShowEnabled);
  const duplicateMediaGroups = useMediaFeatureStore((s) => s.duplicateMediaGroups);
  const mediaOrganizerGroups = useMediaFeatureStore((s) => s.mediaOrganizerGroups);
  const mediaOrganizerCleanup = useMediaFeatureStore((s) => s.mediaOrganizerCleanup);
  const mediaOrganizerScanning = useMediaFeatureStore((s) => s.mediaOrganizerScanning);

  return (
    <Suspense fallback={<PanelLoading label="健康检查" />}>
      {projectHealthOpen ? (
        <ProjectHealthDialog
          report={projectHealthReport}
          repairReport={projectHealthRepairReport}
          scanning={projectHealthScanning}
          onClose={() => setProjectHealthOpen(false)}
          onRescan={() => void refreshProjectHealth()}
          onAutoRepair={() => void autoRepairProjectHealth()}
          onRelink={(issue) => void relinkMissingFromHealth(issue)}
          onRemoveOrphan={(issue) => void removeOrphanFromHealth(issue)}
          onMergeDuplicate={(issue) => void mergeDuplicateFromHealth(issue)}
          onQueueProxy={(issue) => void queueProxyFromHealth(issue)}
        />
      ) : null}
      {duplicateMediaOpen ? (
        <DuplicateMediaDialog
          groups={duplicateMediaGroups}
          onConfirm={mergeDuplicateMediaGroups}
          onClose={() => setDuplicateMediaOpen(false)}
        />
      ) : null}
      {mediaHealthDashboardOpen ? (
        <MediaHealthDashboardDialog
          dashboard={mediaHealthDashboard}
          scanning={mediaHealthScanning}
          autoShowEnabled={mediaHealthAutoShowEnabled}
          onAutoShowEnabledChange={setMediaHealthAutoShowEnabled}
          onClose={() => setMediaHealthDashboardOpen(false)}
          onRescan={() => void refreshMediaHealthDashboard()}
          onRepair={() => void repairFromMediaHealthDashboard()}
          onOpenRelinkPanel={openMediaHealthRelinkPanel}
        />
      ) : null}
      {mediaOrganizerOpen ? (
        <MediaOrganizerDialog
          groups={mediaOrganizerGroups}
          cleanup={mediaOrganizerCleanup}
          scanning={mediaOrganizerScanning}
          onRescan={() => void refreshMediaOrganizer()}
          onConfirmDuplicateGroups={confirmMediaOrganizerDuplicateGroups}
          onRemoveMediaReferences={removeMediaOrganizerReferences}
          onArchiveUnused={() => void archiveUnusedMedia()}
          onApplyRenameTemplate={(template: string) => void renameUnusedMedia(template)}
          onClose={() => setMediaOrganizerOpen(false)}
        />
      ) : null}
    </Suspense>
  );
}
