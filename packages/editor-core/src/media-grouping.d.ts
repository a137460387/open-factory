import type { MediaAsset } from './model-types';
export declare const GROUPING_TIME_WINDOW_MS: number;
export declare const GROUPING_COLOR_SIMILARITY_THRESHOLD = 0.72;
export declare const GROUPING_FILENAME_SEQUENCE_MIN_MATCH = 3;
export declare const GROUPING_MIN_CLUSTER_SIZE = 2;
export type MediaGroupingReason = 'time-window' | 'filename-sequence' | 'color-similarity';
export interface MediaGroupingSuggestion {
    id: string;
    mediaIds: string[];
    reason: MediaGroupingReason;
    label: string;
    confidence: number;
    createdAt: string;
}
export interface MediaGroupingIgnorePreference {
    reason: MediaGroupingReason;
    ignoreCount: number;
    lastIgnoredAt: string;
}
export interface MediaGroupingSettings {
    enabled: boolean;
    ignorePreferences: MediaGroupingIgnorePreference[];
}
export declare const DEFAULT_MEDIA_GROUPING_SETTINGS: MediaGroupingSettings;
export declare function detectTimeWindowGroups(media: Pick<MediaAsset, 'id' | 'importedAt'>[], windowMs?: number): MediaGroupingSuggestion[];
export declare function extractFilenameSequencePrefix(name: string): string;
export declare function detectFilenameSequenceGroups(media: Pick<MediaAsset, 'id' | 'name'>[]): MediaGroupingSuggestion[];
export declare function detectColorSimilarityGroups(media: Pick<MediaAsset, 'id' | 'thumbnail'>[], histograms: Record<string, readonly number[] | undefined>, threshold?: number): MediaGroupingSuggestion[];
export declare function mergeGroupingSuggestions(...suggestions: MediaGroupingSuggestion[][]): MediaGroupingSuggestion[];
export declare function recordIgnorePreference(preferences: MediaGroupingIgnorePreference[], reason: MediaGroupingReason, now?: string): MediaGroupingIgnorePreference[];
export declare function filterSuggestionsByPreferences(suggestions: MediaGroupingSuggestion[], preferences: MediaGroupingIgnorePreference[], maxIgnoreCount?: number): MediaGroupingSuggestion[];
export declare function normalizeMediaGroupingSettings(input: Partial<MediaGroupingSettings> | undefined): MediaGroupingSettings;
//# sourceMappingURL=media-grouping.d.ts.map