import { lazy, Suspense } from 'react';
import type { Project } from '@open-factory/editor-core';
import { useDialogStore } from '../../store/dialogStore';
import { PanelLoading } from '../PanelLoading';

const SnapshotNameDialog = lazy(() =>
  import('../../project-snapshots/SnapshotNameDialog').then((m) => ({ default: m.SnapshotNameDialog })),
);
const SnapshotHistoryDialog = lazy(() =>
  import('../../project-snapshots/SnapshotHistoryDialog').then((m) => ({ default: m.SnapshotHistoryDialog })),
);
const SnapshotVersionCompareDialog = lazy(() =>
  import('../../project-snapshots/SnapshotVersionCompareDialog').then((m) => ({
    default: m.SnapshotVersionCompareDialog,
  })),
);
const TimelineCompareDialog = lazy(() =>
  import('../../timeline-compare/TimelineCompareDialog').then((m) => ({ default: m.TimelineCompareDialog })),
);
const ReleaseWorkflowDialog = lazy(() =>
  import('../../release/ReleaseWorkflowDialog').then((m) => ({ default: m.ReleaseWorkflowDialog })),
);

export interface SnapshotDialogsProps {
  project: Project;
  projectPath: string | undefined;
  lastExportPath: string | undefined;
  saveNamedSnapshot: (name: string) => void;
  restoreSnapshotProject: (project: Project) => void;
  applySnapshotDiffSelection: (sourceProject: Project, itemIds: string[]) => void;
  updateProjectReleaseVersion: (version: string) => void;
}

export function SnapshotDialogs({
  project,
  projectPath,
  lastExportPath,
  saveNamedSnapshot,
  restoreSnapshotProject,
  applySnapshotDiffSelection,
  updateProjectReleaseVersion,
}: SnapshotDialogsProps) {
  const snapshotNameOpen = useDialogStore((s) => s.snapshotNameOpen);
  const setSnapshotNameOpen = useDialogStore((s) => s.setSnapshotNameOpen);
  const snapshotHistoryOpen = useDialogStore((s) => s.snapshotHistoryOpen);
  const setSnapshotHistoryOpen = useDialogStore((s) => s.setSnapshotHistoryOpen);
  const snapshotCompareOpen = useDialogStore((s) => s.snapshotCompareOpen);
  const setSnapshotCompareOpen = useDialogStore((s) => s.setSnapshotCompareOpen);
  const timelineCompareOpen = useDialogStore((s) => s.timelineCompareOpen);
  const setTimelineCompareOpen = useDialogStore((s) => s.setTimelineCompareOpen);
  const releaseWorkflowOpen = useDialogStore((s) => s.releaseWorkflowOpen);
  const setReleaseWorkflowOpen = useDialogStore((s) => s.setReleaseWorkflowOpen);

  return (
    <Suspense fallback={<PanelLoading label="快照" />}>
      {snapshotNameOpen ? (
        <SnapshotNameDialog
          defaultName={project.name}
          onConfirm={(name: string) => void saveNamedSnapshot(name)}
          onClose={() => setSnapshotNameOpen(false)}
        />
      ) : null}
      {snapshotHistoryOpen ? (
        <SnapshotHistoryDialog
          projectId={project.id}
          projectPath={projectPath}
          onRestore={restoreSnapshotProject}
          onClose={() => setSnapshotHistoryOpen(false)}
        />
      ) : null}
      {snapshotCompareOpen ? (
        <SnapshotVersionCompareDialog
          project={project}
          projectPath={projectPath}
          onApply={applySnapshotDiffSelection}
          onClose={() => setSnapshotCompareOpen(false)}
        />
      ) : null}
      {timelineCompareOpen ? (
        <TimelineCompareDialog
          project={project}
          projectPath={projectPath}
          onApply={applySnapshotDiffSelection}
          onClose={() => setTimelineCompareOpen(false)}
        />
      ) : null}
      {releaseWorkflowOpen ? (
        <ReleaseWorkflowDialog
          project={project}
          projectPath={projectPath}
          lastExportPath={lastExportPath}
          onReleaseCreated={updateProjectReleaseVersion}
          onApplyDiff={applySnapshotDiffSelection}
          onClose={() => setReleaseWorkflowOpen(false)}
        />
      ) : null}
    </Suspense>
  );
}
