import { describe, expect, it } from 'vitest';
import { AddSpeakerDiarizationTracksCommand } from '../src/commands/timeline-commands';
import { DEFAULT_CLIP_SPEED, DEFAULT_COLOR_CORRECTION, DEFAULT_TRANSFORM, createTrack, type Clip, type Timeline } from '../src/model';
import {
  buildSpeakerDiarizationTracks,
  detectSpeakerSegments,
  hasLowConfidenceSpeakerSegments,
  type SpeakerDiarizationFrame,
  type SpeakerDiarizationSegment
} from '../src/audio/speaker-diarization';

describe('speaker diarization', () => {
  it('detects speaker switch points after silence when pitch changes beyond threshold', () => {
    const segments = detectSpeakerSegments(
      [
        ...voiceFrames(0, 3, 120),
        silentFrame(0.3),
        silentFrame(0.4),
        ...voiceFrames(0.5, 3, 235),
        silentFrame(0.8),
        ...voiceFrames(0.9, 3, 125)
      ],
      { pitchChangeThresholdHz: 55, minSegmentDuration: 0.2 }
    );

    expect(segments.map((segment) => segment.speakerIndex)).toEqual([0, 1, 0]);
    expect(segments.map((segment) => [segment.start, segment.end])).toEqual([
      [0, 0.3],
      [0.5, 0.8],
      [0.9, 1.2]
    ]);
  });

  it('caps speaker clusters at four speakers', () => {
    const frames = [95, 170, 245, 320, 395].flatMap((pitch, index) => [...voiceFrames(index * 0.4, 3, pitch), silentFrame(index * 0.4 + 0.3)]);

    const segments = detectSpeakerSegments(frames, { pitchChangeThresholdHz: 35, minSegmentDuration: 0.2, maxSpeakers: 4 });

    expect(new Set(segments.map((segment) => segment.speakerIndex)).size).toBe(4);
    expect(Math.max(...segments.map((segment) => segment.speakerIndex))).toBe(3);
  });

  it('builds speaker tracks with source-aligned trims and one undoable command', () => {
    const clip = makeSourceClip({ start: 10, duration: 4, trimStart: 2 });
    const segments: SpeakerDiarizationSegment[] = [
      makeSegment(0, 0, 0, 0.5),
      makeSegment(1, 1, 1.1, 0.8),
      makeSegment(2, 0, 2.4, 0.7)
    ];
    const tracks = buildSpeakerDiarizationTracks(clip, segments, { baseId: 'diar', speakerNamePrefix: '说话人', clipNamePrefix: '对白' });
    let timeline: Timeline = { tracks: [createTrack({ id: 'original', type: 'audio', name: 'Original', clips: [clip] })], transitions: [], markers: [] };
    const command = new AddSpeakerDiarizationTracksCommand(
      {
        getTimeline: () => timeline,
        setTimeline: (next) => {
          timeline = next;
        }
      },
      tracks
    );

    command.execute();

    expect(tracks).toHaveLength(2);
    expect(timeline.tracks.map((track) => track.name)).toEqual(['Original', '说话人 1', '说话人 2']);
    expect(timeline.tracks[1].clips.map((item) => [item.start, item.duration, item.trimStart])).toEqual([
      [10, 0.5, 2],
      [12.4, 0.7, 4.4]
    ]);

    command.undo();
    expect(timeline.tracks).toHaveLength(1);
  });

  it('marks unstable low-loudness speaker segments as low confidence', () => {
    const segments = detectSpeakerSegments(
      [
        { time: 0, duration: 0.1, loudness: 0.13, pitchHz: 100, spectralCentroidHz: 1300 },
        { time: 0.1, duration: 0.1, loudness: 0.13, pitchHz: 220, spectralCentroidHz: 1800 },
        { time: 0.2, duration: 0.1, loudness: 0.13, pitchHz: 90, spectralCentroidHz: 1400 }
      ],
      { silenceThreshold: 0.1, pitchChangeThresholdHz: 30, minSegmentDuration: 0.2 }
    );

    expect(segments).toHaveLength(1);
    expect(segments[0].confidenceLabel).toBe('low');
    expect(hasLowConfidenceSpeakerSegments(segments)).toBe(true);
  });
});

function voiceFrames(start: number, count: number, pitchHz: number): SpeakerDiarizationFrame[] {
  return Array.from({ length: count }, (_, index) => ({
    time: Number((start + index * 0.1).toFixed(1)),
    duration: 0.1,
    loudness: 0.42,
    pitchHz,
    spectralCentroidHz: pitchHz * 8
  }));
}

function silentFrame(time: number): SpeakerDiarizationFrame {
  return { time, duration: 0.1, loudness: 0.02, pitchHz: 0, spectralCentroidHz: 0 };
}

function makeSegment(index: number, speakerIndex: number, start: number, duration: number): SpeakerDiarizationSegment {
  return {
    id: `segment-${index}`,
    speakerId: `speaker-${speakerIndex + 1}`,
    speakerIndex,
    start,
    end: start + duration,
    duration,
    averagePitchHz: speakerIndex === 0 ? 120 : 230,
    averageCentroidHz: speakerIndex === 0 ? 960 : 1840,
    confidence: 0.9,
    confidenceLabel: 'high'
  };
}

function makeSourceClip(patch: Partial<Extract<Clip, { type: 'audio' }>> = {}): Extract<Clip, { type: 'audio' }> {
  return {
    id: 'clip-source',
    type: 'audio',
    mediaId: 'media-source',
    trackId: 'original',
    name: 'Interview',
    start: 0,
    duration: 4,
    trimStart: 0,
    trimEnd: 0,
    speed: DEFAULT_CLIP_SPEED,
    colorCorrection: { ...DEFAULT_COLOR_CORRECTION },
    transform: { ...DEFAULT_TRANSFORM },
    volume: 1,
    ...patch
  };
}
