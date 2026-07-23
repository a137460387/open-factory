import { normalizeMediaMetadataEntry, DEFAULT_CLIP_SPEED, normalizeAudioFadeDuration, type Clip, type MediaAsset, type Project, type Timeline, type Track, type MediaMetadata } from '../model';
import type { BatchEditableMediaMetadata } from '../media-batch';
import { getClipSpeed, getClipDisplayDuration, getClipSourceVisibleDuration, detectOverlap, replaceClip } from '../timeline';
import { round } from '../time';
import { applyProxyMigration, type ProxyMigrationUpdate } from '../proxy/proxy-management';
import { applyProjectHealthAutoRepair, type ProjectHealthAutoRepairInput, type ProjectHealthRepairReport } from '../project/project-health-repair';
import type { Command } from './command';
import { type ProjectAccessor, type TimelineAccessor, findClip, findTrack, touchProject, normalizeAssetIdSet, assertMediaAssetsExist, collectProjectMediaIds, removeMediaAssets, mergeMediaReferences } from './helpers';

export class RemoveMediaCommand implements Command {
  readonly description = 'Remove media';
  private before?: Project;
  private after?: Project;

  constructor(
    private readonly accessor: ProjectAccessor,
    private readonly assetIds: string | string[],
  ) {}

  execute(): void {
    this.before ??= this.accessor.getProject();
    if (!this.after) {
      const removeIds = normalizeAssetIdSet(this.assetIds);
      assertMediaAssetsExist(this.before, removeIds);
      const referencedIds = collectProjectMediaIds(this.before);
      const referenced = Array.from(removeIds).filter((assetId) => referencedIds.has(assetId));
      if (referenced.length > 0) {
        throw new Error(`Media asset is still used by timeline clips: ${referenced.join(', ')}`);
      }
      this.after = removeMediaAssets(this.before, removeIds);
    }
    this.accessor.setProject(this.after);
  }

  undo(): void {
    if (this.before) {
      this.accessor.setProject(this.before);
    }
  }
}

export class MergeMediaCommand implements Command {
  readonly description = 'Merge media references';
  private before?: Project;
  private after?: Project;

  constructor(
    private readonly accessor: ProjectAccessor,
    private readonly keepAssetId: string,
    private readonly mergedAssetIds: string[],
  ) {}

  execute(): void {
    this.before ??= this.accessor.getProject();
    if (!this.after) {
      const removeIds = normalizeAssetIdSet(this.mergedAssetIds.filter((assetId) => assetId !== this.keepAssetId));
      if (removeIds.size === 0) {
        throw new Error('No duplicate media assets selected');
      }
      assertMediaAssetsExist(this.before, new Set([this.keepAssetId, ...removeIds]));
      this.after = mergeMediaReferences(this.before, this.keepAssetId, removeIds);
    }
    this.accessor.setProject(this.after);
  }

  undo(): void {
    if (this.before) {
      this.accessor.setProject(this.before);
    }
  }
}

export interface BatchUpdateMetadataCommandItem {
  assetId: string;
  metadata: BatchEditableMediaMetadata;
}

export class BatchUpdateMetadataCommand implements Command {
  readonly description = 'Batch update media metadata';
  private before?: Project;
  private after?: Project;

  constructor(
    private readonly accessor: ProjectAccessor,
    private readonly updates: BatchUpdateMetadataCommandItem[],
  ) {}

  execute(): void {
    this.before ??= this.accessor.getProject();
    if (!this.after) {
      const assetIds = normalizeAssetIdSet(this.updates.map((update) => update.assetId));
      assertMediaAssetsExist(this.before, assetIds);
      const mediaMetadata = { ...this.before.mediaMetadata };
      for (const update of this.updates) {
        const current = mediaMetadata[update.assetId] ?? {};
        const normalized = normalizeMediaMetadataEntry({
          ...current,
          ...update.metadata,
        });
        if (normalized) {
          mediaMetadata[update.assetId] = normalized;
        } else {
          delete mediaMetadata[update.assetId];
        }
      }
      this.after = touchProject({
        ...this.before,
        mediaMetadata,
      });
    }
    this.accessor.setProject(this.after);
  }

  undo(): void {
    if (this.before) {
      this.accessor.setProject(this.before);
    }
  }
}

export interface BatchRenameMediaCommandItem {
  assetId: string;
  name: string;
  path?: string;
}

