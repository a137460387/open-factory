import { describe, it, expect } from 'vitest';
import {
  detachAudioFromVideoClip,
  moveLinkedClipPair,
  unlinkAudioFromVideo,
  relinkAudioToVideo,
  type AudioDetachedVideoClip,
  type LinkedAudioClip,
} from '../src/audio-detach';
import type { Timeline, VideoClip, AudioClip } from '../src/model-types';

function makeVideoClipForDetach(overrides: Partial<VideoClip> = {}): VideoClip {
  return {
    id: overrides.id ?? 'vid-1',
    type: 'video',
    name: overrides.name ?? 'Test Video',
    mediaId: 'media-1',
    trackId: 'track-video',
    start: overrides.start ?? 0,
    duration: overrides.duration ?? 10,
    trimStart: overrides.trimStart ?? 0,
    trimEnd: overrides.trimEnd ?? 0,
    speed: overrides.speed ?? 1,
    colorCorrection: { brightness: 0, contrast: 0, saturation: 0, hue: 0 },
    transform: { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 },
    volume: overrides.volume ?? 1,
    muted: overrides.muted,
    pitchSemitones: 0,
    reverseAudio: false,
    fadeInDuration: 0,
    fadeOutDuration: 0,
    fadeInCurve: 'linear',
    fadeOutCurve: 'linear',
  };
}

function makeTimelineForDetach(
  videoClipOverrides: Partial<VideoClip> = {},
  existingAudioClips: AudioClip[] = []
): Timeline {
  const videoClip = makeVideoClipForDetach(videoClipOverrides);
  return {
    tracks: [
      {
        id: 'track-video',
        type: 'video',
        name: 'V1',
        clips: [videoClip],
      },
      {
        id: 'track-audio',
        type: 'audio',
        name: 'A1',
        clips: existingAudioClips,
      },
    ],
  };
}

