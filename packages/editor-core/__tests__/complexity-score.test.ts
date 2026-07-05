import { describe, expect, it } from 'vitest';
import {
  calculateAudioComplexityScore,
  calculateColorDepthScore,
  calculateComplexityScore,
  calculateEffectComplexityScore,
  calculateKeyframeDensityScore,
  calculateTimelineDensityScore,
  createComplexityReport,
  getComplexityLevel
} from '../src';
import { createTrack } from '../src';
import type { Clip } from '../src';
import { makeAudioClip, makeProject, makeTimeline, makeVideoClip } from './test-utils';

describe('complexity score', () => {
  it('scores timeline density by clips per minute', () => {
    const timeline = makeTimeline([
      makeVideoClip({ id: 'clip-a', start: 0, duration: 3 }),
      makeVideoClip({ id: 'clip-b', start: 3, duration: 3 }),
      makeVideoClip({ id: 'clip-c', start: 6, duration: 3 }),
      makeVideoClip({ id: 'clip-d', start: 9, duration: 3 })
    ]);

    const score = calculateTimelineDensityScore(timeline);

    expect(score.rawValue).toBe(20);
    expect(score.score).toBe(100);
  });

  it('scores effect complexity with type coefficients', () => {
    const timeline = makeTimeline([
      makeVideoClip({
        effects: [
          { id: 'fx-blur', type: 'blur', enabled: true, params: {} },
          { id: 'fx-shader', type: 'custom-shader', enabled: true, params: {} },
          { id: 'fx-disabled', type: 'motion-blur', enabled: false, params: {} }
        ]
      })
    ]);

    const score = calculateEffectComplexityScore(timeline);

    expect(score.rawValue).toBe(3.2);
    expect(score.score).toBe(40);
  });

  it('scores color depth from non-default correction fields', () => {
    const timeline = makeTimeline([
      makeVideoClip({ id: 'clip-a', colorCorrection: { brightness: 0.2, saturation: 1.4, lutPath: 'C:/Looks/warm.cube' } }),
      makeVideoClip({ id: 'clip-b' })
    ]);

    const score = calculateColorDepthScore(timeline);

    expect(score.rawValue).toBeCloseTo(0.214, 3);
    expect(score.score).toBeCloseTo(21.429, 3);
  });

  it('scores audio processing from tracks and clip nodes', () => {
    const timeline = makeTimeline([
      makeAudioClip({
        id: 'audio-a',
        volume: 0.5,
        pitchSemitones: 2,
        audioDenoise: { enabled: true, strength: 0.5 },
        fadeInDuration: 0.5,
        fadeOutDuration: 0.25
      })
    ]);
    timeline.tracks[1] = createTrack({
      id: 'track-audio',
      type: 'audio',
      name: 'Audio 1',
      volume: 0.8,
      pan: -0.25,
      eq: { enabled: true, bands: [{ id: 'band-1', type: 'peaking', frequency: 1000, gain: 2, q: 1 }] },
      compressor: { enabled: true, threshold: -18, ratio: 3, attack: 5, release: 120, makeupGain: 1 },
      clips: timeline.tracks[1].clips
    });

    const score = calculateAudioComplexityScore(timeline);

    expect(score.rawValue).toBe(15);
    expect(score.score).toBe(100);
  });

  it('skips non-audio-video-nested clip types in audio complexity scoring', () => {
    const timeline = makeTimeline([
      makeAudioClip({ id: 'audio-a', volume: 0.5 })
    ]);
    const textClip: Clip = { ...makeAudioClip({ id: 'text-1', start: 5, duration: 3 }), type: 'text', text: '' } as Clip;
    timeline.tracks[1].clips.push(textClip);
    const score = calculateAudioComplexityScore(timeline);
    // text clip skipped; volume on audio-a (1 node) + default EQ on track (1 node)
    // rawValue = audioTracks(1*2) + trackNodes(1*2) + clipNodes(1) = 5
    expect(score.rawValue).toBe(5);
  });

  it('counts non-default spatial audio as an audio processing node', () => {
    const timeline = makeTimeline([
      makeAudioClip({ id: 'audio-spatial', spatialAudio: { x: 1 } })
    ]);
    const score = calculateAudioComplexityScore(timeline);
    // audioTracks(1*2) + trackNodes(1*2 default EQ) + clipNodes(1 spatial) = 5
    expect(score.rawValue).toBe(5);
  });

  it('scores keyframe density per clip', () => {
    const timeline = makeTimeline([
      makeVideoClip({
        id: 'clip-a',
        keyframes: {
          opacity: [
            { id: 'kf-1', time: 0, value: 1, easing: 'linear' },
            { id: 'kf-2', time: 1, value: 0.5, easing: 'ease-in' }
          ],
          x: [{ id: 'kf-3', time: 1, value: 0.2, easing: 'linear' }]
        }
      }),
      makeVideoClip({ id: 'clip-b' })
    ]);

    const score = calculateKeyframeDensityScore(timeline);

    expect(score.rawValue).toBe(1.5);
    expect(score.score).toBe(30);
  });

  it('calculates weighted total, level, and report JSON shape', () => {
    const project = makeProject();
    project.id = 'project-score';
    project.name = 'Complex Project';
    project.timeline = makeTimeline([
      makeVideoClip({
        effects: [{ id: 'fx-shader', type: 'custom-shader', enabled: true, params: {} }],
        colorCorrection: { brightness: 0.5, contrast: 1.5 },
        keyframes: {
          opacity: [{ id: 'kf-1', time: 0, value: 1, easing: 'linear' }]
        }
      })
    ]);

    const result = calculateComplexityScore(project);
    const report = createComplexityReport(project, '2026-06-16T00:00:00.000Z');

    expect(result.totalScore).toBeGreaterThan(0);
    expect(getComplexityLevel(35)).toBe('beginner');
    expect(getComplexityLevel(62)).toBe('intermediate');
    expect(getComplexityLevel(78)).toBe('professional');
    expect(getComplexityLevel(90)).toBe('master');
    expect(report).toMatchObject({
      projectId: 'project-score',
      projectName: 'Complex Project',
      generatedAt: '2026-06-16T00:00:00.000Z',
      totalScore: result.totalScore,
      level: result.level
    });
    expect(report.dimensions).toHaveLength(5);
    expect(report.references.map((reference) => reference.score)).toEqual([35, 62, 78]);
  });
});
