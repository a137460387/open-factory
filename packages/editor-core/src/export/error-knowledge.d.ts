export type ErrorCategory = 'codec' | 'path' | 'disk' | 'font' | 'permission' | 'network' | 'memory' | 'ffmpeg-version' | 'input-format' | 'output-format' | 'hardware' | 'timeout' | 'subtitles' | 'audio' | 'general';
export interface ErrorKnowledgeEntry {
    id: string;
    category: ErrorCategory;
    patterns: string[];
    label: string;
    causes: string[];
    solutions: string[];
    links: string[];
    baseWeight: number;
}
export interface ErrorKnowledgeMatch {
    entry: ErrorKnowledgeEntry;
    score: number;
    matchedPatterns: string[];
}
export interface ErrorFeedbackRecord {
    entryId: string;
    helpful: boolean;
    timestamp: number;
}
export interface ErrorKnowledgeStore {
    version: number;
    entries: ErrorKnowledgeEntry[];
    feedback: ErrorFeedbackRecord[];
    lastUpdatedAt: number;
    updateSource?: string;
}
export declare const BUILT_IN_ERROR_ENTRIES: ErrorKnowledgeEntry[];
export declare function matchErrorKnowledge(stderr: string, entries: ErrorKnowledgeEntry[], feedbackMap?: Map<string, number>): ErrorKnowledgeMatch[];
export declare function getTopMatches(stderr: string, entries: ErrorKnowledgeEntry[], feedbackMap?: Map<string, number>, limit?: number): ErrorKnowledgeMatch[];
export declare function buildFeedbackMap(records: ErrorFeedbackRecord[]): Map<string, number>;
export declare function createDefaultKnowledgeStore(): ErrorKnowledgeStore;
export declare function addFeedback(store: ErrorKnowledgeStore, entryId: string, helpful: boolean): ErrorKnowledgeStore;
export declare function mergeKnowledgeUpdate(local: ErrorKnowledgeStore, remoteEntries: ErrorKnowledgeEntry[], source: string): ErrorKnowledgeStore;
export declare function normalizeEntry(entry: Partial<ErrorKnowledgeEntry>): ErrorKnowledgeEntry;
export declare function filterEntriesByMinCount(entries: ErrorKnowledgeEntry[], minCount: number): boolean;
//# sourceMappingURL=error-knowledge.d.ts.map