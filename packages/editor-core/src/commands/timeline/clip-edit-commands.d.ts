import type { TimelineAccessor } from './index';
import { CreditsRow, CreditsStyle } from '../../credits-roll';
import { AudioFadeCurve, ChromaKey, Clip, ClipAudioDenoise, ClipBorder, ClipFrameInterpolation, ClipKeyframes, ClipMask, ClipPanoramaView, ClipProjection, ClipQualityEnhancement, ClipStabilization, ClipVideoRestoration, ColorCorrection, MediaAsset, MotionTrackPoint, SubtitleMode, SubtitleStyle, SubtitleTrackType, TextPathOptions, TextStyle, Transform } from '../../model';
import { ClipSpatialAudio } from '../../spatial-audio';
import { TimelineLabelColor } from '../../timeline-color-labels';
import { Command } from '../command';
export declare class DeleteClipCommand implements Command {
    private readonly accessor;
    private readonly clipId;
    readonly description = "Delete clip";
    private removed?;
    private removedIndex;
    constructor(accessor: TimelineAccessor, clipId: string);
    execute(): void;
    undo(): void;
}
export type ClipPatch = Partial<Omit<Clip, 'type' | 'id' | 'transform' | 'colorCorrection' | 'chromaKey' | 'stabilization' | 'frameInterpolation' | 'border'>> & {
    keyframes?: ClipKeyframes;
    kenBurns?: boolean;
    volume?: number;
    text?: string;
    richText?: Extract<Clip, {
        type: 'text';
    }>['richText'];
    textLayout?: Extract<Clip, {
        type: 'text';
    }>['textLayout'];
    openTypeFeatures?: Extract<Clip, {
        type: 'text';
    }>['openTypeFeatures'];
    arcText?: Extract<Clip, {
        type: 'text';
    }>['arcText'];
    colorLabel?: TimelineLabelColor | null;
    mediaId?: string;
    subtitleType?: SubtitleTrackType;
    speaker?: string;
    speakerId?: number;
    soundDesc?: string;
    subtitleMode?: SubtitleMode;
    dataSubtitle?: Extract<Clip, {
        type: 'subtitle';
    }>['dataSubtitle'];
    speed?: number;
    pitchSemitones?: number;
    audioChannelRouting?: Clip['audioChannelRouting'];
    pitchData?: Clip['pitchData'];
    muted?: boolean;
    reverseAudio?: boolean;
    fadeInDuration?: number;
    fadeOutDuration?: number;
    fadeInCurve?: AudioFadeCurve;
    fadeOutCurve?: AudioFadeCurve;
    chromaKey?: Partial<ChromaKey>;
    stabilization?: Partial<ClipStabilization>;
    frameInterpolation?: Partial<ClipFrameInterpolation>;
    audioDenoise?: Partial<ClipAudioDenoise>;
    spatialAudio?: Partial<ClipSpatialAudio>;
    videoRestoration?: Partial<ClipVideoRestoration>;
    qualityEnhancement?: Partial<ClipQualityEnhancement>;
    projection?: ClipProjection;
    panorama?: Partial<ClipPanoramaView>;
    masks?: ClipMask[];
    motionTrack?: MotionTrackPoint[];
    border?: Partial<ClipBorder>;
    sequenceFrameRate?: number;
    colorCorrection?: Partial<ColorCorrection>;
    transform?: Partial<Transform>;
    rows?: CreditsRow[];
    rollSpeed?: number;
    style?: Partial<TextStyle> | Partial<SubtitleStyle> | Partial<CreditsStyle>;
    pathText?: Partial<TextPathOptions>;
    motionGraphic?: Partial<Extract<Clip, {
        type: 'motion-graphic';
    }>['motionGraphic']>;
};
export type ReplaceMediaDurationMode = 'trim-to-original' | 'stretch-to-fit' | 'use-new-duration';
export type ReplaceMediaCompatibilityWarning = 'media-type-mismatch' | 'missing-audio-for-audio-properties';
export type ReplaceableMediaClip = Extract<Clip, {
    mediaId: string;
}>;
export declare function calculateReplaceMediaPatch(clip: ReplaceableMediaClip, media: Pick<MediaAsset, 'id' | 'duration'>, durationMode: ReplaceMediaDurationMode): Pick<ReplaceableMediaClip, 'mediaId' | 'duration' | 'trimStart' | 'trimEnd' | 'speed'>;
export declare function getReplaceMediaCompatibilityWarnings(clip: Clip, media: Pick<MediaAsset, 'type' | 'hasAudio'>): ReplaceMediaCompatibilityWarning[];
export declare class ReplaceMediaCommand implements Command {
    private readonly accessor;
    private readonly clipId;
    private readonly media;
    private readonly durationMode;
    readonly description = "Replace media";
    private before?;
    private after?;
    constructor(accessor: TimelineAccessor, clipId: string, media: Pick<MediaAsset, 'id' | 'duration'>, durationMode: ReplaceMediaDurationMode);
    execute(): void;
    undo(): void;
}
export declare class SwitchMediaVersionCommand implements Command {
    private readonly accessor;
    private readonly clipId;
    private readonly media;
    readonly description = "Switch media version";
    private before?;
    private after?;
    constructor(accessor: TimelineAccessor, clipId: string, media: Pick<MediaAsset, 'id' | 'duration'>);
    execute(): void;
    undo(): void;
}
//# sourceMappingURL=clip-edit-commands.d.ts.map