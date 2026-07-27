import type { MediaAsset } from '../model';
export declare function normalizePath(path: string): string;
export declare function dirname(path: string): string;
export declare function makeRelativePath(mediaPath: string, projectPath: string): string | null;
export declare function resolveMediaPath(asset: Pick<MediaAsset, 'path' | 'relativePath'>, projectPath?: string): string;
export declare function joinPath(base: string, relative: string): string;
export declare function isCrossDrivePath(left: string, right: string): boolean;
export declare function isAbsolutePath(path: string): boolean;
//# sourceMappingURL=relative-paths.d.ts.map