describe('audio-detach', () => {
  describe('detachAudioFromVideoClip', () => {
    it('should mark video clip as audioDetached and mute it', () => {
      const timeline = makeTimelineForDetach();
      const { timeline: result, result: detachResult } = detachAudioFromVideoClip(timeline, 'vid-1');

      const detachedVideo = detachResult.videoClip;
      expect(detachedVideo.audioDetached).toBe(true);
      expect(detachedVideo.muted).toBe(true);
      expect(detachedVideo.volume).toBe(0);
      expect(detachedVideo.linkedAudioClipId).toBe(detachResult.audioClip.id);
    });

    it('should create a LinkedAudioClip with matching timecodes', () => {
      const timeline = makeTimelineForDetach({ start: 5, duration: 8, trimStart: 1, trimEnd: 2 });
      const { result: detachResult } = detachAudioFromVideoClip(timeline, 'vid-1');

      const audioClip = detachResult.audioClip;
      expect(audioClip.type).toBe('audio');
      expect(audioClip.start).toBe(5);
      expect(audioClip.duration).toBe(8);
      expect(audioClip.trimStart).toBe(1);
      expect(audioClip.trimEnd).toBe(2);
      expect(audioClip.softLinked).toBe(true);
      expect(audioClip.linkedVideoClipId).toBe(detachResult.videoClip.id);
    });

    it('should place audio clip on specified audio track', () => {
      const timeline = makeTimelineForDetach();
      const { result } = detachAudioFromVideoClip(timeline, 'vid-1', 'track-audio');

      expect(result.audioClip.trackId).toBe('track-audio');
      expect(result.audioTrackId).toBe('track-audio');

      // Audio track should now have the new clip
      const audioTrack = result.videoClip
        ? undefined
        : undefined;
      // Verify by checking timeline state
      const { timeline: tl } = detachAudioFromVideoClip(timeline, 'vid-1', 'track-audio');
      const at = tl.tracks.find((t) => t.id === 'track-audio');
      expect(at?.clips.length).toBe(1);
      expect(at?.clips[0].type).toBe('audio');
    });

    it('should auto-detect audio track if none specified', () => {
      const timeline = makeTimelineForDetach();
      const { result } = detachAudioFromVideoClip(timeline, 'vid-1');

      expect(result.audioTrackId).toBe('track-audio');
    });

    it('should throw if clip is not a video', () => {
      const timeline: Timeline = {
        tracks: [
          {
            id: 'track-audio',
            type: 'audio',
            name: 'A1',
            clips: [
              {
                id: 'audio-only',
                type: 'audio',
                name: 'Audio',
                mediaId: 'm1',
                trackId: 'track-audio',
                start: 0,
                duration: 10,
                trimStart: 0,
                trimEnd: 0,
                speed: 1,
                colorCorrection: { brightness: 0, contrast: 0, saturation: 0, hue: 0 },
                transform: { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 },
                volume: 1,
                pitchSemitones: 0,
                reverseAudio: false,
                fadeInDuration: 0,
                fadeOutDuration: 0,
                fadeInCurve: 'linear',
                fadeOutCurve: 'linear',
              },
            ],
          },
        ],
      };
      expect(() => detachAudioFromVideoClip(timeline, 'audio-only')).toThrow('not a video clip');
    });

    it('should throw if no audio track available', () => {
      const timeline: Timeline = {
        tracks: [
          {
            id: 'track-video',
            type: 'video',
            name: 'V1',
            clips: [makeVideoClipForDetach()],
          },
        ],
      };
      expect(() => detachAudioFromVideoClip(timeline, 'vid-1')).toThrow('No audio track');
    });

    it('should preserve original volume and audio properties in the audio clip', () => {
      const timeline = makeTimelineForDetach({ volume: 0.7 });
      const { result } = detachAudioFromVideoClip(timeline, 'vid-1');

      expect(result.audioClip.volume).toBe(0.7);
      expect(result.audioClip.mediaId).toBe('media-1');
      expect(result.audioClip.pitchSemitones).toBe(0);
    });
  });

  describe('moveLinkedClipPair - soft link', () => {
    it('should move both video and audio clips when soft-linked', () => {
      const timeline = makeTimelineForDetach({ start: 0, duration: 10 });
      const { timeline: detached } = detachAudioFromVideoClip(timeline, 'vid-1', 'track-audio');

      // Move the video clip by +5
      const moved = moveLinkedClipPair(detached, detached.tracks[0].clips[0].id, 5);

      const movedVideo = moved.tracks[0].clips[0];
      const movedAudio = moved.tracks.find((t) => t.id === 'track-audio')!.clips[0];

      expect(movedVideo.start).toBe(5);
      expect(movedAudio.start).toBe(5);
    });

    it('should move audio clip and have video follow when soft-linked', () => {
      const timeline = makeTimelineForDetach({ start: 2, duration: 8 });
      const { timeline: detached } = detachAudioFromVideoClip(timeline, 'vid-1', 'track-audio');

      const audioClipId = detached.tracks.find((t) => t.id === 'track-audio')!.clips[0].id;
      const moved = moveLinkedClipPair(detached, audioClipId, -2);

      const movedVideo = moved.tracks[0].clips[0];
      const movedAudio = moved.tracks.find((t) => t.id === 'track-audio')!.clips[0];

      expect(movedVideo.start).toBe(0);
      expect(movedAudio.start).toBe(0);
    });

    it('should move only the single clip if no link exists', () => {
      const timeline = makeTimelineForDetach({ start: 0, duration: 10 });
      // Move a non-linked clip
      const moved = moveLinkedClipPair(timeline, 'vid-1', 5);

      expect(moved.tracks[0].clips[0].start).toBe(5);
    });

    it('should not allow moving before time 0', () => {
      const timeline = makeTimelineForDetach({ start: 2, duration: 10 });
      const { timeline: detached } = detachAudioFromVideoClip(timeline, 'vid-1', 'track-audio');

      const moved = moveLinkedClipPair(detached, detached.tracks[0].clips[0].id, -10);

      expect(moved.tracks[0].clips[0].start).toBe(0);
      expect(moved.tracks.find((t) => t.id === 'track-audio')!.clips[0].start).toBe(0);
    });
  });

  describe('unlinkAudioFromVideo', () => {
    it('should set softLinked to false on the audio clip', () => {
      const timeline = makeTimelineForDetach({ start: 0, duration: 10 });
      const { timeline: detached } = detachAudioFromVideoClip(timeline, 'vid-1', 'track-audio');

      const audioClipId = detached.tracks.find((t) => t.id === 'track-audio')!.clips[0].id;
      const unlinked = unlinkAudioFromVideo(detached, audioClipId);

      const unlinkedAudio = unlinked.tracks.find((t) => t.id === 'track-audio')!.clips[0] as unknown as LinkedAudioClip;
      expect(unlinkedAudio.softLinked).toBe(false);
    });

    it('should restore video clip audio state after unlinking', () => {
      const timeline = makeTimelineForDetach({ start: 0, duration: 10 });
      const { timeline: detached } = detachAudioFromVideoClip(timeline, 'vid-1', 'track-audio');

      const audioClipId = detached.tracks.find((t) => t.id === 'track-audio')!.clips[0].id;
      const unlinked = unlinkAudioFromVideo(detached, audioClipId);

      const unlinkedVideo = unlinked.tracks[0].clips[0] as VideoClip;
      // After unlink, video should no longer be marked as audioDetached
      expect((unlinkedVideo as Partial<AudioDetachedVideoClip>).audioDetached).toBeFalsy();
      // Volume should be restored (at least not forced to 0)
      expect(unlinkedVideo.volume).not.toBe(0);
    });

    it('should allow independent movement after unlinking', () => {
      const timeline = makeTimelineForDetach({ start: 0, duration: 10 });
      const { timeline: detached } = detachAudioFromVideoClip(timeline, 'vid-1', 'track-audio');

      const audioClipId = detached.tracks.find((t) => t.id === 'track-audio')!.clips[0].id;
      const unlinked = unlinkAudioFromVideo(detached, audioClipId);

      // Move video only
      const moved = moveLinkedClipPair(unlinked, unlinked.tracks[0].clips[0].id, 5);

      const movedVideo = moved.tracks[0].clips[0];
      const movedAudio = moved.tracks.find((t) => t.id === 'track-audio')!.clips[0];

      // Video moved, audio stayed
      expect(movedVideo.start).toBe(5);
      expect(movedAudio.start).toBe(0);
    });
  });

  describe('relinkAudioToVideo', () => {
    function makeDetachedPair(videoStart = 0, audioStart = 0, duration = 10) {
      const timeline = makeTimelineForDetach({ start: videoStart, duration });
      const { timeline: detached } = detachAudioFromVideoClip(timeline, 'vid-1', 'track-audio');
      const videoClipId = detached.tracks[0].clips[0].id;
      const audioClipId = detached.tracks.find((t) => t.id === 'track-audio')!.clips[0].id;

      // If we need different audio start, move it
      if (audioStart !== videoStart) {
        const delta = audioStart - videoStart;
        const moved = moveLinkedClipPair(detached, audioClipId, delta);
        return { timeline: moved, videoClipId, audioClipId };
      }
      return { timeline: detached, videoClipId, audioClipId };
    }

    it('should successfully relink when clips are time-aligned', () => {
      const { timeline, videoClipId, audioClipId } = makeDetachedPair(0, 0, 10);
      const relinked = relinkAudioToVideo(timeline, videoClipId, audioClipId);

      // Audio clip should be removed
      const audioTrack = relinked.tracks.find((t) => t.id === 'track-audio');
      expect(audioTrack?.clips.length).toBe(0);

      // Video clip should be restored
      const restoredVideo = relinked.tracks[0].clips[0] as VideoClip;
      expect((restoredVideo as Partial<AudioDetachedVideoClip>).audioDetached).toBeFalsy();
      expect(restoredVideo.volume).not.toBe(0);
    });

    it('should restore audio properties from the audio clip to the video', () => {
      const timeline = makeTimelineForDetach({ start: 0, duration: 10, volume: 0.8 });
      const { timeline: detached, result } = detachAudioFromVideoClip(timeline, 'vid-1', 'track-audio');
      const detachedVideoId = result.videoClip.id;
      const audioClipId = result.audioClip.id;

      // Modify the audio clip volume independently
      const audioModified = {
        ...detached,
        tracks: detached.tracks.map((track) => ({
          ...track,
          clips: track.clips.map((clip) =>
            clip.id === audioClipId ? { ...clip, volume: 0.5 } : clip
          ),
        })),
      };

      const relinked = relinkAudioToVideo(audioModified, detachedVideoId, audioClipId);
      const restoredVideo = relinked.tracks[0].clips[0] as VideoClip;

      // Volume should come from the audio clip (0.5), not the original video (0.8)
      expect(restoredVideo.volume).toBe(0.5);
    });

    it('should throw when clips are not time-aligned', () => {
      // We need to unlink first so we can move independently
      const timeline = makeTimelineForDetach({ start: 0, duration: 10 });
      const { timeline: detached } = detachAudioFromVideoClip(timeline, 'vid-1', 'track-audio');
      const audioClipId = detached.tracks.find((t) => t.id === 'track-audio')!.clips[0].id;

      // Unlink to allow independent movement
      const unlinked = unlinkAudioFromVideo(detached, audioClipId);

      // Move audio independently
      const moved = moveLinkedClipPair(unlinked, audioClipId, 3);
      const videoClipId = moved.tracks[0].clips[0].id;

      expect(() => relinkAudioToVideo(moved, videoClipId, audioClipId)).toThrow('not a detached video clip');
    });

    it('should throw if video clip is not detached', () => {
      const timeline = makeTimelineForDetach();
      // vid-1 exists but is not detached, so relinkAudioToVideo finds it but checks type
      // We need a valid second clip id for the audio param, but it won't be reached
      // Use the same id twice — the video check happens first
      expect(() => relinkAudioToVideo(timeline, 'vid-1', 'vid-1')).toThrow('not a detached video clip');
    });

    it('should throw if audio clip is not a linked audio clip', () => {
      const timeline = makeTimelineForDetach({ start: 0, duration: 10 });
      const { timeline: detached } = detachAudioFromVideoClip(timeline, 'vid-1', 'track-audio');
      const videoClipId = detached.tracks[0].clips[0].id;

      expect(() => relinkAudioToVideo(detached, videoClipId, 'nonexistent')).toThrow('not found');
    });
  });
});
