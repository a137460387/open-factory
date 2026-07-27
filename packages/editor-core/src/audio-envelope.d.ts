import { type Clip, type Keyframe, type KeyframeEasing } from './model';
export interface VolumeEnvelopePoint {
    id: string;
    time: number;
    value: number;
    easing: KeyframeEasing;
    persisted: boolean;
}
export interface VolumeEnvelopeControlPointInput {
    id?: string;
    time: number;
    value: number;
    easing?: KeyframeEasing;
}
export type VolumeEnvelopeFadeKind = 'in' | 'out';
export declare function getVolumeEnvelopePoints(clip: Pick<Clip, 'duration' | 'keyframes'> & Partial<Pick<Extract<Clip, {
    volume: number;
}>, 'volume'>>): VolumeEnvelopePoint[];
export declare function volumeEnvelopeControlPointToKeyframe(input: VolumeEnvelopeControlPointInput, duration: number): Keyframe<number>;
export declare function buildVolumeFadeKeyframes(kind: VolumeEnvelopeFadeKind, duration: number, baseVolume?: number, fadeDuration?: number): Keyframe<number>[];
export declare function getVolumeEnvelopeValueAt(clip: Pick<Clip, 'duration' | 'keyframes'> & Partial<Pick<Extract<Clip, {
    volume: number;
}>, 'volume'>>, localTime: number): number;
//# sourceMappingURL=audio-envelope.d.ts.map