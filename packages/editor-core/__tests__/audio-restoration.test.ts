import { describe, expect, it } from 'vitest';
import {
  AUDIO_FILL_GAP_THRESHOLD_SECONDS,
  DEFAULT_AUDIO_RESTORATION,
  buildAudioRestorationFilterArgs,
  buildAudioRestorationFilterChain,
  buildAudioRestorationWaveformComparison,
  detectAudioFillGaps,
  normalizeAudioRestoration
} from '../src';

describe('audio restoration', () => {
  it('normalizes restoration settings with all tools disabled by default', () => {
    expect(normalizeAudioRestoration(undefined)).toEqual(DEFAULT_AUDIO_RESTORATION);
    expect(buildAudioRestorationFilterArgs(undefined)).toEqual([]);
  });

  it('builds FFmpeg filter args for each restoration tool', () => {
    expect(buildAudioRestorationFilterArgs({ declip: { enabled: true } })).toEqual(['adeclip=w=55:o=10:arptresh=0.05']);
    expect(buildAudioRestorationFilterArgs({ dereverb: { enabled: true, strength: 1 } })).toEqual(['aecho=0.8:0.9:60:0.4']);
    expect(buildAudioRestorationFilterArgs({ dewind: { enabled: true } })).toEqual(['highpass=f=80:poles=2', 'lowpass=f=8000']);
    expect(buildAudioRestorationFilterArgs({ fill: { enabled: true } }, { duration: 2.5 })).toEqual(['apad', 'atrim=duration=2.5']);
  });

  it('chains restoration filters in the fixed processing order', () => {
    const chain = buildAudioRestorationFilterChain(
      {
        fill: { enabled: true },
        dewind: { enabled: true },
        dereverb: { enabled: true, strength: 1 },
        declip: { enabled: true }
      },
      { duration: 4 }
    );

    expect(chain).toBe('adeclip=w=55:o=10:arptresh=0.05,aecho=0.8:0.9:60:0.4,highpass=f=80:poles=2,lowpass=f=8000,apad,atrim=duration=4');
  });

  it('builds waveform comparison data without mutating the input peaks', () => {
    const peaks = [0.2, 0.95, 0.4];
    const comparison = buildAudioRestorationWaveformComparison(peaks, {
      declip: { enabled: true },
      dereverb: { enabled: true, strength: 0.5 },
      dewind: { enabled: true }
    });

    expect(comparison.before).toEqual([0.2, 0.95, 0.4]);
    expect(comparison.after).toHaveLength(3);
    expect(comparison.after[1]).toBeLessThan(0.95);
    expect(comparison.changed).toBe(true);
    expect(peaks).toEqual([0.2, 0.95, 0.4]);
  });

  it('detects only audio fill gaps shorter than the threshold', () => {
    expect(AUDIO_FILL_GAP_THRESHOLD_SECONDS).toBe(0.1);
    expect(
      detectAudioFillGaps([
        { start: 1, duration: 0.099 },
        { start: 2, duration: 0.1 },
        { start: 3, duration: 0.101 },
        { start: 4, duration: -1 }
      ])
    ).toEqual([{ start: 1, duration: 0.099 }]);
  });
});
