import { createId } from './model';
/**
 * 从视频 clip 分离音频，生成独立音频 clip。
 * 原视频 clip 标记 audioDetached: true 并静音。
 */
export function detachAudioFromVideoClip(timeline, videoClipId, audioTrackId) {
    const { clip: videoClip, trackIndex } = findClipWithTrackIndex(timeline, videoClipId);
    if (videoClip.type !== 'video') {
        throw new Error(`Clip ${videoClipId} is not a video clip`);
    }
    const detachedVideoClipId = createId('clip');
    const audioClipId = createId('clip');
    // 创建分离后的视频 clip（静音，标记 audioDetached）
    const detachedVideo = {
        ...videoClip,
        id: detachedVideoClipId,
        volume: 0,
        muted: true,
        audioDetached: true,
        linkedAudioClipId: audioClipId,
    };
    // 创建独立音频 clip
    const audioClip = {
        id: audioClipId,
        name: `${videoClip.name} (audio)`,
        type: 'audio',
        trackId: audioTrackId ?? '',
        mediaId: videoClip.mediaId,
        start: videoClip.start,
        duration: videoClip.duration,
        trimStart: videoClip.trimStart,
        trimEnd: videoClip.trimEnd,
        speed: videoClip.speed,
        volume: videoClip.volume,
        muted: false,
        colorCorrection: { ...videoClip.colorCorrection },
        transform: { ...videoClip.transform },
        fadeInDuration: videoClip.fadeInDuration,
        fadeOutDuration: videoClip.fadeOutDuration,
        fadeInCurve: videoClip.fadeInCurve,
        fadeOutCurve: videoClip.fadeOutCurve,
        pitchSemitones: videoClip.pitchSemitones,
        reverseAudio: videoClip.reverseAudio,
        audioDenoise: videoClip.audioDenoise ? { ...videoClip.audioDenoise } : undefined,
        audioRestoration: videoClip.audioRestoration ? { ...videoClip.audioRestoration } : undefined,
        audioChannelRouting: videoClip.audioChannelRouting,
        linkedVideoClipId: detachedVideoClipId,
        softLinked: true,
    };
    // 确定音频轨
    let targetAudioTrackId = audioTrackId;
    if (!targetAudioTrackId) {
        const audioTrack = timeline.tracks.find((t) => t.type === 'audio');
        if (!audioTrack) {
            throw new Error('No audio track available for detached audio');
        }
        targetAudioTrackId = audioTrack.id;
    }
    audioClip.trackId = targetAudioTrackId;
    // 更新 timeline：替换视频 clip，添加音频 clip
    const newTimeline = {
        ...timeline,
        tracks: timeline.tracks.map((track, index) => {
            if (index === trackIndex) {
                return {
                    ...track,
                    clips: track.clips.map((c) => (c.id === videoClipId ? detachedVideo : c)),
                };
            }
            if (track.id === targetAudioTrackId) {
                return {
                    ...track,
                    clips: [...track.clips, audioClip],
                };
            }
            return track;
        }),
    };
    return {
        timeline: newTimeline,
        result: { videoClip: detachedVideo, audioClip, audioTrackId: targetAudioTrackId },
    };
}
/**
 * 在软链接模式下，移动视频 clip 时联动音频 clip。
 * 返回更新后的 timeline。
 */
export function moveLinkedClipPair(timeline, clipId, deltaStart) {
    const clip = findClip(timeline, clipId);
    const linkedId = getLinkedClipId(clip);
    if (!linkedId) {
        return moveSingleClip(timeline, clipId, deltaStart);
    }
    const linkedClip = findClip(timeline, linkedId);
    if (!isSoftLinked(clip) && !isSoftLinked(linkedClip)) {
        return moveSingleClip(timeline, clipId, deltaStart);
    }
    let result = moveSingleClip(timeline, clipId, deltaStart);
    result = moveSingleClip(result, linkedId, deltaStart);
    return result;
}
/**
 * 解除软链接：视频和音频从此完全独立。
 */
