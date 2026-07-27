export type FileSniffCategory = 'video' | 'audio' | 'image';
export type FileSniffStatus = 'match' | 'unknown' | 'mismatch';
export interface FileSniffRule {
    category: FileSniffCategory;
    extensions: string[];
    label: string;
    match: (header: Uint8Array) => boolean;
}
export interface FileSniffResult {
    status: FileSniffStatus;
    detectedLabel?: string;
    extension: string;
    expectedCategory?: FileSniffCategory;
    detectedCategory?: FileSniffCategory;
}
export declare function getFileExtension(filename: string): string;
export declare function classifyFileExtension(extension: string): FileSniffCategory | undefined;
export declare function sniffFileHeader(header: Uint8Array, filename: string): FileSniffResult;
//# sourceMappingURL=media-file-sniff.d.ts.map