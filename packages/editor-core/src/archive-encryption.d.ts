export type PasswordStrength = 'weak' | 'medium' | 'strong';
export interface EncryptedArchiveOptions {
    password: string;
    hideMetadata?: boolean;
    volumeSizeMB?: number;
}
export interface ArchiveFileInfo {
    fileCount: number;
    totalSizeBytes: number;
    projectName?: string;
    projectDescription?: string;
}
export interface VolumeSplitResult {
    volumeIndex: number;
    sizeBytes: number;
}
export declare function evaluatePasswordStrength(password: string): PasswordStrength;
export declare function stripArchiveMetadata(info: ArchiveFileInfo): {
    fileCount: number;
    totalSizeBytes: number;
};
export declare function calculateVolumeSplits(totalSizeBytes: number, volumeSizeMB: number): VolumeSplitResult[];
export declare function validateEncryptionOptions(options: EncryptedArchiveOptions): {
    valid: boolean;
    errors: string[];
};
export declare function buildArchiveManifest(info: ArchiveFileInfo, hideMetadata: boolean): Record<string, unknown>;
export declare function formatVolumeName(baseName: string, volumeIndex: number, totalVolumes: number): string;
//# sourceMappingURL=archive-encryption.d.ts.map