export function unlinkAudioFromVideo(timeline, audioClipId) {
    return {
        ...timeline,
        tracks: timeline.tracks.map((track) => ({
            ...track,
            clips: track.clips.map((clip) => {
                if (clip.id === audioClipId && isLinkedAudioClip(clip)) {
                    const { softLinked, linkedVideoClipId, ...rest } = clip;
                    return { ...rest, softLinked: false };
                }
                const linkedId = getLinkedClipId(clip);
                if (linkedId === audioClipId && isDetachedVideoClip(clip)) {
                    const { audioDetached, linkedAudioClipId, ...rest } = clip;
                    return { ...rest, audioDetached: false, volume: 1, muted: false };
                }
                return clip;
            }),
        })),
    };
}
/**
 * 重新合并音视频：仅当两者时间码完全对齐时可用。
 * 合并后删除独立音频 clip，恢复视频 clip 音频。
 */
export function relinkAudioToVideo(timeline, videoClipId, audioClipId) {
    const videoClip = findClip(timeline, videoClipId);
    const audioClip = findClip(timeline, audioClipId);
    if (!isDetachedVideoClip(videoClip)) {
        throw new Error(`Clip ${videoClipId} is not a detached video clip`);
    }
    if (!isLinkedAudioClip(audioClip)) {
        throw new Error(`Clip ${audioClipId} is not a linked audio clip`);
    }
    const linkedAudio = audioClip;
    const linkedVideo = videoClip;
    // 检查对齐
    if (!areClipsAligned(linkedVideo, linkedAudio)) {
        throw new Error('Cannot relink: video and audio clips are not time-aligned');
    }
    // 恢复视频 clip 的音频
    const restoredVideo = {
        ...linkedVideo,
        volume: linkedAudio.volume,
        muted: linkedAudio.muted,
        fadeInDuration: linkedAudio.fadeInDuration,
        fadeOutDuration: linkedAudio.fadeOutDuration,
        fadeInCurve: linkedAudio.fadeInCurve,
        fadeOutCurve: linkedAudio.fadeOutCurve,
        pitchSemitones: linkedAudio.pitchSemitones,
        reverseAudio: linkedAudio.reverseAudio,
        audioDenoise: linkedAudio.audioDenoise,
        audioRestoration: linkedAudio.audioRestoration,
        audioChannelRouting: linkedAudio.audioChannelRouting,
    };
    delete restoredVideo.audioDetached;
    delete restoredVideo.linkedAudioClipId;
    return {
        ...timeline,
        tracks: timeline.tracks.map((track) => ({
            ...track,
            clips: track.clips.filter((c) => c.id !== audioClipId).map((c) => (c.id === videoClipId ? restoredVideo : c)),
        })),
    };
}
// ---------- 辅助函数 ----------
function findClip(timeline, clipId) {
    for (const track of timeline.tracks) {
        const clip = track.clips.find((c) => c.id === clipId);
        if (clip)
            return clip;
    }
    throw new Error(`Clip ${clipId} not found`);
}
function findClipWithTrackIndex(timeline, clipId) {
    for (let i = 0; i < timeline.tracks.length; i++) {
        const clip = timeline.tracks[i].clips.find((c) => c.id === clipId);
        if (clip)
            return { clip, trackIndex: i };
    }
    throw new Error(`Clip ${clipId} not found`);
}
function moveSingleClip(timeline, clipId, deltaStart) {
    return {
        ...timeline,
        tracks: timeline.tracks.map((track) => ({
            ...track,
            clips: track.clips.map((clip) => {
                if (clip.id !== clipId)
                    return clip;
                const newStart = Math.max(0, clip.start + deltaStart);
                return { ...clip, start: newStart };
            }),
        })),
    };
}
function getLinkedClipId(clip) {
    if (isDetachedVideoClip(clip))
        return clip.linkedAudioClipId;
    if (isLinkedAudioClip(clip))
        return clip.linkedVideoClipId;
    return undefined;
}
function isDetachedVideoClip(clip) {
    return clip.type === 'video' && clip.audioDetached === true;
}
function isLinkedAudioClip(clip) {
    return clip.type === 'audio' && typeof clip.linkedVideoClipId === 'string';
}
function isSoftLinked(clip) {
    if (isDetachedVideoClip(clip))
        return true;
    if (isLinkedAudioClip(clip))
        return clip.softLinked !== false;
    return false;
}
function areClipsAligned(a, b) {
    return (Math.abs(a.start - b.start) < 0.001 &&
        Math.abs(a.duration - b.duration) < 0.001 &&
        Math.abs(a.trimStart - b.trimStart) < 0.001 &&
        Math.abs(a.trimEnd - b.trimEnd) < 0.001 &&
        Math.abs(a.speed - b.speed) < 0.001);
}
//# sourceMappingURL=audio-detach.js.map