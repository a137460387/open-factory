export type DirectorModeStyle = 'energetic' | 'calm' | 'documentary' | 'social-short';
export interface DirectorModeSegment {
    mediaId: string;
    trimStart: number;
    duration: number;
    trackIndex: number;
    order: number;
    reason: string;
}
export interface DirectorModeMarker {
    time: number;
    label: string;
}
export interface DirectorModePlan {
    segments: DirectorModeSegment[];
    markers: DirectorModeMarker[];
    musicTrackPlaceholder: boolean;
}
export interface DirectorModeMediaInfo {
    mediaId: string;
    filename: string;
    type: string;
    duration: number;
    tags?: string[];
    scene?: string;
    mood?: string;
}
/**
 * Pack media for director-mode AI calls.
 * When media has aiAnalysis, tags/scene/mood are included; otherwise filename is the only hint.
 */
export declare function buildDirectorModeMediaInfo(media: Array<{
    id: string;
    name: string;
    type: string;
    duration: number;
    aiAnalysis?: {
        tags?: string[];
        scene?: string;
        mood?: string;
    };
}>): DirectorModeMediaInfo[];
/**
 * Split media info into batches of at most `maxBatch` items.
 * Used to avoid exceeding model context limits when media count > 100.
 */
export declare function splitDirectorModeMediaBatches(mediaInfo: DirectorModeMediaInfo[], maxBatch?: number): DirectorModeMediaInfo[][];
export declare function buildDirectorModeSystemPrompt(style: DirectorModeStyle, addMarkers: boolean, addMusicPlaceholder: boolean): string;
export declare function buildDirectorModeUserPrompt(description: string, targetDuration: number, mediaInfo: DirectorModeMediaInfo[]): string;
export declare function parseDirectorModeResponse(json: unknown): DirectorModePlan;
/**
 * Validate that the total duration of all segments does not exceed the target duration.
 * Returns true if valid (total ≤ target), false otherwise.
 */
export declare function validateDirectorModeTotalDuration(segments: DirectorModeSegment[], targetDuration: number): boolean;
export interface DirectorModeStoryboardCard {
    mediaId: string;
    mediaName: string;
    trimStart: number;
    duration: number;
    trackIndex: number;
    order: number;
    reason: string;
    deleted: boolean;
}
/**
 * Convert a DirectorModePlan into storyboard preview cards.
 * mediaById is used to resolve mediaId → display name.
 */
export declare function buildDirectorModeStoryboardCards(plan: DirectorModePlan, mediaById: Map<string, {
    name: string;
}>): DirectorModeStoryboardCard[];
//# sourceMappingURL=director-mode.d.ts.map