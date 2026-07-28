import { normalizeMediaMetadataEntry } from '../../model';
import { applyProjectHealthAutoRepair } from '../../project/project-health-repair';
import { applyProxyMigration } from '../../proxy/proxy-management';
import { touchProject } from './utils';
import { assertMediaAssetsExist, collectProjectMediaIds, mergeMediaReferences, normalizeAssetIdSet, removeMediaAssets } from './utils-media';
export class RemoveMediaCommand {
    accessor;
    assetIds;
    description = 'Remove media';
    before;
    after;
    constructor(accessor, assetIds) {
        this.accessor = accessor;
        this.assetIds = assetIds;
    }
    execute() {
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
    undo() {
        if (this.before) {
            this.accessor.setProject(this.before);
        }
    }
}
export class MergeMediaCommand {
    accessor;
    keepAssetId;
    mergedAssetIds;
    description = 'Merge media references';
    before;
    after;
    constructor(accessor, keepAssetId, mergedAssetIds) {
        this.accessor = accessor;
        this.keepAssetId = keepAssetId;
        this.mergedAssetIds = mergedAssetIds;
    }
    execute() {
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
    undo() {
        if (this.before) {
            this.accessor.setProject(this.before);
        }
    }
}
export class BatchUpdateMetadataCommand {
    accessor;
    updates;
    description = 'Batch update media metadata';
    before;
    after;
    constructor(accessor, updates) {
        this.accessor = accessor;
        this.updates = updates;
    }
    execute() {
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
                }
                else {
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
    undo() {
        if (this.before) {
            this.accessor.setProject(this.before);
        }
    }
}
export class BatchRenameMediaCommand {
    accessor;
    renames;
    description = 'Batch rename media';
    before;
    after;
    constructor(accessor, renames) {
        this.accessor = accessor;
        this.renames = renames;
    }
    execute() {
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
    undo() {
        if (this.before) {
            this.accessor.setProject(this.before);
        }
    }
}
export class MigrateProxiesCommand {
    accessor;
    updates;
    description = 'Migrate proxy paths';
    before;
    after;
    constructor(accessor, updates) {
        this.accessor = accessor;
        this.updates = updates;
    }
    execute() {
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
    undo() {
        if (this.before) {
            this.accessor.setProject(this.before);
        }
    }
}
export class AutoRepairProjectHealthCommand {
    accessor;
    input;
    description = 'Auto repair project health';
    before;
    after;
    repairReport;
    constructor(accessor, input) {
        this.accessor = accessor;
        this.input = input;
    }
    get report() {
        return this.repairReport;
    }
    execute() {
        this.before ??= this.accessor.getProject();
        if (!this.after) {
            const result = applyProjectHealthAutoRepair(this.before, this.input);
            this.after = result.project;
            this.repairReport = result.report;
        }
        this.accessor.setProject(this.after);
    }
    undo() {
        if (this.before) {
            this.accessor.setProject(this.before);
        }
    }
}
//# sourceMappingURL=media-commands.js.map