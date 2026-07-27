/**
 * AI Speech Understanding.
 *
 * Extracts keywords, topics, and narrative markers from speech transcripts.
 * Integrates with existing ASR (Whisper) to provide content understanding.
 */
export interface SpeechUnderstandingResult {
    keywords: Keyword[];
    topics: Topic[];
    narrativeMarkers: NarrativeMarker[];
    summary: string;
}
export interface Keyword {
    word: string;
    score: number;
    frequency: number;
}
export interface Topic {
    name: string;
    keywords: string[];
    relevance: number;
    timeRange: {
        start: number;
        end: number;
    };
}
export interface NarrativeMarker {
    time: number;
    type: 'opening' | 'rising' | 'climax' | 'falling' | 'ending';
    confidence: number;
    description: string;
}
export interface SpeechUnderstandingOptions {
    maxKeywords?: number;
    maxTopics?: number;
    minKeywordFrequency?: number;
}
/**
 * Analyze speech transcript to extract keywords, topics, and narrative markers.
 *
 * Uses TF-IDF-like scoring for keyword extraction and pattern matching
 * for narrative structure detection.
 */
export declare function understandSpeech(transcript: string, timeAlignment?: {
    start: number;
    end: number;
}[], options?: SpeechUnderstandingOptions): SpeechUnderstandingResult;
//# sourceMappingURL=ai-speech-understanding.d.ts.map