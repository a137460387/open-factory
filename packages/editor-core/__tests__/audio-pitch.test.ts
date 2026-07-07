import { describe, expect, it } from 'vitest';
import { analyzePitchFrames, detectPitchYin, hzToNoteName, normalizeClipPitchData, pitchNoteColor, serializePitchDataCsv, summarizePitchData } from '../src';

function sineWave(hz: number, seconds = 0.12, sampleRate = 44_100): Float32Array {
  const samples = new Float32Array(Math.round(seconds * sampleRate));
  for (let index = 0; index < samples.length; index += 1) {
    samples[index] = Math.sin((2 * Math.PI * hz * index) / sampleRate);
  }
  return samples;
}

describe('audio pitch analysis', () => {
  it('detects the fundamental frequency of a sine wave with simplified YIN', () => {
    const hz = detectPitchYin(sineWave(440), 44_100);

    expect(hz).toBeDefined();
    expect(hz ?? 0).toBeGreaterThan(435);
    expect(hz ?? 0).toBeLessThan(445);
  });

  it('maps Hz values to note names', () => {
    expect(hzToNoteName(440)).toBe('A4');
    expect(hzToNoteName(261.63)).toBe('C4');
    expect(hzToNoteName(-1)).toBe('');
  });

  it('samples pitch frames into sorted note points', () => {
    const points = analyzePitchFrames(sineWave(440, 0.2), 44_100, { frameSize: 2048, hopSize: 2048 });

    expect(points.length).toBeGreaterThan(1);
    expect(points[0]).toMatchObject({ time: 0, note: 'A4' });
    expect(points[0].hz).toBeGreaterThan(435);
    expect(points[0].hz).toBeLessThan(445);
  });

  it('normalizes invalid pitch data and derives missing note names', () => {
    expect(
      normalizeClipPitchData([
        { time: 1.23456, hz: 261.6255, note: '' },
        { time: -1, hz: 440, note: 'A4' },
        { time: 0.5, hz: 0, note: 'C4' }
      ])
    ).toEqual([{ time: 1.235, hz: 261.63, note: 'C4' }]);

    expect(normalizeClipPitchData([])).toBeUndefined();
    expect(normalizeClipPitchData([null, undefined, 42, 'string', { time: 0.1, hz: 440 }])).toEqual([{ time: 0.1, hz: 440, note: 'A4' }]);
  });

  it('summarizes primary note, range and stability', () => {
    const summary = summarizePitchData([
      { time: 0, hz: 440, note: 'A4' },
      { time: 0.1, hz: 441, note: 'A4' },
      { time: 0.2, hz: 439, note: 'A4' }
    ]);

    expect(summary.primaryNote).toBe('A4');
    expect(summary.minHz).toBe(439);
    expect(summary.maxHz).toBe(441);
    expect(summary.stability).toBeGreaterThan(0.95);
    expect(summary.sampleCount).toBe(3);
  });

  it('serializes pitch data to CSV', () => {
    expect(serializePitchDataCsv([{ time: 0, hz: 440, note: 'A4' }])).toBe('time,hz,note\n0.000,440.00,A4');
    expect(serializePitchDataCsv([{ time: 1, hz: 261.63, note: 'C,4' }])).toBe('time,hz,note\n1.000,261.63,"C,4"');
  });

  it('uses note colors by pitch class', () => {
    expect(pitchNoteColor('C4')).toBe('#ef4444');
    expect(pitchNoteColor('B3')).toBe('#a855f7');
    expect(pitchNoteColor(undefined)).toBe('#94a3b8');
  });
});
