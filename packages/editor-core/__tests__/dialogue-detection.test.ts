import { describe, expect, it } from 'vitest';
import {
  calculateVoiceBandEnergy,
  compareDialogueWithWhisper,
  createSubtitleClipsFromDialogues,
  detectDialogueIntervals,
  DIALOGUE_SENSITIVITY_PRESETS,
  type DialogueDetectionFrame
} from '../src';

describe('dialogue detection helpers', () => {
  it('calculates concentrated voice-band energy between 300Hz and 3400Hz', () => {
    const energy = calculateVoiceBandEnergy([
      { hz: 120, energy: 2 },
      { hz: 500, energy: 5 },
      { hz: 1600, energy: 3 },
      { hz: 6000, energy: 10 }
    ]);

    expect(energy).toEqual({ voiceEnergy: 8, totalEnergy: 20, ratio: 0.4 });
  });

  it('detects and merges dialogue intervals from loudness and voice-frequency frames', () => {
    const frames = [
      frame(0, 0.1, 0.1, 0.2),
      frame(0.1, 0.2, 0.35, 0.7),
      frame(0.3, 0.2, 0.36, 0.72),
      frame(0.5, 0.1, 0.1, 0.2),
      frame(0.62, 0.2, 0.34, 0.7),
      frame(0.82, 0.2, 0.34, 0.7),
      frame(1.3, 0.5, 0.4, 0.75)
    ];

    const intervals = detectDialogueIntervals(frames, { sensitivity: 'medium', mergeGap: 0.15 });

    expect(intervals).toEqual([
      expect.objectContaining({ id: 'dialogue-1', start: 0.1, end: 1.02, duration: 0.92 }),
      expect.objectContaining({ id: 'dialogue-2', start: 1.3, end: 1.8, duration: 0.5 })
    ]);
  });

  it('lets sensitivity change the minimum accepted dialogue duration', () => {
    const shortVoice = [frame(0, 0.3, 0.4, 0.75)];

    expect(DIALOGUE_SENSITIVITY_PRESETS.low.minDuration).toBeGreaterThan(DIALOGUE_SENSITIVITY_PRESETS.high.minDuration);
    expect(detectDialogueIntervals(shortVoice, { sensitivity: 'low' })).toEqual([]);
    expect(detectDialogueIntervals(shortVoice, { sensitivity: 'high' })).toHaveLength(1);
  });

  it('compares detected dialogue with Whisper segments and returns missed ranges', () => {
    const dialogues = [
      { id: 'dialogue-1', start: 0, end: 2, duration: 2, confidence: 0.8 },
      { id: 'dialogue-2', start: 3, end: 4, duration: 1, confidence: 0.7 }
    ];

    expect(compareDialogueWithWhisper(dialogues, [{ start: 0.2, end: 1.8, text: 'covered' }])).toEqual([
      { id: 'missing-dialogue-2', start: 3, end: 4, duration: 1, confidence: 0.7 }
    ]);
  });

  it('creates empty subtitle clips for manual dialogue transcription', () => {
    const clips = createSubtitleClipsFromDialogues(
      [
        { id: 'dialogue-1', start: 1.2, end: 2.4, duration: 1.2, confidence: 0.9 },
        { id: 'dialogue-2', start: 3, end: 3.8, duration: 0.8, confidence: 0.8 }
      ],
      { trackId: 'track-subtitle', baseId: 'voice', namePrefix: '对白' }
    );

    expect(clips.map((clip) => [clip.id, clip.type, clip.trackId, clip.start, clip.duration, clip.text])).toEqual([
      ['voice-1', 'subtitle', 'track-subtitle', 1.2, 1.2, ''],
      ['voice-2', 'subtitle', 'track-subtitle', 3, 0.8, '']
    ]);
  });
});

function frame(time: number, duration: number, loudness: number, voiceRatio: number): DialogueDetectionFrame {
  const voiceEnergy = Math.round(voiceRatio * 100);
  return {
    time,
    duration,
    loudness,
    frequencyBins: [
      { hz: 120, energy: 100 - voiceEnergy },
      { hz: 800, energy: voiceEnergy * 0.6 },
      { hz: 2400, energy: voiceEnergy * 0.4 }
    ]
  };
}
