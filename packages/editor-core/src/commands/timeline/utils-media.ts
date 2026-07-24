import { MediaMetadata, Project, Timeline, getProjectSequences, replaceProjectActiveTimeline } from '../../model';
import type { Clip } from '../../model';
import { touchProject } from './utils';

export function normalizeAssetIdSet(assetIds: string | string[]): Set<string> {
  const ids = Array.isArray(assetIds) ? assetIds : [assetIds];
  const normalized = new Set(ids.map((assetId) => assetId.trim()).filter(Boolean));
  if (normalized.size === 0) {
    throw new Error('No media assets selected');
  }
  return normalized;
}

export function assertMediaAssetsExist(project: Project, assetIds: Set<string>): void {
  const available = new Set(project.media.map((asset) => asset.id));
  const missing = Array.from(assetIds).filter((assetId) => !available.has(assetId));
  if (missing.length > 0) {
    throw new Error(`Media asset not found: ${missing.join(', ')}`);
  }
}

export function collectProjectMediaIds(project: Project): Set<string> {
  const synced = replaceProjectActiveTimeline(project, project.timeline);
  const ids = new Set<string>();
  for (const sequence of getProjectSequences(synced)) {
    for (const clip of sequence.timeline.tracks.flatMap((track) => track.clips)) {
      if ('mediaId' in clip) {
        ids.add(clip.mediaId);
      }
    }
  }
  return ids;
}

export function removeMediaAssets(project: Project, removeIds: Set<string>): Project {
  const mediaMetadata = filterMediaMetadata(project.mediaMetadata, removeIds);
  return touchProject({
    ...project,
    media: project.media.filter((asset) => !removeIds.has(asset.id)),
    mediaMetadata,
  });
}

export function mergeMediaReferences(project: Project, keepAssetId: string, removeIds: Set<string>): Project {
  const synced = replaceProjectActiveTimeline(project, project.timeline);
  const sequences = getProjectSequences(synced).map((sequence) => ({
    ...sequence,
    timeline: replaceTimelineMediaReferences(sequence.timeline, keepAssetId, removeIds),
  }));
  const activeTimeline =
    sequences.find((sequence) => sequence.id === synced.activeSequenceId)?.timeline ?? synced.timeline;
  return touchProject({
    ...synced,
    media: synced.media.filter((asset) => !removeIds.has(asset.id)),
    mediaMetadata: filterMediaMetadata(synced.mediaMetadata, removeIds),
    timeline: activeTimeline,
    sequences,
  });
}

export function replaceTimelineMediaReferences(timeline: Timeline, keepAssetId: string, removeIds: Set<string>): Timeline {
  return {
    ...timeline,
    tracks: timeline.tracks.map((track) => ({
      ...track,
      clips: track.clips.map((clip) => {
        if (!('mediaId' in clip) || !removeIds.has(clip.mediaId)) {
          return clip;
        }
        return { ...clip, mediaId: keepAssetId } as Clip;
      }),
    })),
  };
}

export function filterMediaMetadata(
  metadata: Record<string, MediaMetadata>,
  removeIds: Set<string>,
): Record<string, MediaMetadata> {
  const next = { ...metadata };
  for (const assetId of removeIds) {
    delete next[assetId];
  }
  return next;
}
