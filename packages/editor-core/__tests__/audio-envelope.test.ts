import { describe, expect, it } from 'vitest';
import {
  buildVolumeFadeKeyframes,
  getVolumeEnvelopePoints,
  getVolumeEnvelopeValueAt,
  volumeEnvelopeControlPointToKeyframe,
  AddKeyframeCommand,
  CommandManager,
  UpdateKeyframeCommand
} from '../src';
import { makeAccessor, makeAudioClip, makeTimeline } from './test-utils';

describe('audio volume envelope', () => {
  it('converts envelope control points into normalized volume keyframes', () => {
    const keyframe = volumeEnvelopeControlPointToKeyframe({ id: 'point-a', time: 99, value: 9, easing: 'ease-out' }, 4);

    expect(keyframe).toEqual({ id: 'point-a', time: 4, value: 2, easing: 'ease-out' });
  });

  it('generates fade-in and fade-out volume curves', () => {
    expect(buildVolumeFadeKeyframes('in', 4, 0.8, 1).map((frame) => [frame.id, frame.time, frame.value])).toEqual([
      ['volume-fade-in-start', 0, 0],
      ['volume-fade-in-end', 1, 0.8]
    ]);
    expect(buildVolumeFadeKeyframes('out', 4, 0.8, 1.5).map((frame) => [frame.id, frame.time, frame.value])).toEqual([
      ['volume-fade-out-start', 2.5, 0.8],
      ['volume-fade-out-end', 4, 0]
    ]);
  });

  it('builds display points from existing volume keyframes with virtual endpoints', () => {
    const clip = makeAudioClip({
      duration: 4,
      volume: 0.75,
      keyframes: {
        volume: [
          { id: 'vol-a', time: 1, value: 0.5, easing: 'linear' },
          { id: 'vol-b', time: 3, value: 1.5, easing: 'ease-in' }
        ]
      }
    });

    expect(getVolumeEnvelopePoints(clip).map((point) => [point.id, point.time, point.value, point.persisted])).toEqual([
      ['volume-envelope-start', 0, 0.5, false],
      ['vol-a', 1, 0.5, true],
      ['vol-b', 3, 1.5, true],
      ['volume-envelope-end', 4, 1.5, false]
    ]);
  });

  it('builds virtual envelope endpoints when no volume keyframes exist', () => {
    const clip = makeAudioClip({ duration: 3, volume: 0.4 });

    expect(getVolumeEnvelopePoints(clip).map((point) => [point.id, point.time, point.value, point.persisted])).toEqual([
      ['volume-envelope-start', 0, 0.4, false],
      ['volume-envelope-end', 3, 0.4, false]
    ]);
  });

  it('keeps envelope values synchronized with inspector volume keyframes', () => {
    const clip = makeAudioClip({
      duration: 5,
      volume: 1,
      keyframes: {
        volume: [
          { id: 'vol-a', time: 0, value: 0, easing: 'linear' },
          { id: 'vol-b', time: 5, value: 1, easing: 'linear' }
        ]
      }
    });

    expect(getVolumeEnvelopeValueAt(clip, 2.5)).toBe(0.5);
  });

  it('restores envelope keyframe edits through undo', () => {
    const accessor = makeAccessor(makeTimeline([makeAudioClip({ id: 'clip-audio', duration: 4 })]));
    const manager = new CommandManager();

    manager.execute(new AddKeyframeCommand(accessor, 'clip-audio', 'volume', { id: 'env-a', time: 1, value: 0.5 }));
    manager.execute(new UpdateKeyframeCommand(accessor, 'clip-audio', 'volume', 'env-a', { time: 2, value: 1.25 }));
    expect(accessor.current().tracks[1].clips[0].keyframes?.volume?.[0]).toMatchObject({ id: 'env-a', time: 2, value: 1.25 });

    manager.undo();
    expect(accessor.current().tracks[1].clips[0].keyframes?.volume?.[0]).toMatchObject({ id: 'env-a', time: 1, value: 0.5 });
    manager.undo();
    expect(accessor.current().tracks[1].clips[0].keyframes).toBeUndefined();
  });
});
