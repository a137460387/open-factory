import { createId } from './model';
import type { Clip, VideoClip, AudioClip, Track, Timeline } from './model-types';

/**
 * 视频 clip 的音频分离相关字段扩展。
 * 在 VideoClip 上通过 as unknown as AudioDetachedVideoClip 访问。
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
export function detachAudioFromVideoClip(
  timeline: Timeline,
  videoClipId: string,
  audioTrackId?: string
): { timeline: Timeline; result: DetachAudioResult } {
  const { clip: videoClip, trackIndex } = findClipWithTrackIndex(timeline, videoClipId);
  if (videoClip.type !== 'video') {
    throw new Error(`Clip ${videoClipId} is not a video clip`);
  }

  const detachedVideoClipId = createId('clip');
  const audioClipId = createId('clip');

  // 创建分离后的视频 clip（静音，标记 audioDetached）
  const detachedVideo: AudioDetachedVideoClip = {
    ...videoClip,
    id: detachedVideoClipId,
    volume: 0,
    muted: true,
    audioDetached: true,
    linkedAudioClipId: audioClipId,
  } as AudioDetachedVideoClip;

  // 创建独立音频 clip
  const audioClip: LinkedAudioClip = {
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
  } as LinkedAudioClip;

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
  const newTimeline: Timeline = {
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
export function moveLinkedClipPair(
  timeline: Timeline,
  clipId: string,
  deltaStart: number
): Timeline {
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
export function unlinkAudioFromVideo(
  timeline: Timeline,
  audioClipId: string
): Timeline {
  return {
    ...timeline,
    tracks: timeline.tracks.map((track) => ({
      ...track,
      clips: track.clips.map((clip) => {
        if (clip.id === audioClipId && isLinkedAudioClip(clip)) {
          const { softLinked, linkedVideoClipId, ...rest } = clip as LinkedAudioClip;
          return { ...rest, softLinked: false } as AudioClip;
        }
        const linkedId = getLinkedClipId(clip);
        if (linkedId === audioClipId && isDetachedVideoClip(clip)) {
          const { audioDetached, linkedAudioClipId, ...rest } = clip as AudioDetachedVideoClip;
          return { ...rest, audioDetached: false, volume: 1, muted: false } as VideoClip;
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
export function relinkAudioToVideo(
  timeline: Timeline,
  videoClipId: string,
  audioClipId: string
): Timeline {
  const videoClip = findClip(timeline, videoClipId);
  const audioClip = findClip(timeline, audioClipId);

  if (!isDetachedVideoClip(videoClip)) {
    throw new Error(`Clip ${videoClipId} is not a detached video clip`);
  }
  if (!isLinkedAudioClip(audioClip)) {
    throw new Error(`Clip ${audioClipId} is not a linked audio clip`);
  }
  const linkedAudio = audioClip as unknown as import('./model-types').AudioClip;
  const linkedVideo = videoClip as unknown as AudioDetachedVideoClip;

  // 检查对齐
  if (!areClipsAligned(linkedVideo, linkedAudio)) {
    throw new Error('Cannot relink: video and audio clips are not time-aligned');
  }

  // 恢复视频 clip 的音频
  const restoredVideo: VideoClip = {
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
  } as VideoClip;
  delete (restoredVideo as Partial<AudioDetachedVideoClip>).audioDetached;
  delete (restoredVideo as Partial<AudioDetachedVideoClip>).linkedAudioClipId;

  return {
    ...timeline,
    tracks: timeline.tracks.map((track) => ({
      ...track,
      clips: track.clips
        .filter((c) => c.id !== audioClipId)
        .map((c) => (c.id === videoClipId ? restoredVideo : c)),
    })),
  };
}

// ---------- 辅助函数 ----------

function findClip(timeline: Timeline, clipId: string): Clip {
  for (const track of timeline.tracks) {
    const clip = track.clips.find((c) => c.id === clipId);
    if (clip) return clip;
  }
  throw new Error(`Clip ${clipId} not found`);
}

function findClipWithTrackIndex(timeline: Timeline, clipId: string): { clip: Clip; trackIndex: number } {
  for (let i = 0; i < timeline.tracks.length; i++) {
    const clip = timeline.tracks[i].clips.find((c) => c.id === clipId);
    if (clip) return { clip, trackIndex: i };
  }
  throw new Error(`Clip ${clipId} not found`);
}

function moveSingleClip(timeline: Timeline, clipId: string, deltaStart: number): Timeline {
  return {
    ...timeline,
    tracks: timeline.tracks.map((track) => ({
      ...track,
      clips: track.clips.map((clip) => {
        if (clip.id !== clipId) return clip;
        const newStart = Math.max(0, clip.start + deltaStart);
        return { ...clip, start: newStart };
      }),
    })),
  };
}

function getLinkedClipId(clip: Clip): string | undefined {
  if (isDetachedVideoClip(clip)) return (clip as AudioDetachedVideoClip).linkedAudioClipId;
  if (isLinkedAudioClip(clip)) return (clip as LinkedAudioClip).linkedVideoClipId;
  return undefined;
}

function isDetachedVideoClip(clip: Clip): boolean {
  return clip.type === 'video' && (clip as Partial<AudioDetachedVideoClip>).audioDetached === true;
}

function isLinkedAudioClip(clip: Clip): boolean {
  return clip.type === 'audio' && typeof (clip as Partial<LinkedAudioClip>).linkedVideoClipId === 'string';
}

function isSoftLinked(clip: Clip): boolean {
  if (isDetachedVideoClip(clip)) return true;
  if (isLinkedAudioClip(clip)) return (clip as LinkedAudioClip).softLinked !== false;
  return false;
}

function areClipsAligned(a: Clip, b: Clip): boolean {
  return (
    Math.abs(a.start - b.start) < 0.001 &&
    Math.abs(a.duration - b.duration) < 0.001 &&
    Math.abs(a.trimStart - b.trimStart) < 0.001 &&
    Math.abs(a.trimEnd - b.trimEnd) < 0.001 &&
    Math.abs(a.speed - b.speed) < 0.001
  );
}
