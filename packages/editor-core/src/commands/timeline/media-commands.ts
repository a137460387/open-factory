import type { TimelineAccessor, ProjectAccessor } from "./index";
import { BatchEditableMediaMetadata } from '../../media-batch';
import { Project, normalizeMediaMetadataEntry } from '../../model';
import { ProjectHealthAutoRepairInput, ProjectHealthRepairReport, applyProjectHealthAutoRepair } from '../../project/project-health-repair';
import { ProxyMigrationUpdate, applyProxyMigration } from '../../proxy/proxy-management';
import { Command } from '../command';
import { ProjectAccessor, touchProject } from './utils';
import { assertMediaAssetsExist, collectProjectMediaIds, mergeMediaReferences, normalizeAssetIdSet, removeMediaAssets } from './utils-media';

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
