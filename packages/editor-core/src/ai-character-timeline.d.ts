/**
 * AI character appearance timeline tracking.
 *
 * Samples frames at ~2s intervals, sends to Vision AI for character detection,
 * clusters characters within clips using IOU, and matches across clips using
 * Jaccard similarity on descriptor tags.
 */
export interface CharacterBoundingBox {
    x: number;
    y: number;
    w: number;
    h: number;
}
export interface CharacterDescriptor {
    descriptorTags: string[];
    box: CharacterBoundingBox;
}
export interface CharacterFrameResult {
    time: number;
    characters: CharacterDescriptor[];
}
export interface CharacterAIResponse {
    frames: CharacterFrameResult[];
}
export interface CharacterAppearance {
    clipId: string;
    startTime: number;
    endTime: number;
    confidence: number;
}
export interface CharacterEntry {
    label: string;
    appearances: CharacterAppearance[];
}
export interface CharacterTimeline {
    characters: Record<string, CharacterEntry>;
    lastAnalyzedAt: string;
}
export interface ClusteredCharacter {
    id: number;
    descriptorTags: string[];
    appearances: Array<{
        clipId: string;
        startTime: number;
        endTime: number;
        confidence: number;
    }>;
}
export declare const IOU_THRESHOLD = 0.4;
export declare const JACCARD_THRESHOLD = 0.6;
export declare const SAMPLE_INTERVAL_SECONDS = 2;
/**
 * Calculate Intersection over Union (IOU) of two bounding boxes.
 * Returns 0 if there is no overlap.
 */
export declare function calculateIOU(a: CharacterBoundingBox, b: CharacterBoundingBox): number;
/**
 * Calculate Jaccard similarity between two sets of descriptor tags.
 * Tags are compared case-insensitively after trimming.
 */
export declare function calculateJaccardSimilarity(a: string[], b: string[]): number;
/**
 * Cluster character descriptors within a single clip across frames.
 * Adjacent frames with box IOU > IOU_THRESHOLD are considered the same character.
 * Returns clustered characters with merged descriptor tags and time ranges.
 */
export declare function clusterCharactersInClip(frames: CharacterFrameResult[], clipId: string): ClusteredCharacter[];
/**
 * Match characters across clips using Jaccard similarity on descriptor tags.
 * Assigns consistent character IDs (character_1, character_2, ...).
 * Returns a CharacterTimeline suitable for storing in the project.
 */
export declare function matchCharactersAcrossClips(clipClusters: Array<{
    clipId: string;
    characters: ClusteredCharacter[];
}>): CharacterTimeline;
/**
 * Calculate frame sample times for a clip.
 * Samples at SAMPLE_INTERVAL_SECONDS intervals, plus the middle frame.
 */
export declare function calculateFrameSampleTimes(clipDuration: number): number[];
/**
 * Build an AI prompt for character detection from sampled frames.
 */
export declare function buildCharacterDetectionPrompt(sampleTimes: number[]): string;
/**
 * Parse AI character detection response.
 */
export declare function parseCharacterDetectionResponse(json: string): CharacterAIResponse | null;
/**
 * Rename a character label in the timeline.
 * Returns a new CharacterTimeline with the updated label.
 */
export declare function renameCharacter(timeline: CharacterTimeline, characterId: string, newLabel: string): CharacterTimeline;
//# sourceMappingURL=ai-character-timeline.d.ts.map