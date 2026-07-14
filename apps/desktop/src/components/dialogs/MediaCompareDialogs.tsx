import { lazy, Suspense } from 'react';
import type { Project, MediaVersionCompareRequest, SyncCompareClipRef } from '@open-factory/editor-core';
import { useEditorUIStore } from '../../store/editorUIStore';
import { useEditorFeatureStore } from '../../store/editorFeatureStore';
import { PanelLoading } from '../PanelLoading';

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
  const thumbnailGeneratorAssetIds = useEditorFeatureStore((s) => s.thumbnailGeneratorAssetIds);
  const setThumbnailGeneratorAssetIds = useEditorFeatureStore((s) => s.setThumbnailGeneratorAssetIds);
  const mediaVersionCompare = useEditorFeatureStore((s) => s.mediaVersionCompare);
  const setMediaVersionCompare = useEditorFeatureStore((s) => s.setMediaVersionCompare);
  const mediaPrecheckOpen = useEditorUIStore((s) => s.mediaPrecheckOpen);
  const setMediaPrecheckOpen = useEditorUIStore((s) => s.setMediaPrecheckOpen);
  const syncCompareOpen = useEditorUIStore((s) => s.syncCompareOpen);
  const setSyncCompareOpen = useEditorUIStore((s) => s.setSyncCompareOpen);
  const collaborationNotesOpen = useEditorUIStore((s) => s.collaborationNotesOpen);
  const setCollaborationNotesOpen = useEditorUIStore((s) => s.setCollaborationNotesOpen);

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
    </Suspense>
  );
}
