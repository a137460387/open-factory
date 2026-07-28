import type { SubtitleClip, SubtitleTrackType } from '../model-types';
export interface SrtCue {
    index: number;
    startMs: number;
    endMs: number;
    text: string;
    subtitleType?: SubtitleTrackType;
    speaker?: string;
    soundDesc?: string;
}
export type SubtitleTextFormat = 'srt' | 'vtt' | 'ass' | 'ssa';
export interface SubtitleCueStyle {
    fontFamily?: string;
    fontSize?: number;
    color?: string;
    backgroundColor?: string;
    backgroundOpacity?: number;
    outlineColor?: string;
    outlineWidth?: number;
    shadowColor?: string;
    shadowOffset?: number;
    bold?: boolean;
    italic?: boolean;
    yOffset?: number;
    x?: number;
    y?: number;
}
export interface SubtitleCueInput {
    id: string;
    start: number;
    duration: number;
    text: string;
    subtitleType?: SubtitleTrackType;
    speaker?: string;
    soundDesc?: string;
    style?: SubtitleCueStyle;
}
export declare function parseSrt(contents: string): SrtCue[];
export declare function parseSrtTimecodeMs(value: string): number;
export declare function serializeSrt(cues: Array<Pick<SrtCue, 'startMs' | 'endMs' | 'text'>>): string;
export declare function serializeSubtitleClipsToSrt(clips: SubtitleClip[]): string;
export declare function serializeSubtitleCueInputsToSrt(clips: SubtitleCueInput[]): string;
export declare function serializeSubtitleClipsToVtt(clips: SubtitleClip[]): string;
export declare function serializeSubtitleCueInputsToVtt(clips: SubtitleCueInput[]): string;
export declare function serializeSubtitleClipsToAss(clips: SubtitleClip[], format?: 'ass' | 'ssa'): string;
export declare function serializeSubtitleCueInputsToAss(clips: SubtitleCueInput[], format?: 'ass' | 'ssa'): string;
export declare function formatSrtTimecode(milliseconds: number): string;
//# sourceMappingURL=srt.d.ts.map