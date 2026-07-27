import type { VideoClip, AudioClip, Timeline } from './model-types';
/**
 * 视频 clip 的音频分离相关字段扩展。
 */
export interface AudioDetachedVideoClip extends VideoClip {
    /** 标记音频已分离 */
    audioDetached: true;
    /** 关联的音频 clip id（软链接） */
    linkedAudioClipId: string;
}
/**
 * 分离后的音频 clip 扩展字段。
 */
export interface LinkedAudioClip extends AudioClip {
    /** 关联的视频 clip id */
    linkedVideoClipId: string;
    /** 是否处于软链接状态 */
    softLinked: boolean;
}
export interface DetachAudioResult {
    videoClip: AudioDetachedVideoClip;
    audioClip: LinkedAudioClip;
    audioTrackId: string;
}
/**
 * 从视频 clip 分离音频，生成独立音频 clip。
 * 原视频 clip 标记 audioDetached: true 并静音。
 */
export declare function detachAudioFromVideoClip(timeline: Timeline, videoClipId: string, audioTrackId?: string): {
    timeline: Timeline;
    result: DetachAudioResult;
};
/**
 * 在软链接模式下，移动视频 clip 时联动音频 clip。
 * 返回更新后的 timeline。
 */
export declare function moveLinkedClipPair(timeline: Timeline, clipId: string, deltaStart: number): Timeline;
/**
 * 解除软链接：视频和音频从此完全独立。
 */
export declare function unlinkAudioFromVideo(timeline: Timeline, audioClipId: string): Timeline;
/**
 * 重新合并音视频：仅当两者时间码完全对齐时可用。
 * 合并后删除独立音频 clip，恢复视频 clip 音频。
 */
export declare function relinkAudioToVideo(timeline: Timeline, videoClipId: string, audioClipId: string): Timeline;
//# sourceMappingURL=audio-detach.d.ts.map