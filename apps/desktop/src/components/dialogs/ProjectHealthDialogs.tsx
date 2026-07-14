import { lazy, Suspense } from 'react';
import type {
  Project,
  DuplicateMediaGroup,
  DuplicateMediaIssue,
  MissingMediaIssue,
  OrphanMediaIssue,
  ProxyMissingIssue,
  MediaHealthDashboard,
  MediaCleanupReport,
  SmartDuplicateGroup,
  ProjectHealthRepairReport,
  ProjectHealthReport,
} from '@open-factory/editor-core';
import { useEditorUIStore } from '../../store/editorUIStore';
import { useEditorFeatureStore } from '../../store/editorFeatureStore';
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
  project,
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
  const projectHealthOpen = useEditorUIStore((s) => s.projectHealthOpen);
  const setProjectHealthOpen = useEditorUIStore((s) => s.setProjectHealthOpen);
  const mediaHealthDashboardOpen = useEditorUIStore((s) => s.mediaHealthDashboardOpen);
  const setMediaHealthDashboardOpen = useEditorUIStore((s) => s.setMediaHealthDashboardOpen);
  const duplicateMediaOpen = useEditorUIStore((s) => s.duplicateMediaOpen);
  const setDuplicateMediaOpen = useEditorUIStore((s) => s.setDuplicateMediaOpen);
  const mediaOrganizerOpen = useEditorUIStore((s) => s.mediaOrganizerOpen);
  const setMediaOrganizerOpen = useEditorUIStore((s) => s.setMediaOrganizerOpen);

  const projectHealthReport = useEditorFeatureStore((s) => s.projectHealthReport);
  const projectHealthRepairReport = useEditorFeatureStore((s) => s.projectHealthRepairReport);
  const projectHealthScanning = useEditorFeatureStore((s) => s.projectHealthScanning);
  const mediaHealthDashboard = useEditorFeatureStore((s) => s.mediaHealthDashboard);
  const mediaHealthScanning = useEditorFeatureStore((s) => s.mediaHealthScanning);
  const mediaHealthAutoShowEnabled = useEditorFeatureStore((s) => s.mediaHealthAutoShowEnabled);
  const setMediaHealthAutoShowEnabled = useEditorFeatureStore((s) => s.setMediaHealthAutoShowEnabled);
  const duplicateMediaGroups = useEditorFeatureStore((s) => s.duplicateMediaGroups);
  const mediaOrganizerGroups = useEditorFeatureStore((s) => s.mediaOrganizerGroups);
  const mediaOrganizerCleanup = useEditorFeatureStore((s) => s.mediaOrganizerCleanup);
  const mediaOrganizerScanning = useEditorFeatureStore((s) => s.mediaOrganizerScanning);

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
