import { describe, expect, it } from 'vitest';
import { analyzeClipRhythm, buildRhythmAnalysisHtml, calculateCutFrequencyCurve, detectRepeatedRhythmSegments, detectRhythmChangePoints, serializeRhythmAnalysisJson, type RhythmShot } from '../src';
import { makeProject, makeVideoClip } from './test-utils';

describe('rhythm analysis', () => {
  it('calculates average, shortest, and longest shot durations', () => {
    const project = makeProject();
    project.name = 'Rhythm Demo';
    project.timeline.tracks[0].clips = [
      makeVideoClip({ id: 'shot-a', name: 'A', start: 0, duration: 2 }),
      makeVideoClip({ id: 'shot-b', name: 'B', start: 2, duration: 4 }),
      makeVideoClip({ id: 'shot-c', name: 'C', start: 6, duration: 6 })
    ];

    const report = analyzeClipRhythm(project, { generatedAt: '2026-06-16T00:00:00.000Z' });

    expect(report.projectName).toBe('Rhythm Demo');
    expect(report.shotCount).toBe(3);
    expect(report.averageShotDuration).toBe(4);
    expect(report.shortestShotDuration).toBe(2);
    expect(report.longestShotDuration).toBe(6);
  });

  it('detects rhythm change points when adjacent shot duration differs by more than 2x', () => {
    const shots: RhythmShot[] = [
      { clipId: 'a', name: 'A', start: 0, duration: 2 },
      { clipId: 'b', name: 'B', start: 2, duration: 4 },
      { clipId: 'c', name: 'C', start: 6, duration: 9 }
    ];

    expect(detectRhythmChangePoints(shots)).toEqual([
      {
        time: 6,
        previousClipId: 'b',
        nextClipId: 'c',
        previousDuration: 4,
        nextDuration: 9,
        ratio: 2.25
      }
    ]);
  });

  it('detects repeated rhythm segments with ten or more similar shots', () => {
    const shots = Array.from({ length: 11 }, (_, index) => ({
      clipId: `shot-${index}`,
      name: `Shot ${index}`,
      start: index * 2,
      duration: index % 2 === 0 ? 2 : 2.1
    }));

    expect(detectRepeatedRhythmSegments(shots, 10, 0.12)).toEqual([
      {
        start: 0,
        end: 22,
        clipCount: 11,
        averageDuration: 2.045
      }
    ]);
  });

  it('builds a cut frequency curve from shot starts', () => {
    const shots: RhythmShot[] = [
      { clipId: 'a', name: 'A', start: 0, duration: 1 },
      { clipId: 'b', name: 'B', start: 1.2, duration: 1 },
      { clipId: 'c', name: 'C', start: 1.8, duration: 1 },
      { clipId: 'd', name: 'D', start: 3.2, duration: 1 }
    ];

    expect(calculateCutFrequencyCurve(shots, 1)).toEqual([
      { time: 0, cutsPerSecond: 0 },
      { time: 1, cutsPerSecond: 2 },
      { time: 2, cutsPerSecond: 0 },
      { time: 3, cutsPerSecond: 1 },
      { time: 4, cutsPerSecond: 0 }
    ]);
  });

  it('serializes JSON and renders localized HTML structure', () => {
    const project = makeProject();
    const report = analyzeClipRhythm(project, { generatedAt: '2026-06-16T00:00:00.000Z' });

    const parsed = JSON.parse(serializeRhythmAnalysisJson(report)) as typeof report;
    expect(parsed.projectName).toBe(project.name);
    expect(parsed.cutFrequencyCurve).toEqual(report.cutFrequencyCurve);

    const html = buildRhythmAnalysisHtml(report, 'en');
    expect(html).toContain('<html lang="en">');
    expect(html).toContain('Edit Rhythm Analysis');
    expect(html).toContain('Average Shot Duration');
    expect(html).toContain('Cut Frequency Curve');
  });
});
