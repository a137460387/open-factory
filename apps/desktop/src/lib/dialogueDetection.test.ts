import { describe, expect, it } from 'vitest';
import { detectDialogueIntervals, DEFAULT_CLIP_SPEED, DEFAULT_COLOR_CORRECTION, DEFAULT_TRANSFORM, type Clip } from '@open-factory/editor-core';
import { buildDialogueFramesFromAudioBuffer } from './dialogueDetection';

describe('desktop dialogue detection adapter', () => {
  it('builds local audio frames that can detect a voice-band tone', () => {
    const sampleRate = 8_000;
    const samples = new Float32Array(sampleRate);
    for (let index = 0; index < samples.length; index += 1) {
      const time = index / sampleRate;
      samples[index] = time >= 0.2 && time < 0.9 ? Math.sin(2 * Math.PI * 1_000 * time) * 0.6 : Math.sin(2 * Math.PI * 120 * time) * 0.05;
    }

    const frames = buildDialogueFramesFromAudioBuffer(fakeAudioBuffer(samples, sampleRate), makeAudioClip());
    const dialogues = detectDialogueIntervals(frames, { sensitivity: 'medium' });

    expect(dialogues).toEqual([expect.objectContaining({ start: 0.2, end: 0.9, duration: 0.7 })]);
  });
});

function fakeAudioBuffer(samples: Float32Array, sampleRate: number): AudioBuffer {
  return {
    sampleRate,
    length: samples.length,
    duration: samples.length / sampleRate,
    numberOfChannels: 1,
    getChannelData: () => samples
  } as unknown as AudioBuffer;
}

function makeAudioClip(): Clip {
  return {
    id: 'clip-audio',
    type: 'audio',
    name: 'voice.wav',
    mediaId: 'media-audio',
    trackId: 'track-audio',
    start: 0,
    duration: 1,
    trimStart: 0,
    trimEnd: 0,
    speed: DEFAULT_CLIP_SPEED,
    colorCorrection: { ...DEFAULT_COLOR_CORRECTION },
    transform: { ...DEFAULT_TRANSFORM },
    volume: 1
  };
}
