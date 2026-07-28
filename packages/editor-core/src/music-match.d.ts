export type MusicTempo = 'fast' | 'medium' | 'slow';
export interface MusicMatchResult {
    mood: string;
    tempo: MusicTempo;
    genres: string[];
    keywords: string[];
    searchSuggestions: string[];
}
export interface MusicMatchMediaInfo {
    mediaId: string;
    filename: string;
    type: string;
    duration: number;
    mood?: string;
}
export declare function buildMusicMatchSystemPrompt(): string;
export declare function buildMusicMatchUserPrompt(description: string, mediaInfo: MusicMatchMediaInfo[]): string;
export declare function parseMusicMatchResponse(json: unknown): MusicMatchResult | null;
export declare function scoreMediaAudioSimilarity(targetMood: string, audioMood: string): number;
export declare function calculateAudioLoopOrTrimToDuration(audioDuration: number, targetDuration: number): {
    loops: number;
    trimEnd: number;
};
export interface AudioRecommendation {
    mediaId: string;
    filename: string;
    mood?: string;
    similarity: number;
}
export declare function rankAudioByMoodSimilarity(targetMood: string, audioAssets: Array<{
    id: string;
    name: string;
    aiAnalysis?: {
        mood?: string;
    };
}>): AudioRecommendation[];
//# sourceMappingURL=music-match.d.ts.map