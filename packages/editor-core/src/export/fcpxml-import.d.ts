import { type MediaAsset, type Project, type Sequence, type TrackType } from '../model';
import { type EdlMediaMatch } from './timeline-import';
export interface FcpXmlClipItem {
    id: string;
    name: string;
    start: number;
    end: number;
    inPoint: number;
    outPoint: number;
    filePath?: string;
    fileName?: string;
    trackType: TrackType;
}
export interface FcpXmlTransitionItem {
    id: string;
    name: string;
    start: number;
    end: number;
    effectId?: string;
    duration: number;
}
export interface FcpXmlParseResult {
    sequenceName?: string;
    fps: number;
    duration: number;
    clipItems: FcpXmlClipItem[];
    transitions: FcpXmlTransitionItem[];
}
export interface FcpXmlImportOptions {
    fps?: number;
    sequenceName?: string;
}
export interface FcpXmlImportResult {
    title: string;
    sequence: Sequence;
    media: MediaAsset[];
    matches: EdlMediaMatch[];
    matchedCount: number;
    missingCount: number;
}
export declare function parseFcpXml(contents: string): FcpXmlParseResult;
export declare function buildFcpXmlImport(project: Project, contents: string, options?: FcpXmlImportOptions): FcpXmlImportResult;
export declare function applyFcpXmlImport(project: Project, result: FcpXmlImportResult): Project;
//# sourceMappingURL=fcpxml-import.d.ts.map