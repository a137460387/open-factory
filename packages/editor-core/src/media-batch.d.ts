import type { MediaAsset, MediaMetadata, Project } from './model';
export type MediaRenameCaseTransform = 'none' | 'lower' | 'upper' | 'title';
export interface MediaRenameRules {
    template?: string;
    sequencePrefix?: boolean;
    datePrefix?: boolean;
    find?: string;
    replace?: string;
    caseTransform?: MediaRenameCaseTransform;
    removeSpecialCharacters?: boolean;
    startIndex?: number;
    date?: string;
}
export interface MediaRenamePreviewItem {
    assetId: string;
    originalName: string;
    requestedName: string;
    nextName: string;
    changed: boolean;
    conflictSuffix?: number;
}
export type BatchEditableMediaMetadata = Pick<MediaMetadata, 'title' | 'author' | 'description' | 'copyright' | 'date'>;
export declare const DEFAULT_MEDIA_RENAME_TEMPLATE = "{index:03d}_{date}_{originalName}";
export declare function buildMediaRenamePreview(assets: MediaAsset[], allAssets: MediaAsset[], rules: MediaRenameRules): MediaRenamePreviewItem[];
export declare function applyMediaRenameRules(asset: MediaAsset, rules: MediaRenameRules, offset?: number): string;
export declare function expandMediaRenameTemplate(template: string, asset: MediaAsset, context: {
    index: number;
    date: string;
}): string;
export declare function makeUniqueMediaName(name: string, usedNames: Set<string>): {
    name: string;
    suffix?: number;
};
export declare function replaceMediaPathBasename(path: string, nextName: string): string;
export declare function collectExportMediaMetadata(project: Pick<Project, 'media'> & Partial<Pick<Project, 'mediaMetadata'>>): BatchEditableMediaMetadata | undefined;
//# sourceMappingURL=media-batch.d.ts.map