export class BatchRenameMediaCommand implements Command {
  readonly description = 'Batch rename media';
  private before?: Project;
  private after?: Project;

  constructor(
    private readonly accessor: ProjectAccessor,
    private readonly renames: BatchRenameMediaCommandItem[],
  ) {}

  execute(): void {
    this.before ??= this.accessor.getProject();
    if (!this.after) {
      const assetIds = normalizeAssetIdSet(this.renames.map((rename) => rename.assetId));
      assertMediaAssetsExist(this.before, assetIds);
      const renameByAssetId = new Map(this.renames.map((rename) => [rename.assetId, rename]));
      this.after = touchProject({
        ...this.before,
        media: this.before.media.map((asset) => {
          const rename = renameByAssetId.get(asset.id);
          if (!rename) {
            return asset;
          }
          return {
            ...asset,
            name: rename.name.trim() || asset.name,
            path: rename.path?.trim() || asset.path,
          };
        }),
      });
    }
    this.accessor.setProject(this.after);
  }

  undo(): void {
    if (this.before) {
      this.accessor.setProject(this.before);
    }
  }
}

export class MigrateProxiesCommand implements Command {
  readonly description = 'Migrate proxy paths';
  private before?: Project;
  private after?: Project;

  constructor(
    private readonly accessor: ProjectAccessor,
    private readonly updates: ProxyMigrationUpdate[],
  ) {}

  execute(): void {
    this.before ??= this.accessor.getProject();
    if (!this.after) {
      this.after = {
        ...this.before,
        media: applyProxyMigration(this.before.media, this.updates),
        updatedAt: new Date().toISOString(),
      };
    }
    this.accessor.setProject(this.after);
  }

  undo(): void {
    if (this.before) {
      this.accessor.setProject(this.before);
    }
  }
}

export class AutoRepairProjectHealthCommand implements Command {
  readonly description = 'Auto repair project health';
  private before?: Project;
  private after?: Project;
  private repairReport?: ProjectHealthRepairReport;

  constructor(
    private readonly accessor: ProjectAccessor,
    private readonly input: ProjectHealthAutoRepairInput,
  ) {}

  get report(): ProjectHealthRepairReport | undefined {
    return this.repairReport;
  }

  execute(): void {
    this.before ??= this.accessor.getProject();
    if (!this.after) {
      const result = applyProjectHealthAutoRepair(this.before, this.input);
      this.after = result.project;
      this.repairReport = result.report;
    }
    this.accessor.setProject(this.after);
  }

  undo(): void {
    if (this.before) {
      this.accessor.setProject(this.before);
    }
  }
}

export type ReplaceMediaDurationMode = 'trim-to-original' | 'stretch-to-fit' | 'use-new-duration';

export type ReplaceMediaCompatibilityWarning = 'media-type-mismatch' | 'missing-audio-for-audio-properties';

function asReplaceableMediaClip(clip: Clip): ReplaceableMediaClip {
  if (!isReplaceableMediaClip(clip)) {
    throw new Error('Media replacement requires a media clip');
  }
  return clip;
}

function isReplaceableMediaClip(clip: Clip): clip is ReplaceableMediaClip {
  return clip.type === 'video' || clip.type === 'audio' || clip.type === 'image';
}

export function calculateReplaceMediaPatch(
  clip: ReplaceableMediaClip,
  media: Pick<MediaAsset, 'id' | 'duration'>,
  durationMode: ReplaceMediaDurationMode,
): Pick<ReplaceableMediaClip, 'mediaId' | 'duration' | 'trimStart' | 'trimEnd' | 'speed'> {
  const minDuration = 1 / 30;
  const originalDuration = Math.max(minDuration, clip.duration);
  const mediaDuration = Math.max(minDuration, Number.isFinite(media.duration) ? media.duration : originalDuration);
  if (durationMode === 'stretch-to-fit') {
    return {
      mediaId: media.id,
      duration: round(originalDuration),
      trimStart: 0,
      trimEnd: 0,
      speed: getClipSpeed({ speed: mediaDuration / originalDuration }),
    };
  }
  if (durationMode === 'use-new-duration') {
    return {
      mediaId: media.id,
      duration: round(mediaDuration),
      trimStart: 0,
      trimEnd: 0,
      speed: DEFAULT_CLIP_SPEED,
    };
  }
  const duration = Math.min(originalDuration, mediaDuration);
  return {
    mediaId: media.id,
    duration: round(duration),
    trimStart: 0,
    trimEnd: round(Math.max(0, mediaDuration - duration)),
    speed: DEFAULT_CLIP_SPEED,
  };
}

