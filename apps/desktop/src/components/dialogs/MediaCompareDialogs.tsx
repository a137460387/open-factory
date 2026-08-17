import {lazy, Suspense} from 'react';
import type {Project, SyncCompareClipRef} from '@open-factory/editor-core';
import {useDialogStore} from '../../store/dialogStore';
import {useMediaFeatureStore} from '../../store/mediaFeatureStore';
import {PanelLoading} from '../PanelLoading';

const ThumbnailGeneratorDialog = lazy(() =>
  import('../../thumbnail/ThumbnailGeneratorDialog').then((m) => ({ default: m.ThumbnailGeneratorDialog })),
);
const MediaVersionComparePanel = lazy(() =>
  import('../MediaVersionComparePanel').then((m) => ({ default: m.MediaVersionComparePanel })),
);
const MediaPrecheckPanel = lazy(() =>
  import('../../media/MediaPrecheckPanel').then((m) => ({ default: m.MediaPrecheckPanel })),
);
const SyncComparePanel = lazy(() =>
  import('../../sync-compare/SyncComparePanel').then((m) => ({ default: m.SyncComparePanel })),
);
const CollaborationNotesPanel = lazy(() => import('../../collaboration/CollaborationNotesPanel'));
const CollaborationPanel = lazy(() => import('../../collaboration/CollaborationPanel'));

export interface MediaCompareDialogsProps {
  project: Project;
  playheadTime: number;
  syncCompareClipRefs: SyncCompareClipRef[];
  jumpToMediaAsset: (assetId: string) => void;
}

export function MediaCompareDialogs({
  project,
  playheadTime,
  syncCompareClipRefs,
  jumpToMediaAsset,
}: MediaCompareDialogsProps) {
  const thumbnailGeneratorAssetIds = useMediaFeatureStore((s) => s.thumbnailGeneratorAssetIds);
  const setThumbnailGeneratorAssetIds = useMediaFeatureStore((s) => s.setThumbnailGeneratorAssetIds);
  const mediaVersionCompare = useMediaFeatureStore((s) => s.mediaVersionCompare);
  const setMediaVersionCompare = useMediaFeatureStore((s) => s.setMediaVersionCompare);
  const mediaPrecheckOpen = useDialogStore((s) => s.mediaPrecheckOpen);
  const setMediaPrecheckOpen = useDialogStore((s) => s.setMediaPrecheckOpen);
  const syncCompareOpen = useDialogStore((s) => s.syncCompareOpen);
  const setSyncCompareOpen = useDialogStore((s) => s.setSyncCompareOpen);
  const collaborationNotesOpen = useDialogStore((s) => s.collaborationNotesOpen);
  const setCollaborationNotesOpen = useDialogStore((s) => s.setCollaborationNotesOpen);
  const collaborationPanelOpen = useDialogStore((s) => s.collaborationPanelOpen);
  const setCollaborationPanelOpen = useDialogStore((s) => s.setCollaborationPanelOpen);

  return (
    <Suspense fallback={<PanelLoading label="媒体对比" />}>
      {thumbnailGeneratorAssetIds ? (
        <ThumbnailGeneratorDialog
          project={project}
          initialAssetIds={thumbnailGeneratorAssetIds}
          onClose={() => setThumbnailGeneratorAssetIds(undefined)}
        />
      ) : null}
      {mediaVersionCompare ? (
        <MediaVersionComparePanel
          request={mediaVersionCompare}
          media={project.media}
          onClose={() => setMediaVersionCompare(undefined)}
        />
      ) : null}
      {mediaPrecheckOpen ? (
        <MediaPrecheckPanel
          project={project}
          onClose={() => setMediaPrecheckOpen(false)}
          onJumpToMedia={jumpToMediaAsset}
        />
      ) : null}
      {syncCompareOpen && syncCompareClipRefs.length === 2 ? (
        <SyncComparePanel
          clips={[syncCompareClipRefs[0], syncCompareClipRefs[1]]}
          project={project}
          onClose={() => setSyncCompareOpen(false)}
        />
      ) : null}
      {collaborationNotesOpen ? (
        <CollaborationNotesPanel
          project={project}
          playheadTime={playheadTime}
          onClose={() => setCollaborationNotesOpen(false)}
        />
      ) : null}
      {collaborationPanelOpen ? (
        <CollaborationPanel onClose={() => setCollaborationPanelOpen(false)} />
      ) : null}
    </Suspense>
  );
}