export function getReplaceMediaCompatibilityWarnings(
  clip: Clip,
  media: Pick<MediaAsset, 'type' | 'hasAudio'>,
): ReplaceMediaCompatibilityWarning[] {
  if (!isReplaceableMediaClip(clip)) {
    return ['media-type-mismatch'];
  }
  const warnings = new Set<ReplaceMediaCompatibilityWarning>();
  if (clip.type !== media.type) {
    warnings.add('media-type-mismatch');
  }
  const newMediaHasAudio = media.type === 'audio' || (media.type === 'video' && media.hasAudio !== false);
  const clipHasAudioProperties =
    clip.type === 'audio' ||
    ('volume' in clip && clip.volume !== undefined) ||
    Boolean(clip.keyframes?.volume?.length) ||
    ('fadeInDuration' in clip && ((clip.fadeInDuration ?? 0) > 0 || (clip.fadeOutDuration ?? 0) > 0));
  if (clipHasAudioProperties && !newMediaHasAudio) {
    warnings.add('missing-audio-for-audio-properties');
  }
  return Array.from(warnings);
}

export class ReplaceMediaCommand implements Command {
  readonly description = 'Replace media';
  private before?: ReplaceableMediaClip;
  private after?: ReplaceableMediaClip;

  constructor(
    private readonly accessor: TimelineAccessor,
    private readonly clipId: string,
    private readonly media: Pick<MediaAsset, 'id' | 'duration'>,
    private readonly durationMode: ReplaceMediaDurationMode,
  ) {}

  execute(): void {
    const timeline = this.accessor.getTimeline();
    this.before ??= asReplaceableMediaClip(findClip(timeline, this.clipId));
    const patch = calculateReplaceMediaPatch(this.before, this.media, this.durationMode);
    this.after = {
      ...this.before,
      ...patch,
    } as ReplaceableMediaClip;
    if (this.after.type === 'video' || this.after.type === 'audio') {
      this.after = {
        ...this.after,
        fadeInDuration: normalizeAudioFadeDuration(this.after.fadeInDuration, this.after.duration),
        fadeOutDuration: normalizeAudioFadeDuration(this.after.fadeOutDuration, this.after.duration),
      } as ReplaceableMediaClip;
    }
    const track = findTrack(timeline, this.after.trackId);
    if (detectOverlap(track, this.after, this.before.id)) {
      throw new Error('Clip overlaps another clip on this track');
    }
    this.accessor.setTimeline(replaceClip(timeline, this.after));
  }

  undo(): void {
    if (this.before) {
      this.accessor.setTimeline(replaceClip(this.accessor.getTimeline(), this.before));
    }
  }
}

export class SwitchMediaVersionCommand implements Command {
  readonly description = 'Switch media version';
  private before?: ReplaceableMediaClip;
  private after?: ReplaceableMediaClip;

  constructor(
    private readonly accessor: TimelineAccessor,
    private readonly clipId: string,
    private readonly media: Pick<MediaAsset, 'id' | 'duration'>,
  ) {}

  execute(): void {
    const timeline = this.accessor.getTimeline();
    this.before ??= asReplaceableMediaClip(findClip(timeline, this.clipId));
    const patch = calculateReplaceMediaPatch(this.before, this.media, 'trim-to-original');
    this.after = {
      ...this.before,
      ...patch,
    } as ReplaceableMediaClip;
    if (this.after.type === 'video' || this.after.type === 'audio') {
      this.after = {
        ...this.after,
        fadeInDuration: normalizeAudioFadeDuration(this.after.fadeInDuration, this.after.duration),
        fadeOutDuration: normalizeAudioFadeDuration(this.after.fadeOutDuration, this.after.duration),
      } as ReplaceableMediaClip;
    }
    const track = findTrack(timeline, this.after.trackId);
    if (detectOverlap(track, this.after, this.before.id)) {
      throw new Error('Clip overlaps another clip on this track');
    }
    this.accessor.setTimeline(replaceClip(timeline, this.after));
  }

  undo(): void {
    if (this.before) {
      this.accessor.setTimeline(replaceClip(this.accessor.getTimeline(), this.before));
    }
  }
}
